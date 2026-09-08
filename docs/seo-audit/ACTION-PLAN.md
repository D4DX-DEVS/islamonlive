# Action plan — islamonlive.in headless migration

Audit of the production build on 2026-09-08 (seven `seo-audit` agents, 725-URL migration audit, hand probes), then a fix pass on everything the frontend owns. Per-category evidence is in `findings/`; the aggregate is in `FULL-AUDIT-REPORT.md`.

Legend: **Done** = fixed in this repository and verified against `next start`; **WordPress** = a change in the CMS (Yoast, settings, content); **Editorial** = writing; **Cloudflare / DNS / Vercel** = hosting; **Decision** = the publisher has to choose.

## Phase 1 — before cutover (this week)

| # | Item | Owner | Status |
|---|---|---|---|
| 1.1 | Category/tag title doubled the site name and tagline (`News Islamonlive.in \| … \| Islamonlive.in \| …`) | Frontend | **Done** — `cleanTitle()` in `src/lib/seo.ts`; archives now read `News \| Islamonlive.in`, page N `News - Page 2 \| Islamonlive.in` |
| 1.2 | Home page had no Open Graph tags; About/Contact shared the home description | Frontend | **Done** — site-wide OG/Twitter defaults in `layout.tsx`, own descriptions + AboutPage/ContactPage nodes |
| 1.3 | Articles, archives and WP pages were rendered on every request (no ISR, `Cache-Control: private, no-store`) | Frontend | **Done** — `generateStaticParams()` on every content route; archive pagination moved from `?page=` to `/page/N/` so the routes never read `searchParams` |
| 1.4 | `dateModified` missing on 2 of 3 articles; `inLanguage: en-GB` on every Yoast node; Organization logo/name/SearchAction differed between home and interior pages; `ProfilePage.mainEntity` missing | Frontend | **Done** — `normalizeGraph()` in `src/lib/seo.ts` rewrites Yoast's graph at every depth |
| 1.5 | Legacy `?p=`/`?s=` needed two hops; `/page/1/` and wrong-path archives | Frontend | **Done** — `src/proxy.ts` single 301; `/:path+/page/1` 301 in `next.config.ts` |
| 1.6 | `page-sitemap.xml` advertised Elementor template pages (500) and pages this app 301s | Frontend | **Done** — each WP page is checked with the same fetch the page route makes; `about`, `contact`, `authors-list` always kept |
| 1.7 | Security headers: only three were set | Frontend | **Done** — HSTS (2 y), `Permissions-Policy`, CSP `frame-ancestors 'self'` added. A full CSP is an open item (see 3.6) |
| 1.8 | Elementor template pages `/elementor-122398/`, `/elementor-122411/`, `/elementor-119103/` answer 500 from WordPress | WordPress | **Pending** — trash them or set noindex in Yoast. The sitemap no longer lists them; the URLs themselves still 500 until WordPress is cleaned |
| 1.9 | `admin.islamonlive.in` DNS, `.env` on Vercel, Cloudflare proxy for the apex, `REVALIDATION_SECRET` in the WP plugin | Cloudflare / DNS / Vercel | **Pending** — `docs/MIGRATION.md` §3–§5 |
| 1.10 | Warm the 33 sitemap files right after deploy (cold render up to 18 s) | Vercel (deploy step) | **Done (tooling)** — `node scripts/warm-sitemaps.mjs https://islamonlive.in`; run it after every deploy |
| 1.11 | Cloudflare "managed robots.txt" would prepend a second copy of the AI block | Cloudflare | **Decision** — switch it off for the apex, or set `ROBOTS_CLOUDFLARE_MANAGED=1` on Vercel |

## Phase 2 — first two weeks after cutover

| # | Item | Owner | Status |
|---|---|---|---|
| 2.1 | Visible breadcrumb trail, author bio in the author box, "Updated" date, trailing-slash byline links | Frontend | **Done** — article template |
| 2.2 | Crawlable Previous/Next links under every archive (the scroll-loading list was invisible to crawlers) | Frontend | **Done** — `InfiniteFeed` renders real `/page/N/` links; the Next link follows the pages already loaded |
| 2.3 | Search: relevance ordering, both Malayalam spellings, honest empty state, `Search: “q”` title and h1 | Frontend | **Done** |
| 2.4 | Organization entity: `sameAs` with YouTube and Instagram, founding date, office address, editorial email, parent D4 Media, on the hand-built node and merged into Yoast's | Frontend | **Done** — `organizationDetails()` in `src/lib/schema.ts` |
| 2.5 | Home page h1 was the rotating top story | Frontend | **Done** — the site is the h1 (visually hidden), stories are h2 |
| 2.6 | YouTube embed (~700 KB of script) loaded with the first screen of the home page | Frontend | **Done** — click-to-play facade in `WatchPanel` |
| 2.7 | Yoast archive description template has typos ("compelete", "middile") and Yoast titles carry the tagline on every post | WordPress (Yoast → Search Appearance) | **Pending** — the frontend strips the doubled tagline from archive titles and ignores the template description, but article titles still come from Yoast |
| 2.8 | WordPress site language is `en-GB` (source of `inLanguage`) — set to Malayalam | WordPress (Settings → General) | **Pending** — the frontend overrides to `ml` meanwhile |
| 2.9 | Meta descriptions truncated mid-sentence ("…breathtaking."), in English on Malayalam posts, or `Title \|` only; privacy-policy description off-topic | Editorial (Yoast per post) | **Pending** — the frontend trims to a word boundary only when Yoast has nothing usable |
| 2.10 | Articles bylined to the `islamonlive` admin account; authors without a bio | Editorial | **Pending** |
| 2.11 | Resubmit `sitemap_index.xml` in Search Console, connect YouTube/Instagram as GSC platform properties, verify Bing Webmaster Tools | Publisher | **Pending** |

## Phase 3 — content and authority (month 2)

| # | Item | Owner | Status |
|---|---|---|---|
| 3.1 | In-body H2/H3 on analytical articles; a 2–4 sentence Malayalam takeaway at the end; linked sources for historical claims | Editorial | **Pending** — highest-weighted GEO lever |
| 3.2 | Featured images below 696 px wide (several sampled: 650, 400, 289 px); a 1200×630 default social image for the thousands of old posts without one | Editorial / design | **Pending** — drop the file in `public/` and change the fallback in `src/lib/seo.ts` |
| 3.3 | AI-crawler policy: GPTBot and ClaudeBot are blocked (training *and* ChatGPT/Claude search); OAI-SearchBot/PerplexityBot open by omission | **Decision** | The current robots.txt reproduces the live site. To allow AI search referrals without training, drop GPTBot/ClaudeBot from `BLOCKED_AI_AGENTS` in `src/app/robots.txt/route.ts` and add explicit `Allow` groups — one-line change once decided |
| 3.4 | `/watch/` post type and the `jet-menu` CPT had their own Yoast sitemaps | WordPress | **Pending** — `/watch/*` is 301'd to `/watch-videos/`; the jet-menu CPT is plugin data. Mark the CPT noindex in Yoast; nothing to add on the frontend |
| 3.5 | Podcast artwork (880 KB from the podcast host's CDN) and Instagram preview images are hot-linked at original size | Frontend | **Pending** — route through the media proxy once the artwork host is fixed; Instagram URLs are signed and cannot be resized |
| 3.6 | Full Content-Security-Policy (script/frame/img allow-list for YouTube, Instagram, OneSignal, WP uploads) | Frontend | **Pending** — needs page-by-page testing in report-only mode first |
| 3.7 | Pinch-zoom disabled by the viewport meta (`maximum-scale=1, user-scalable=no`) — fails WCAG 1.4.4 and Lighthouse's accessibility audit | **Decision** | One line in `src/app/layout.tsx`; the layout comment says it was deliberate |
| 3.8 | Header/utility tap targets under 44 px at tablet/desktop; 12–14 px card bylines on phones | Frontend (design) | **Pending** — Lighthouse only scores tap targets on mobile, where they pass; design call |
| 3.9 | Google "set as preferred source" button on home and article templates | Frontend | **Pending** — needs the exact snippet from Search Central (published 2026-08-20); not guessed |

## Phase 4 — monitoring (ongoing)

- Search Console: Coverage (soft 404s, redirect errors), Core Web Vitals field data (the lab mobile LCP numbers cannot be trusted for a CDN-fronted site), Sitemaps (33 files, counts stable).
- `node scripts/url-audit.mjs --base https://islamonlive.in --urls <sample>` monthly against the original Yoast sitemaps; exit code 1 on any issue.
- `node scripts/warm-sitemaps.mjs https://islamonlive.in` after every deploy.
- Re-run the seven audit agents (`/seo-audit`) after the WordPress-side items land; the frontend scores in `FULL-AUDIT-REPORT.md` are estimates against the agents' rubric, not a fresh agent run.
