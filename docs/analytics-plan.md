# Content analytics plan

Status: **built, all six stages verified locally; not deployed** · Last updated: 2026-10-28

**Decisions (2026-10-28):** MongoDB storage · opt-out switch + GPC/DNT, no
banner · **administrators only** (editors see neither the Analytics page nor
the Overview reader card) · all public pages tracked.

## Goal

Know which content people actually read: views, visitors, **active** reading
time, how far down each article they get, where they came from and on what
device, live and over time. Shown on a new **Analytics** page in the admin,
built only from data the site itself collects. No sample data and no third-party
analytics service.

## What exists today

| Piece | What it does | Gap |
|---|---|---|
| `components/ReadTracker.tsx` | On article pages only: a `view` beacon, then a `heartbeat` every 15 s, then `complete` at 90 % | Time is wall-clock since the page opened. A background tab counts as reading. No device, source, category or session. |
| `api/analytics/event` | Validates and rate-limits beacons | Every heartbeat is a write. Bots and staff are counted. |
| `lib/analytics-store.ts` | Stores events in Upstash Redis, or else in a local `.data/analytics.ndjson` file | The file is lost on every deploy of DO App Platform and Vercel. Redis keeps only views, longest time, furthest scroll and finished. |
| `lib/analytics.ts` + Overview | 7/30/90-day totals, daily chart, top 10 articles | Totals are computed by replaying every event in memory, which won't scale. No filters, categories, sources, devices or realtime. |

None of that data can answer the questions this page needs to answer, so the new
system starts its own record. The Overview's reader card will switch to it.

## Architecture

```
Browser (every public page)                     Next.js server                       MongoDB "islamonlive"
 lib/tracker.ts  ── start / ping / end ──►  POST /api/analytics/collect  ──►  analytics_views  (1 doc per page view)
  · active-time clock                         · validate, rate limit             │  TTL 400 days
  · scroll depth                              · drop bots + signed-in staff      ▼
  · visitor + session ids                     · device from User-Agent        analytics_daily  (closed days, rolled up)
                                              · source from referrer             │
Admin /admin → Analytics tab  ◄── GET /api/admin/analytics/* (staff only, cached) ◄┘
```

### Storage: MongoDB, `islamonlive` database

- MongoDB is already the site's database and needs no new service. Aggregation
  pipelines make filtered dashboards straightforward. Durable, and backed up with
  the content.
- **Write budget:** each page view is written about 2 + (visible minutes × 2)
  times: one insert, a ping every 30 s while the tab is visible, and a final
  update. Each write is a single `updateOne` on `_id`. At 20k page views a day
  that is roughly 1 write/s on average, well inside the Flex cluster's 100
  ops/s shared limit. The `start` beacon goes out right away; the rest only
  while someone is actually on the page.
- **Size:** about 250 bytes per view, using short field names and compressed
  storage. Raw views expire after **400 days** (TTL), long enough for "last 90
  days vs the 90 before" and year-on-year spot checks. Daily rollups are kept
  forever, so long-range counts survive the TTL.

`analytics_views`, one document per page view (`_id` = random view id from the browser):

| Field | Meaning |
|---|---|
| `v`, `s` | random visitor id (localStorage) and session id (30-minute inactivity rule, like GA) |
| `t`, `ls`, `day` | started at, last seen, IST day `YYYY-MM-DD` |
| `k`, `p` | page kind (`article`, `home`, `category`, `tag`, `author`, `page`, `search`, `listen`, `watch`, `other`) and path |
| `a`, `c` | article id and its category ids (articles only) |
| `dev` | `mobile` / `tablet` / `desktop`, worked out on the server from the User-Agent, which is then thrown away |
| `src`, `ref` | `direct` / `search` / `social` / `referral` / `internal` / `email` / `campaign`, plus the referring **domain only** |
| `nv`, `en` | first visit ever by this visitor (new) · first view of the session (entry) |
| `e` | **active** seconds (see below), only ever raised (`$max`) |
| `sd` | furthest scroll depth 0–100 on the article body, only ever raised (`$max`) |

Indexes: `{day, a}`, `{day, k}`, `{a, day}`, `{ls}` (realtime), `{s}`, plus a TTL index on `t`.

`analytics_daily` holds one document per (day, page key, device, source, new/returning)
with summed counts: views, active seconds, scroll buckets, reads reaching
25/50/75/90 %, sessions, engaged sessions and bounces. It is written for a day
once that day has closed plus a 2-hour grace period. It is built **lazily the
first time a dashboard asks for that day**, so it needs no cron, which the DO
deployment doesn't have. Today, and any day not yet rolled up, is read from the
raw views. Unique visitors over a range always come from raw views (exact
`distinct`), so ranges reaching past the TTL show "unavailable" for uniques,
never a made-up number.

### Measuring active reading time (client)

- The clock ticks once a second **only while all of these hold**: the tab is
  visible (`visibilitychange`), the window has focus, and the reader did
  something (scroll, key, pointer, touch, wheel) in the last **30 s**, or a
  video or audio element on the page is playing.
- Hidden tab, minimised window, a switch to another app, or idle → paused.
  Coming back resumes the same view. Capped at 4 h per view.
- Scroll depth is measured against `.reader-body` on articles (as
  `ReadTracker` already does) and against the document elsewhere. It only ever
  rises.
- **Sending:** `start` on mount, `ping` every 30 s while visible, and `end` on
  `visibilitychange→hidden` / `pagehide` (via `navigator.sendBeacon`, which
  survives the page closing) and on client-side route changes (unmount). Every
  message carries the totals so far, not deltas, and the server stores them with
  `$max`. Repeated, late or out-of-order messages therefore can't inflate
  anything.
- **No duplicates:** the view id is created once per page mount (kept in a ref,
  so React re-renders and StrictMode's double effects reuse it). The server
  upserts on that id, so a retried `start` is the same view. A new route is a
  new view. A back/forward-cache restore resumes the old view.
- **Source on client-side navigation:** `document.referrer` still points at the
  original external site after an in-app navigation, so every view after the
  first in a page load is `internal`.

### Sessions, bounce and engagement (GA4 definitions)

- A session ends after 30 minutes without activity.
- A session is **engaged** if it had 10 s or more of active time **or** two or more page views.
- **Engagement rate** = engaged sessions ÷ sessions. **Bounce rate** = 1 − engagement rate.

### Privacy

- No names, emails, IP addresses or User-Agent strings are stored. Visitor and
  session ids are random, carry no meaning, are first-party, and are not cookies.
- Signed-in staff are not counted (the admin session cookie is checked on the
  server), and neither are bots (User-Agent list + `navigator.webdriver`).
- **Opt-out:** a "Share anonymous reading statistics" switch on `/settings`,
  on by default. A browser sending **Global Privacy Control** or **Do Not
  Track** is treated as opted out, and nothing at all is sent.
- The old optional Google Analytics forwarding (`GA_MEASUREMENT_ID`) is removed:
  it sent reader ids to a third party.
- The Privacy Policy page should mention this. That page is content in the CMS;
  suggested wording is at the end of this document.

### Admin APIs (staff only, cached)

All routes check `getAdminSession()` (401 if signed out, 403 unless the role
is **administrator**) and validate every filter against an allow-list. Results are cached for
60 s (today) or 10 min (past ranges) per filter combination, so several admins
refreshing don't multiply database load.

| Route | Returns |
|---|---|
| `GET /api/admin/analytics/summary` | cards (with previous-period comparison), daily series, categories, sources, devices, new/returning, insights |
| `GET /api/admin/analytics/articles` | sortable, searchable, paginated article table |
| `GET /api/admin/analytics/articles/[id]` | one article: totals, daily series, scroll funnel, sources, devices, new/returning, vs site average |
| `GET /api/admin/analytics/realtime` | active in the last 2 min, by article and kind (counts only) |

Filters: `from`/`to` (presets today, 7, 30, 90 days, custom), `category`, `article`,
`device`, `source`, `visitor` (new/returning).

## Dashboard (admin → new "Analytics" tab)

1. **Filter bar:** date range presets + custom, category, device, source, new/returning, compare to the previous period.
2. **Cards:** page views, unique visitors, total reading time, average active time per article view, completion rate (≥ 90 %), engagement rate / bounce rate, new vs returning. Each shows the change against the previous period.
3. **Time series:** views and reading time per day.
4. **Live now:** active readers, plus the articles being read with reader counts. Refreshes every 15 s while visible.
5. **Categories:** views, average time and completion per category, for comparing content types.
6. **Sources & devices** breakdowns.
7. **Insights:**
   - Trending: biggest rise vs the previous period.
   - Losing engagement: biggest drop.
   - Skimmed: many views, little reading time.
   - Hidden gems: few views, high engagement.

   Each insight needs a minimum number of views before it lists an article, so a
   single read can't top a list.
8. **Article table:** search, sort by any column, paging. Columns: title, category, published, views, visitors, average time, total time, average scroll, completion.
9. **Article detail** (drawer):
   - Daily trend.
   - **Scroll funnel** 25/50/75/90/100 %, showing where readers stop.
   - Sources, devices, new/returning.
   - Comparison with the site average.

Every panel has loading, empty ("no reads in this range yet") and error states.
A metric that can't be computed shows **"—" with a reason**, never 0. The page
states when collection began, so nobody reads an empty past as "no readers".

## Stages (each verified before the next)

| # | Stage | Verified by |
|---|---|---|
| 1 | **Collection:** `lib/tracker.ts` (active clock, scroll, ids, beacons) + `<PageView>` on every public page type, replacing `ReadTracker`'s analytics part (its "continue reading" part stays). `api/analytics/collect` + `lib/analytics/store.ts` + indexes | Unit tests for clock/visibility/idle logic (fake timers), source/device classification, payload validation, upsert/`$max` idempotency (mongodb-memory-server) |
| 2 | **Queries:** `lib/analytics/query.ts` (summary, series, breakdowns, table, detail, realtime, insights) + lazy rollups + caching | Tests on seeded views with hand-computed expected numbers; rollup = raw results for the same day; timing test on 1M synthetic views |
| 3 | **Admin APIs** | Route tests: 401/403, filter validation, response shape |
| 4 | **Dashboard UI** (Analytics tab), Overview reader card switched to the new queries, old store removed | typecheck, lint, build; browser check at desktop and phone widths |
| 5 | **Opt-out** switch in `/settings`, GPC/DNT handling | Tests + browser check that an opted-out browser sends nothing |
| 6 | **End to end:** extend `scripts/e2e-local.mjs`. A real browser reads an article (scrolls, idles, hides the tab, navigates in-app), then the dashboard API and UI show exactly those numbers | e2e + visible browser walkthrough |

### Results (2026-10-28)

- **Unit and route tests:** 354 pass (`npm test`), including active clock,
  classification, store idempotency, aggregation (rollup = raw), filters,
  reports and the admin routes' 401/403.
- **End to end:** `scripts/e2e-local.mjs` 60/60 on a production build in
  Mongo mode, no request reached WordPress. The analytics checks: one view per
  page with the largest totals, no IP or browser string stored, crawlers and
  signed-in staff dropped, the dashboard showing the article with its real
  numbers, editors refused (403) and left without the Overview reader card.
- **Browser:** the tracker's active time matched a timed read; an opted-out
  browser and one sending GPC sent nothing; the dashboard, the article drawer and
  the Overview reader card checked at 1280, 768 and 375 px with no horizontal
  page scroll (the article table keeps Article, Views and Avg. time on phones).
- **Load:** `ANALYTICS_BENCH=1 npx vitest run src/lib/analytics/bench.test.ts`
  on 300,000 views (30 days × 10,000) against a local mongod: the first 30-day
  summary, read from the raw views, took 10.6 s and queued the rollups, which
  built in the background (15.9 s unpaced); after that 1.3 s, and the article
  table 0.22 s. Reports are cached for 60 s (10 min when today is not in range),
  so readers' beacons and the dashboard share Atlas Flex's 100 ops/s.

### Changes after code review (2026-10-28)

- The dashboard now leads with **which articles and categories get the reading
  time** (top 10 articles by total active time; categories by active time and
  share of it); Live now names each article's category and counts readers per
  category; the eight totals moved into one compact "Site totals" panel.
- Dropdowns are Radix Select (`app/admin/Select.tsx`), portalled above the admin
  shell (`z-[150]`, like the other admin menus; the shell itself is `z-[100]`).
- Collect: the rate limit keys on the edge's client address
  (`lib/client-address.ts`, shared with the login route), not the spoofable left
  end of X-Forwarded-For; a per-instance cap of 40 writes a second
  (`ANALYTICS_MAX_WRITES_PER_SECOND`); bodies read with a size cap; `Sec-GPC`,
  `DNT` and cross-site `Sec-Fetch-Site` requests dropped; an index-creation
  failure no longer blocks writes.
- Rollups are built off the request, one day at a time, in paced batches of 50
  (`ANALYTICS_ROLLUP_PAUSE_MS`, default 1 s); until a day's is written its raw
  views answer for it, so no report waits and a half-written rollup is never
  counted. The first beacon after 02:00 IST queues yesterday's, so every day is
  rolled up before its raw views expire.
- Pings only go out while reading time grows, so a tab left open unread costs no
  writes and doesn't show as live.
- No comparison when collection covers only part of the previous period; custom
  dates must be real dates; the access check needs `is_active` like the login;
  the article table queries once per filter set and sorts and pages in memory.

### Known notes

- Analytics only record where `MONGODB_URI` is set; without it beacons answer
  503 and nothing is kept. Nothing is recorded from `next dev` or from
  `ANALYTICS_DISABLED=1` runs (the local launcher sets it), so testing against the
  real database never counts as readers.
- Collection starts on deploy: earlier days show as "collection began", never
  as zero readers. The old Redis/file reader data is not migrated (it measured
  wall-clock time, not active time).
- Once, in the first browser run, an article view was stored with 12 s against
  about 45 s read; clean reruns matched. Not reproduced since; watch the first
  real days for article times that look low.
- Unique visitors are exact from raw views, so ranges reaching past the 400-day
  retention show "not available" for them rather than a guess. They scan every
  raw view in the range, so long ranges on a busy site are the slowest query.
- Open from the review: a range ending today is compared with a full previous
  period, so "Today" reads low against yesterday until evening; page paths and
  ids in beacons are not checked against real content (the rate limits bound
  how many a client can invent); a session crossing IST midnight counts as two
  in rollups.

## Suggested Privacy Policy wording

> We count how our pages are read: which pages are opened, for how long they are
> actively read, how far down they are scrolled, the kind of device and the
> website that linked to us. We use a random identifier stored in your browser to
> tell new from returning readers. We do not store your name, email, IP address
> or browser details, and we do not share this data with anyone. You can switch
> this off at any time in Settings, and we honour your browser's Global Privacy
> Control and Do Not Track signals.
