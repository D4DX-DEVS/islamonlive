# Backend migration plan: WordPress → MongoDB + DigitalOcean Spaces

Status: **draft, awaiting approval** · Owner: dev.d4dx · Last updated: 2026-10-27

## Goal

Run islamonlive.in with **no WordPress at all**. Content lives in MongoDB Atlas
(database `islamonlive`), files in DigitalOcean Spaces behind its CDN, and the
existing Next.js app serves both the public site and the admin panel.

**Hard requirement: zero SEO loss.** Every URL, redirect, title, description,
canonical, schema block, image URL, sitemap and feed that exists today must
behave identically after cutover, proven by a before/after crawl diff.

## Where we are

| Done | Detail |
|---|---|
| Data migrated and verified | MongoDB `islamonlive`: posts 22,363 (all statuses), pages 38, users 2,287, categories 81, tags 3,787, media 24,406, comments, menus, blocks, settings. All counts and content hashes match live WP. |
| Files migrated and verified | Spaces `d4dx-storage/islamonlive/wp-content/uploads/…`: 311,662 files, 6.43 GB. Every file served by the CDN with correct size/type/cache; 200/200 sample byte-identical to WP. |
| SEO data | Every published post has its Yoast head (title, description, canonical, OG, JSON-LD); all canonicals are `islamonlive.in`. |

Not yet migrated (needs the **Cloudways database export**): redirect rules
(Yoast Premium / Redirection plugin), user password hashes, revisions, plugin
data (view counts, form entries).

## What depends on WordPress today

- `src/lib/wordpress.ts`: every public read (posts, pages, categories, tags, users, search helpers).
- `src/lib/wp-admin.ts`: admin session + `wpAdminFetch` / `wpAdminRoute` proxy used by
  `src/app/api/admin/*` (posts CRUD, stats, duplicate, media upload/delete, categories,
  tags, users, featured video `rsfv/v1`, profile image `mpp/v2`, overview, activity).
- `src/lib/{wp-lookup,wpPage,search,sitemap,feed,content-status,admin-*}.ts`.
- `next.config.ts` proxy rules to `admin.islamonlive.in`: `/wp-content/*`, `/wp-includes/*`,
  `/feed*`, `/comments/feed`, and 301s for `/wp-admin`, `/wp-login.php`, `/xmlrpc.php`, `/wp-json/*`.

## Architecture

```
Browser ──► islamonlive.in (Next.js on DO App Platform)
              ├─ pages / API routes ──► src/lib/db/* ──► MongoDB Atlas "islamonlive"
              ├─ /wp-content/uploads/* ──(rewrite, same URL)──► Spaces CDN
              └─ /admin ──► own auth + src/app/api/admin/* ──► MongoDB + Spaces
```

- **No separate backend server.** The data layer is server-only modules inside Next.js.
- **Adapter, not rewrite.** New `src/lib/db/*` functions return the **same shapes**
  (`WPPost`, `WPCategory`, `WPUser`, …) as `wordpress.ts`, so pages and the admin UI
  barely change.
- **Switch:** `DATA_SOURCE=wordpress|mongo` in env. Rollback = flip and redeploy.
- **Caching:** keep the existing ISR / tag revalidation; MongoDB Flex is shared
  (100 ops/s), so every public read must be cached.

## Phases

Each task follows: tests first → implement → typecheck + tests + build →
independent review → merge. Lanes inside a phase touch **separate files** and run
in parallel (one agent per lane, each in its own git worktree/branch).

### Phase 0: Foundations (sequential, blocks everything)

| # | Task | Output |
|---|---|---|
| 0.1 | Move migration scripts out of the temp folder to `D:\Projects\islamonlive\migration\` (outside git; data stays there) | Re-runnable `sync-delta`, `spaces-copy`, `verify-mongo`, `cdn-check` |
| 0.2 | Branch `feat/mongo-backend`; add Vitest + `mongodb-memory-server`; seed fixtures from the export (≈200 posts covering every category, author, status, Elementor page) | `npm test` works offline, never touches the shared cluster |
| 0.3 | `src/lib/db/client.ts` (server-only, pooled, db `islamonlive` hard-coded), typed collections, `DATA_SOURCE` flag | Foundation for all lanes |
| 0.4 | **SEO baseline crawl** of live site: every sitemap URL + GSC top/backlinked pages + old URL forms (`/?p=`, `/feed/`, images, `/page/N`, author, tag). Record status, redirect target, title, description, canonical, robots, OG, JSON-LD (normalised hash), H1, image URLs | `seo-baseline.jsonl`, the acceptance test for cutover |
| 0.5 | Import the Cloudways DB export (when provided): redirects → `redirects` collection, password hashes → `users.password_hash`, Yoast primary category, view counts | Closes the "full data" gap |

### Phase 1: Public site reads from MongoDB (parallel lanes)

| Lane | Scope | Files |
|---|---|---|
| A: Posts | `getPosts`, `getPostsPage`, `getPostBySlug`, `resolvePostByPath`, featured image/author/category helpers, `content-status` | `src/lib/db/posts.ts` |
| B: Taxonomy & people | categories, tags, `getUserBySlug`, `getUsersPage`, `searchUsers`, authors list | `src/lib/db/taxonomy.ts`, `users.ts` |
| C: Pages, search, lookups | `wpPage` (Elementor content), search (Atlas Search index or `$text`), `wp-lookup` (`/?p=ID`, `/go/`) | `src/lib/db/pages.ts`, `search.ts`, `lookup.ts` |
| D: Sitemaps, feeds, GEO | sitemap index + per-type + news sitemap from Mongo; **own RSS/Atom** at `/feed/`, `/feed/atom/`, `/comments/feed`; `robots.txt` AI-crawler rules; `llms.txt` | `src/lib/sitemap.ts`, `src/lib/feed.ts`, routes |
| E: Media & redirects | `/wp-content/uploads/*` rewrite → Spaces CDN (URL unchanged for Google Images/backlinks); `imageLoader` + `remotePatterns`; DB-driven redirects from 0.5 | `next.config.ts`, `src/lib/imageLoader.ts`, middleware |

**Gate 1 (all must pass):**
1. Unit tests per lane, `tsc`, `eslint`, `next build`.
2. Deploy to **staging** with `DATA_SOURCE=mongo`; re-crawl; diff vs `seo-baseline.jsonl` = **0 unexplained differences**.
3. Spot-check rendering (Playwright screenshots of home, category, article, author, tag, search, mobile).
4. Performance no worse than today (TTFB, LCP on 10 key pages).
5. Independent code + security review.

### Phase 2: Admin panel writes to MongoDB (parallel lanes)

| Lane | Scope |
|---|---|
| F: Auth | Login against `users` (verify WP phpass/bcrypt hashes, re-hash on login), sessions (reuse `createAdminSession` cookie), roles/capabilities, password reset email, rate limit + lockout |
| G: Posts | list/query/stats/duplicate/create/update/delete; slug uniqueness; path from primary category; HTML sanitisation; **scheduled posts** (cron publishes `future` posts); Yoast-equivalent SEO fields editable |
| H: Media | Upload to Spaces (`islamonlive/wp-content/uploads/YYYY/MM/…`, public-read, immutable cache), media records, delete; featured image |
| I: Taxonomy, authors, extras | categories/tags/users routes, featured video (replaces `rsfv/v1`), profile image (replaces `mpp/v2`), overview + activity |
| J: Side effects | cache revalidation on every write, push notification hook, sitemap/news-sitemap freshness |

**Gate 2:** Playwright e2e on staging (login → create → upload → publish →
appears on site, sitemap and feed → edit → delete), security review (auth,
uploads, injection), tests/typecheck/build green.

### Phase 3: Cutover

1. Announce a short **content freeze** on WordPress.
2. Run `sync-delta` + `spaces-copy` + `verify-mongo` (all checks pass).
3. Production: `DATA_SOURCE=mongo`, deploy.
4. Re-crawl production; diff vs baseline = 0.
5. Replace WP proxy rules in `next.config.ts` (`/wp-admin`, `/wp-login.php`, `/xmlrpc.php`, `/wp-json/*` → 410 or home).
6. Monitor 2–4 weeks: Search Console (coverage, 404s, rankings), server 404 log, Mongo ops/s.
7. Keep WordPress **read-only** for those weeks (rollback = flip flag). Then retire it,
   leaving a Cloudflare rule that 301s `admin.islamonlive.in/wp-content/*` to
   `https://islamonlive.in/wp-content/*` (the live site's images are indexed on that host).

### Phase 4: Cleanup and hardening

Remove WordPress code paths and env vars; rotate/remove `WP_ADMIN_*`; delete
web shells `sh.php` / `mul.php` on the old server before retiring; clean D1/R2
leftovers; confirm Mongo backups; alerts for 5xx/404 spikes; consider a dedicated
Atlas M10 if traffic grows (Flex is shared with ~15 apps).

## SEO / GEO checklist (applies to every phase)

- [ ] Same URL for every post, page, category, tag, author, pagination
- [ ] All existing 301s kept (`next.config.ts` + WP redirect rules from DB export)
- [ ] `/?p=ID`, `/feed/`, `/:path/feed`, `/amp` variants, `/wp-content/uploads/*` keep working
- [ ] Title, description, canonical, robots, OG/Twitter, JSON-LD identical
- [ ] Sitemaps at the same URLs, `lastmod` correct, news sitemap fresh
- [ ] RSS/Atom feeds valid
- [ ] `robots.txt` + `llms.txt` unchanged or improved; AI crawlers allowed
- [ ] Server-rendered HTML (no client-only content)
- [ ] Core Web Vitals not worse
- [ ] Search Console monitored after cutover

## Decisions (2026-10-27)

- **Staging:** local production build during development; a **Vercel** preview
  (password-protected, `noindex`) for the final pre-cutover check.
- **Logins:** only 2–3 admin/editor accounts. The first administrator's
  password is set with a CLI script (`scripts/admin-user.mjs`); after that, an
  administrator creates Editor and Administrator accounts from the admin's
  Authors page (Role field, temporary password stored as a scrypt hash). No
  email provider, no password-reset flow, no old hashes needed. Resetting a
  password, changing a role or disabling an account is still the CLI script.
  Other users stay as author profiles only (Authors cannot sign in).
- **Scheduled posts are used:** `future` posts count as published once their
  time passes (query-level), plus a cron hitting a protected route to revalidate
  pages, sitemaps and the news sitemap on time.
- **Yoast SEO Premium is active:** its redirect rules must be imported from the
  DB export before Gate 1. **IndexNow plugin is active:** the new backend pings
  IndexNow on publish/update, and the key file stays served.
- **Caching:** MongoDB reads go through `unstable_cache` with the existing
  `wp` / `wp:*` tags so `/api/revalidate` keeps working unchanged.

## Status (2026-10-27)

Phases 0–2 are built on `main` behind `DATA_SOURCE` (default `wordpress`, so
the deployed site is unchanged until the flag flips). Verified locally:

- **Unit tests:** 280 passing (`npm test`), against a throwaway mongod with the
  fixture slice. Feeds are byte-compared to the live feeds, and sitemaps to the
  WordPress path.
- **SEO crawl diff:** live site vs a local MongoDB-mode production build, over
  28.4k shared URLs (`migration/seo-diff.mjs`). Title, description, robots,
  canonical, OG, Twitter and JSON-LD are identical except for:
  - 20 tag pages that live 404s (a slug-encoding bug on live; MongoDB serves them).
  - WordPress-only endpoints that now 301 to `/admin/` or answer 410.
  - Feeds served directly (live 301s them to the WordPress host).
  - Authors with no photo show the placeholder icon. Live wrongly shows the
    article's image.
  - About 25 posts edited on WordPress since the export. `sync-delta` closes this.
- **End to end:** `scripts/e2e-local.mjs` passes 46/46 checks. It runs the
  full editor journey against a throwaway database, a fake Spaces and a fake
  WordPress that fails the run if any request reaches it: login rules,
  uploads, publish, sitemaps and feed, `?p=` links, edits, rename → 301,
  drafts, scheduling + cron, trash, `/go/` privacy, reader analytics.
- **Browser check (2026-10-27):** 15 page types compared live vs local
  MongoDB in Chromium: same status, title, H1, canonical, robots,
  description, og/twitter image, JSON-LD and first-page article lists; no
  broken images once Photon has fetched each file. The whole admin (login,
  dashboard, create with image, publish, edit + rename, duplicate, trash,
  create author, phone width) made zero WordPress requests.
- **Fixed by that check:** 91 pages whose og:image/twitter:image pointed at
  the CDN or `admin.islamonlive.in` instead of `islamonlive.in` (the crawl diff
  compared upload paths, not hosts), and the dashboard's most-read list,
  which still asked WordPress for dates and thumbnails.
- **Real Spaces:** `migration/spaces-probe.mjs` uploads a file with the admin's
  settings, reads it from the CDN and through Photon, and deletes it.
- **Visible walkthrough (19 steps):** login, articles, new article with
  inline image, tags, featured image and video, SEO, publish, edit + rename,
  schedule, duplicate, trash, create author, logout. It found two editor bugs,
  both fixed: the SEO card (Yoast title, description, focus keyword) had been
  left out of the form, which would have left no way to edit them once
  wp-admin is gone; and the first letter typed into an empty editor jumped to
  the end ("Test" → "estT").
- **Data check:** published articles 22,343, pages 28, categories 81 and tags
  3,787 match live WordPress exactly.
- **Home promo banner:** live shows none (the Elementor block is gone from the
  WordPress home page), so there is nothing to import.

Known gaps:

- **No restore-from-trash** in the admin UI (WordPress offered it in wp-admin).
  A trashed article can be restored only in the database.
- New uploads are stored without WordPress's resized copies. Pages use
  next/image and Photon, so nothing reads the sizes.
- In-article images load from the CDN (live loads them from
  `admin.islamonlive.in`). After cutover, `admin.islamonlive.in/wp-content/*`
  should 301 to `https://islamonlive.in/wp-content/*` (a Cloudflare redirect
  rule) so old image links and Google Images keep resolving.

Waiting on the team: Cloudways DB export (Yoast Premium redirects) and GSC
exports; then cutover (Phase 3).

## Needed from the team

1. **Cloudways database export** (.sql), needed before Gate 1 for Yoast Premium redirects.
2. **Google Search Console** exports to `D:\Projects\islamonlive\gsc\`:
   Links → Top linked pages, and Pages (indexing) → Export.

## Risks

| Risk | Mitigation |
|---|---|
| Shared Flex cluster throttles under spikes | Cache all reads (ISR); move to dedicated cluster if needed |
| Hidden URL forms with backlinks we don't know about | GSC links export + WP redirect table + 404 monitoring after cutover |
| Content published on WP during the build | `sync-delta` before staging tests and at cutover |
| Elementor page markup differs | Pages are rendered from stored HTML; covered by crawl diff |
| Old password hashes unavailable | Password-reset flow; DB export removes the need |
