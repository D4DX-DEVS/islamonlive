# Performance Audit — islamonlive.in Next.js frontend (local production build)

**Target:** `http://localhost:3686` (`next start`, real production bundles, no CDN/edge — field data and CDN effects out of scope).
**Date:** 2026-09-08. **Method:** Lighthouse 13 CLI (desktop preset + mobile default preset) via local Chromium (Playwright), 2 runs/page, second (warm) run reported, first-run TTFB noted separately; raw curl for headers/compression checks.
**Coverage:** full 20/20 planned runs completed (5 pages × 2 form factors × 2 runs). This is **lab data only** — no CrUX/field 75th-percentile data available for localhost, so pass/fail below is against Lighthouse single-run lab measurements, not the field methodology.

## Performance Score: 83 / 100 (Lighthouse, average of all 10 completed page×form-factor warm-run scores)

Desktop average: 94.2 (87, 97, 97, 97, 93). Mobile average: 72.0 (60, 77, 80, 72, 71). This is a local, no-network-latency, no-CDN lab measurement — treat as a diagnostic, not a substitute for CrUX field data once deployed.

## Core Web Vitals status (warm run = run2, all 5 pages)

| Page | Form factor | LCP | CLS | TBT (INP lab proxy) |
|---|---|---|---|---|
| Home | Desktop | 1.80s — **Good** | 0.0015 — **Good** | 24.5ms — **Good** |
| Home | Mobile | 11.00s — **Poor** | 0 — **Good** | 133ms — **Good** |
| Culture (mosque article) | Desktop | 1.22s — **Good** | 0 — **Good** | 2.5ms — **Good** |
| Culture (mosque article) | Mobile | 5.95s — **Poor** | 0 — **Good** | 116ms — **Good** |
| Malayalam article (sitemap23 #1) | Desktop | 1.22s — **Good** | 0 — **Good** | 0ms — **Good** |
| Malayalam article (sitemap23 #1) | Mobile | 5.26s — **Poor** | 0 — **Good** | 41.5ms — **Good** |
| Category /news/ | Desktop | 1.30s — **Good** | 0 — **Good** | 0ms — **Good** |
| Category /news/ | Mobile | 9.81s — **Poor** | 0 — **Good** | 129ms — **Good** |
| Search ?q=quran | Desktop | 1.80s — **Good** | 0 — **Good** | 3.0ms — **Good** |
| Search ?q=quran | Mobile | 8.68s — **Poor** | 0 — **Good** | 111ms — **Good** |

**Pattern: 5/5 pages pass LCP+CLS+TBT on desktop; 5/5 pages fail LCP on mobile (all >4.0s "Poor"), while CLS and TBT stay Good on mobile too.** This is a mobile-throttling + payload-weight problem specifically, not a general rendering/layout-stability problem.

## Metrics table (warm run = run2)

| Page | FF | LCP | CLS | TBT | FCP | Speed Index | TTFB warm (cold run1) | Bytes | Requests | Score |
|---|---|---|---|---|---|---|---|---|---|---|
| / | Desktop | 1802.6ms | 0.0015 | 24.5ms | 1065.0ms | 1959.6ms | 65ms (14ms) | 5.44MB | 164 | 87 |
| / | Mobile | 10995.4ms | 0 | 133ms | 3911.7ms | 6787.9ms | 28ms (10ms) | 5.18MB | 119 | 60 |
| /culture/the-great-mosque-of-damascus/ | Desktop | 1222.2ms | 0 | 2.5ms | 350.5ms | 693.9ms | 44ms (24ms) | 1.33MB | 84 | 97 |
| /culture/the-great-mosque-of-damascus/ | Mobile | 5953.5ms | 0 | 116ms | 1296.4ms | 1585.4ms | 49ms (30ms) | 0.97MB | 49 | 77 |
| /shariah/allah-knows-what-is-truly-within-your-heart/ | Desktop | 1219.0ms | 0 | 0ms | 335.5ms | 500.1ms | 23ms (21ms) | 1.21MB | 85 | 97 |
| /shariah/allah-knows-what-is-truly-within-your-heart/ | Mobile | 5264.0ms | 0 | 41.5ms | 1215.5ms | 1215.5ms | 47ms (39ms) | 1.14MB | 56 | 80 |
| /category/news/ | Desktop | 1297.5ms | 0 | 0ms | 372.2ms | 531.0ms | 46ms (49ms) | 1.31MB | 94 | 97 |
| /category/news/ | Mobile | 9809.1ms | 0 | 129ms | 1362.6ms | 3737.0ms | 54ms (53ms) | 1.21MB | 62 | 72 |
| /search/?q=quran | Desktop | 1804.9ms | 0 | 3.0ms | 373.1ms | 717.2ms | 55ms (114ms) | 1.36MB | 97 | 93 |
| /search/?q=quran | Mobile | 8679.0ms | 0 | 111ms | 1864.0ms | 3850.4ms | 35ms (30ms) | 1.17MB | 61 | 71 |

Note: Lighthouse's `server-response-time` (TTFB, above) reads 23–65ms everywhere, but a separate raw curl `time_starttransfer` check (no Lighthouse throttling) measured higher and more variable TTFB, especially on `/search/?q=quran` (255–272ms across two curl requests) — see Finding 5.

Raw JSON (all 20 runs): `D:/Projects/islamonlive/frontend/docs/seo-audit/performance/{page}-{desktop,mobile}-run{1,2}.json`; parsed summary: `.../performance/summary.json`; run log: `.../performance/lh-progress.log`.

## What works

- **CLS is excellent everywhere: 0–0.0015**, far inside "Good" (≤0.1) — no layout-shift problems on any of the 10 page×form-factor combinations.
- **TBT (INP lab proxy) is Good everywhere on warm runs: 0–133ms**, well under even the 200ms "Good" TBT bound — no long-task/main-thread evidence.
- **render-blocking-resources: 0 flagged items** on every page checked (home, category-news mobile) — no classic render-blocking CSS/JS.
- `next/image` used correctly: `srcSet`, `sizes` (e.g. `220px`, `(max-width:1100px) 100vw, 1100px`), `loading="lazy"`, `decoding="async"`; correctly content-negotiates `image/webp` when the client accepts it.
- All 15 real `@font-face` rules use `font-display: swap` (no FOIT); `next/font` auto-generates size-adjusted "Fallback" faces to reduce swap-induced CLS.
- `/_next/static/chunks/*.css` and `/_next/static/media/*.woff2` correctly served `Cache-Control: public, max-age=31536000, immutable`.
- gzip compression active on HTML for all 5 pages.
- Homepage correctly uses ISR (`Cache-Control: s-maxage=60, stale-while-revalidate=31535940`, `x-nextjs-cache: STALE`, `x-nextjs-prerender: 1`).
- DOM size healthy everywhere checked: home ~1132, article ~428, category ~470 elements — under the 1,500 "excessive DOM" threshold.
- OneSignal push SDK found in **zero** of 20 completed Lighthouse `third-party-summary` audits and zero HTML source scans — it is not contributing measurable third-party weight on these 5 pages (or isn't installed/active on desktop-crawled contexts).

## Findings

### Critical

1. **Mobile LCP is Poor on all 5 pages: 5.26s–11.00s warm (threshold ≤2.5s Good, >4.0s Poor), while desktop LCP is Good everywhere (1.22–1.80s).** Evidence: CWV table above, all 10 mobile runs. Root cause (from `network-requests` breakdown, mobile warm runs):
   - **Home (worst, 11.00s):** total image weight 3.13MB out of 5.18MB page weight. Top offenders are **unoptimized third-party images/scripts**, none going through `next/image`: a podcast cover image from `d3t3ozftmdmh3i.cloudfront.net` (880KB), 3 Instagram preview images from `scontent.cdninstagram.com` (388KB + 382KB + 332KB ≈ 1.1MB combined), and YouTube player embed scripts (`player_embed_es6...js` 483KB + `ytembeds...js` 224KB ≈ 707KB).
   - **Category/article/search pages:** mobile payload is instead dominated by **web fonts** — e.g. on `/category/news/` mobile, 4 of the top 6 heaviest resources are `.woff2` files (60–90KB each, 469KB total font weight on that page).
   - Recommendation: (a) lazy-load/facade the Instagram and YouTube embeds below the fold (click-to-load placeholder instead of full embed on initial paint) so they don't compete with the LCP candidate for mobile bandwidth; (b) route the podcast cover image through `next/image`/the existing media proxy instead of hot-linking the CloudFront original; (c) reduce font payload per Finding 2 below; (d) give the actual LCP element `priority`/`fetchpriority="high"` if it isn't already. **Tag: frontend.**

2. **4 of 5 routes are fully dynamic — zero HTTP/CDN caching.** `/culture/the-great-mosque-of-damascus/`, `/shariah/allah-knows-what-is-truly-within-your-heart/`, `/category/news/`, `/search/?q=quran` all return `Cache-Control: private, no-cache, no-store, max-age=0, must-revalidate` with **no** `x-nextjs-cache` header — vs `/` which returns `s-maxage=60, stale-while-revalidate` + `x-nextjs-cache: STALE`. Evidence: curl header dump on all 5 routes. Locally this is masked (server responds in 20–270ms regardless, via internal data caching), but on Vercel it means every article/category/search request re-invokes the serverless function with no Edge/ISR reuse across visitors, and hits the WordPress origin more than necessary under real concurrent traffic. Recommendation: add `export const revalidate = <seconds>` to the article and category route segments so they render like the homepage; `/search/` being dynamic is expected (query-driven), but consider a short `s-maxage`/`stale-while-revalidate` if acceptable. **Tag: frontend** (Next.js route segment config).

### High

3. **Web fonts are a top-3 heaviest-resource category on mobile, 469–504KB across 4–10 files depending on page**, and the article route additionally sends a `Link: rel=preload` header for **10 separate font files** (verified on `/culture/the-great-mosque-of-damascus/`), spanning 4 Malayalam type families found in the CSS (`Noto Sans Malayalam`, `Anek Malayalam`, `Noto Serif Malayalam`, `Manjari` @400/@700 — 19 `@font-face` rules incl. auto-generated "Fallback" faces). All 10 preloads are high-priority and load concurrently with the LCP candidate on connections where LCP is already failing (Finding 1). Recommendation: preload only the 1–2 font files needed for above-the-fold content (body weight + 1 heading weight); set `preload: false` in `next/font` for the other families/weights and let them load on demand via the existing `font-display: swap`. **Tag: frontend** (`next/font` config, shared layout/fonts module).

### Medium

4. **Third-party embed weight on the homepage (~2MB: Instagram images + YouTube player scripts + podcast cover, detailed in Finding 1) has no facade/lazy pattern** — full embeds appear to load eagerly rather than on-scroll or on-interaction. Recommendation: use click-to-load facades for YouTube/Instagram embeds (e.g. `react-lite-youtube-embed`-style pattern) so the ~700KB of YouTube embed JS and ~1.1MB of Instagram preview images only load when a user actually scrolls to/interacts with them. **Tag: frontend.**

5. **`/search/?q=quran` TTFB is inconsistent between measurement methods and reaches 255–272ms via raw curl** (vs Lighthouse's own `server-response-time` reading of 30–114ms for the same route). Evidence: curl `time_starttransfer` 271.7ms then 255.1ms on two successive warm requests; Lighthouse desktop run1/run2 read 114ms/55ms, mobile run1/run2 read 30ms/35ms. The two methods disagree, so treat this as **needs re-verification**, not a confirmed regression — but the curl ceiling (255ms+) exceeds the ~200ms good-TTFB rule of thumb even with zero network latency locally, and is consistent with Finding 2 (`no-store`, no caching layer on this route). Recommendation: add short-TTL caching for search results and verify WordPress search query performance (indexes on `post_title`/`post_content` or a dedicated search plugin) if re-testing confirms the higher figure. **Tag: frontend** (caching) **+ WordPress origin** (query performance).

6. **`/_next/image/` proxy does not offer AVIF.** Evidence: requested the same optimized image URL with `Accept: image/avif,image/webp,...`; response was `Content-Type: image/webp` (never `image/avif`), while a plain request returned `image/jpeg`. WebP delivery works correctly, but AVIF (typically 20–30% smaller than WebP) is never offered. Recommendation: add `avif` to `images.formats` in `next.config` (`formats: ['image/avif','image/webp']`); note added origin CPU cost for transcoding. **Tag: frontend** (`next.config`).

7. **No Brotli compression observed.** All 5 pages returned `Content-Encoding: gzip` even when `Accept-Encoding: gzip, br, deflate` was sent. Brotli typically saves an extra 15–20% over gzip on text/HTML/JS/CSS. This is very likely a `next start`-on-localhost artifact (Node's built-in compression is gzip-only) rather than a code defect — Vercel's Edge Network applies Brotli automatically in production. Recommendation: re-verify `content-encoding: br` on the real Vercel deployment; no local frontend code change indicated. **Tag: Vercel** (verify on deployed environment).

8. **Unused JavaScript: ~62–64KB wasted per page** (Lighthouse `unused-javascript` `overallSavingsBytes`, home and category-news checked). Minor relative to the 1.1–1.3MB script weight per page, but a routine code-splitting/dependency review could recover it. **Tag: frontend.**

### Low

9. **`/_next/image/` responses use `Cache-Control: public, max-age=31536000, must-revalidate` instead of `immutable`.** Since the URL encodes source+width+quality, content at a given URL is effectively immutable, so `must-revalidate` forces unneeded conditional revalidation after the (already 1-year) max-age — low real-world impact, and it's Next.js's built-in image-optimizer default (not adjustable without a custom image loader/route). **Tag: frontend**, low actionability.

### Info

10. **OneSignal push SDK not detected** in the server-rendered HTML or in the Lighthouse `third-party-summary` audit of any of the 20 completed runs across all 5 pages. Either not installed on these routes, or registered purely via a service worker with no measurable main-thread/network footprint in these tests. **Tag: info.**
