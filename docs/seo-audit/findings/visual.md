# Visual / Mobile Audit — islamonlive.in (local production build, http://localhost:3686)

Audited: 2026-09-08. Tool: Python 3.14 + Playwright (Chromium, freshly installed for this run). All 9 pages x 3 viewports (375x812, 768x1024, 1280x900) = 27 page loads, each with a fresh browser context, console/pageerror/requestfailed listeners attached before navigation, viewport screenshot, and a ~3s settle window for layout-shift comparison (bounding-box diff of H1/hero image at t=0.5s vs t=3s, plus a `PerformanceObserver('layout-shift')` CLS accumulator injected via `add_init_script`). robots.txt returned 200 before starting. All 27 screenshots captured successfully; no page failed to load.

## Visual/Mobile Score: 80/100

Strong technical foundation (zero horizontal overflow, zero broken images, zero measured layout shift, zero console errors on real pages, no popups/interstitials, 16px body font everywhere) offset by two concrete usability/accessibility gaps (undersized header tap targets on tablet/desktop, a missing H1 on the search page) and two moderate content/typography issues (mislabeled author H1, sub-15px excerpt text on listing pages).

## Table: page x width -> overflow? / H1 above fold? / chrome height (px) / console errors

Chrome height = pixel offset from page top to `<main>` (i.e., combined header+nav height before content starts).

| Page | Width | Overflow? | H1 above fold? | Chrome height (px) | Console errors |
|---|---|---|---|---|---|
| Home (/) | 375 | No | Yes | 68 | none |
| Home (/) | 768 | No | Yes | 146.5 | none |
| Home (/) | 1280 | No | Yes | 146.5 | none |
| Culture: Great Mosque of Damascus | 375 | No | Yes | 68 | none |
| Culture: Great Mosque of Damascus | 768 | No | Yes | 146.5 | none |
| Culture: Great Mosque of Damascus | 1280 | No | Yes | 146.5 | none |
| Malayalam article (shariah/allah-knows...) | 375 | No | Yes | 68 | none |
| Malayalam article (shariah/allah-knows...) | 768 | No | Yes | 146.5 | none |
| Malayalam article (shariah/allah-knows...) | 1280 | No | Yes | 146.5 | none |
| /category/news/ | 375 | No | Yes | 68 | none |
| /category/news/ | 768 | No | Yes | 146.5 | none |
| /category/news/ | 1280 | No | Yes | 146.5 | none |
| /author/admin/ | 375 | No | Yes (text="islamonlive", see Medium finding) | 68 | none |
| /author/admin/ | 768 | No | Yes (text="islamonlive") | 146.5 | none |
| /author/admin/ | 1280 | No | Yes (text="islamonlive") | 146.5 | none |
| /authors-list/ | 375 | No | Yes | 68 | none |
| /authors-list/ | 768 | No | Yes | 146.5 | none |
| /authors-list/ | 1280 | No | Yes | 146.5 | none |
| /search/?q=quran | 375 | No | **No H1 found** | 68 | none |
| /search/?q=quran | 768 | No | **No H1 found** | 146.5 | none |
| /search/?q=quran | 1280 | No | **No H1 found** | 146.5 | none |
| /this-page-does-not-exist/ (404) | 375 | No | Yes | 68 | 1x "Failed to load resource: 404" (expected — the 404 itself) |
| /this-page-does-not-exist/ (404) | 768 | No | Yes | 146.5 | 1x "Failed to load resource: 404" (expected) |
| /this-page-does-not-exist/ (404) | 1280 | No | Yes | 146.5 | 1x "Failed to load resource: 404" (expected) |
| /about/ | 375 | No | Yes | 68 | none |
| /about/ | 768 | No | Yes | 146.5 | none |
| /about/ | 1280 | No | Yes | 146.5 | none |

Notes: `document.documentElement.scrollWidth` == `window.innerWidth` on every single row (0px overflow amount) — no page-level horizontal scroll anywhere. Chrome height (header+nav) is 68px at mobile (8.4% of the 812px viewport) and 146.5px at 768/1280 (14.3%/16.3% of viewport height) — compact, does not dominate the first screen. CLS proxy score was 0 and H1 position shift between t=0.5s/t=3s was 0px on every measurable row (search excluded, no H1 to track).

## What Works

- Zero horizontal overflow on all 27 page x width combinations — fully responsive at 375/768/1280, no layout breaking.
- Zero broken images: every `<img>` positioned above the fold (2-36 per page depending on layout) had `naturalWidth > 0` on every page/width — featured images and card thumbnails all load correctly, including on the Malayalam article and both listing/archive pages.
- Zero layout shift measured: `PerformanceObserver('layout-shift')` CLS accumulator was 0 and H1/hero-image bounding-box position did not move between the 0.5s and 3s checkpoints on any page.
- Zero JS console/page errors on all 8 non-404 pages. The 404 page correctly returns HTTP 404, shows a friendly "We can't find that page" H1 above the fold at all 3 widths, and its only console entry is the expected 404 resource-load message.
- No cookie banners, interstitials, or fixed/sticky overlays covering >30% of the viewport were detected on any page/width — content is immediately visible on load.
- Computed `body` font-size is 16px on every page/width tested, comfortably above the 15px mobile legibility floor.
- H1 is above the fold at mobile (375px) on 8 of 9 pages without any scrolling.
- The Malayalam article (first `<loc>` in post-sitemap23.xml, English slug but confirmed Malayalam `<title>` and body text via Unicode-range check) renders its Malayalam headline and body copy correctly at all 3 widths with 18.4px paragraph text — the best-performing page for typography.

## Findings (Critical > High > Medium > Low > Info)

**HIGH — Search results page has no `<h1>` at all.** `/search/?q=quran` returned `h1 found: False` at 375px, 768px, and 1280px alike (confirmed via `document.querySelector('h1')` returning null). This is not just "below the fold" — no H1 exists anywhere on the rendered page. Evidence: screenshots `search-375.png`, `search-768.png`, `search-1280.png`; raw eval result `{"found": false}` for all 3 widths. Recommendation: add a visible `<h1>` (e.g., "Search results for 'quran'") to the search results template so the page has a proper heading landmark for SEO and screen-reader navigation.

**HIGH — Header/utility-bar tap targets are undersized at tablet and desktop widths.** At 768px, 11 of 22 detected nav/header interactive elements measured below the 44x44px minimum; at 1280px, 18 of 27 did. Concrete examples from the home page (`home-768.png`, `home-1280.png`, pattern repeats identically on all 9 pages since it's the shared header): "My Library" icon 20x20px, "Search" icon 20x20px, "Support Us" button 111x34px (height only 34px), and the Facebook/X/YouTube/Instagram/Telegram social icons at 15x15px each. Recommendation: increase the clickable hit-area (via padding, not just visual icon size) of the utility-bar icons and social icons to at least 44x44px, and increase the "Support Us" button height to at least 44px, at both the 768px and 1280px breakpoints.

**MEDIUM — Author archive page H1 reads "islamonlive" instead of the author's name.** `/author/admin/` renders an H1 with text exactly `"islamonlive"` at all 3 widths (375/768/1280) instead of the expected author display name (e.g., "admin"). Evidence: `author-admin-375.png`, `author-admin-768.png`, `author-admin-1280.png`; H1 text captured as `'islamonlive'` in all three eval runs. Recommendation: fix the author-archive template to render the author's display name (or "Admin") as the H1 instead of falling back to the site name.

**MEDIUM — Card excerpt/byline text renders below the 15px mobile legibility floor on listing-style pages, even though `body` itself is 16px.** Measured the first `<p>` on each page at 375px: home byline "അബ്ദുസ്സലാം പുലാപ്പറ്റ · 08/09/2026" = 12px (`home-375.png`); `/category/news/`, `/author/admin/`, `/search/?q=quran`, `/this-page-does-not-exist/` excerpt text = 14px; `/authors-list/` meta line "2236 writers · page 1 of 38" = 14px. By contrast, real article body copy on the two single-post pages (`culture-mosque-375.png`, `ml-article-375.png`) is 18.4px, and `/about/` body copy is 15px (right at the floor). Recommendation: raise card byline/date and excerpt text to at least 15px (ideally 16px) on mobile across the home feed, category/author archives, authors-list, search results, and 404 template.

**LOW / INFO — Every page shows several `net::ERR_ABORTED` failed requests for Next.js RSC prefetch URLs (`?_rsc=...`).** Between 2 and 20 such failed requests were logged per page/width (e.g. `home-375.png` load: `http://localhost:3686/opinion/presents-dr-mohamed-badie/?_rsc=...` etc.), on all 27 runs. These did not surface as console errors and did not affect rendered content, broken images, or CLS — most likely benign Next.js `<Link>` prefetch requests that were cancelled when the test closed the browser context ~3.5s after load, rather than a user-facing defect. Flagging for awareness only; not scored as a rendering problem. Recommendation: if this is reproducible outside the audit script (e.g. visible in real browser DevTools Network tab during normal navigation), investigate prefetch-cancellation noise; otherwise no action needed.

**INFO — Mobile logo/wordmark link is 103x28px (28px tall, below 44px) at 375px.** Only 1 of 8 detected mobile nav elements failed the 44px check (the "islamonlive" text logo). Likely an acceptable design choice for a text wordmark rather than an icon button; not scored as a defect but noted since it was the sole mobile-width tap-target miss (`home-375.png`, `culture-mosque-375.png`, etc.).

All checks requested (overflow, H1-above-fold, chrome height, popup/interstitial detection, tap-target sizing, font legibility, image `naturalWidth`, layout-shift comparison, console errors) were run and verified on all 27 page/width combinations — nothing in scope was left unchecked.
