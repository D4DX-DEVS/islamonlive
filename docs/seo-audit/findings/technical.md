# Technical SEO Audit — islamonlive.in Next.js Rebuild (Local Production Build, http://localhost:3686)

Date: 2026-09-08
Scope: Local production build only. All canonicals/og:url/sitemap/JSON-LD URLs intentionally use `https://islamonlive.in` (production host) — not flagged as a mismatch.

**Technical SEO Score: 76 / 100**

Audit was stopped before completing categories 8 (Images/next-image proxy) and 9 (Playwright mobile-overflow check) and a dedicated per-page security-header dump for `/` and an article; these are marked "Not checked" below rather than scored. The score reflects only what was verified.

---

## What Works

- `robots.txt` (200 OK) correctly disallows `/wp-admin/`, `/wp-login.php`, `/wp-signup.php`, `/xmlrpc.php`, `/wp-json/`, `/admin/`, `/api/`, `/*?replytocom=`, `/*?s=`; explicitly `Allow: /wp-content/uploads/` and `Allow: /`; declares `Sitemap: https://islamonlive.in/sitemap_index.xml`.
- robots.txt correctly blocks AI-training crawlers (Amazonbot, Applebot-Extended, Bytespider, CCBot, ClaudeBot, CloudflareBrowserRenderingCrawler, Google-Extended, GPTBot, meta-externalagent) with dedicated `Disallow: /` groups, consistent with a `Content-Signal: ai-train=no`.
- `sitemap_index.xml` and all 6 checked child sitemaps (`post-sitemap.xml`, `post-sitemap23.xml`, `category-sitemap.xml`, `post_tag-sitemap.xml`, `page-sitemap.xml`, `news-sitemap.xml`) return 200, are well-formed XML, and every `<loc>` uses `https://islamonlive.in/` with a trailing slash and correctly **lowercase** percent-escapes (verified 0 true uppercase-letter escapes across 1000+1000+297+79+28 URLs checked after fixing a false-positive in my own detection regex).
- All 6 sitemap XML endpoints correctly send `X-Robots-Tag: noindex`.
- Real 404s confirmed for `/this-page-does-not-exist/` and `/category/news/page/9999/` (status 404, not a soft-404).
- Legacy WordPress URL forms redirect correctly: `/?p=136123` → 301 (ultimately reaches a live article), `/?s=quran` → 301 → `/search/?s=quran&q=quran` (200, single hop), `/shariah/.../feed/` → 301 single hop to the article, `/shariah/.../amp/` → 301 single hop to the article.
- Trailing-slash normalization is consistent sitewide: any no-slash path (e.g. `/about`) → 308 → `/about/` (acceptable per Next.js `trailingSlash` behavior).
- Canonicals verified correct and self-referencing (pointing at the production host) on all 13 pages checked: `/`, `/culture/the-great-mosque-of-damascus/`, `/shariah/allah-knows-what-is-truly-within-your-heart/`, `/category/news/`, `/category/news/page/2/`, `/author/admin/`, `/authors-list/`, `/authors-list/?page=2`, `/about/`, `/contact/`, `/search/?q=quran`, `/saved/`, `/settings/`.
- `robots` meta correctly set to `noindex, follow` on `/search/?q=quran`, `/saved/`, `/settings/` — all three required noindex targets confirmed.
- SSR confirmed: fetching article pages with a plain Python `requests` call (no browser/JS) successfully returned full `<title>`, meta description, canonical, and one `application/ld+json` block in the raw HTML — content is not client-render-only.
- `<html lang="ml">` is present and consistent across every page checked (home, articles, category, author, listing, static, utility pages).
- Core security headers (`X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`, `X-Frame-Options: SAMEORIGIN`) present consistently on every response observed (robots.txt, all sitemaps, `/search/`).

---

## Findings

### Critical

1. **Duplicated title tag on category pages** — `/category/news/` (200) renders:
   `News Islamonlive.in | The one and only Comprehensive Islamic portal in Malayalam | Islamonlive.in | The one and only Comprehensive Islamic portal in Malayalam` (158 chars). The site name + tagline suffix is appended **twice**. This is a title-template bug, not just an over-long title — it will render as garbled, truncated, duplicate-looking snippets in search results for every WordPress category archive. Compare `/category/news/page/2/`, whose title is just `News - Page 2` (13 chars, no branding at all) — confirming the template is inconsistent across paginated vs. page-1 category views.
   **Recommendation:** Fix the title-generation logic for category archive pages (likely concatenating a page title that already includes the site name with the global title template again). Use a single template, e.g. `{{Category}} | Islamonlive.in`, applied once.
   **Owner:** Frontend (Next.js title/metadata generation for category routes).

### High

2. **Homepage missing Open Graph tags** — `/` (200) has no `og:url`, `og:type`, or other `og:*` meta tags (all other content pages checked — articles, category, author — have them). This degrades link-preview rendering on Facebook/WhatsApp/Twitter/LinkedIn/Telegram for the single most-shared URL on the site.
   **Recommendation:** Add `og:title`, `og:description`, `og:image`, `og:url`, `og:type=website`, `og:site_name` to the homepage `<head>`.
   **Owner:** Frontend (root `layout.tsx`/homepage metadata export).

### Medium

3. **Duplicate meta description across distinct pages** — `/`, `/about/`, `/contact/` (all indexable, `meta_robots` absent = default index,follow) all serve the identical fallback description: *"Comprehensive Islamic portal in Malayalam - news, opinion, columns, Shariah, Quran and more."* (92 chars). `/saved/` and `/settings/` also reuse it, but those are already noindex so lower priority.
   **Recommendation:** Write unique meta descriptions for `/about/` and `/contact/` instead of falling back to the sitewide default.
   **Owner:** Frontend (page-level `generateMetadata`/static metadata for `/about`, `/contact`).

4. **Two-hop redirect chains on legacy WordPress URL forms** (task requires ≤1 hop):
   - `/?p=136123` → 301 → `/go/post/136123/?p=136123` → 301 → `https://islamonlive.in/opinion/presents-dr-mohamed-badie/` (confirmed 200 on the equivalent localhost path). Two 301 hops instead of one.
   - `/authors/admin` → 308 → `/authors/admin/` → 301 → `/author/admin/` (confirmed 200). One 308 (trailing-slash, acceptable) + one 301 (plural→singular) = two hops to the canonical author URL.
   **Recommendation:** Collapse each into a single redirect straight to the final destination (`/?p=136123` → 301 directly to the post URL; `/authors/admin` → 301 directly to `/author/admin/`).
   **Owner:** Frontend (Next.js `redirects()`/middleware rules — currently layered/chained rather than resolving in one hop).

5. **Mobile viewport disables pinch-zoom** — `<meta name="viewport">` on every page checked is `width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover`. `maximum-scale=1` + `user-scalable=no` blocks pinch-to-zoom, which fails Lighthouse's mobile-friendliness/accessibility audit and WCAG 1.4.4 (Resize Text).
   **Recommendation:** Remove `maximum-scale=1, user-scalable=no` (keep `width=device-width, initial-scale=1, viewport-fit=cover`).
   **Owner:** Frontend (root viewport meta, likely in `layout.tsx` or `viewport` export).

6. **`category-sitemap.xml`, `post_tag-sitemap.xml`, `news-sitemap.xml` missing `<lastmod>` on every entry** — verified 0/79, 0/1000, and 0/2 entries respectively have a `<lastmod>` element (vs. 1000/1000, 297/297, and 28/28 present in `post-sitemap.xml`, `post-sitemap23.xml`, `page-sitemap.xml`). Reduces crawlers' ability to prioritize re-crawls of changed category/tag/news pages.
   **Recommendation:** Populate `<lastmod>` for these three sitemap types the same way the post/page sitemaps do.
   **Owner:** Frontend if these sitemaps are generated by the Next.js app; WordPress/Yoast if they are proxied through from the WP backend (need to confirm which side generates them — not determined in this audit).

### Low

7. **`og:url` on paginated category page points to page 1, not itself** — `/category/news/page/2/` has a correct self-referencing `canonical` (`https://islamonlive.in/category/news/page/2/`) but `og:url` is `https://islamonlive.in/category/news/` (page 1). Canonical and og:url should agree.
   **Recommendation:** Set `og:url` to the current page's URL (including `/page/2/`), matching the canonical.
   **Owner:** Frontend (category route metadata).

8. **Non-standard `Content-Signal` directive value** — robots.txt sends `Content-Signal: search=yes,ai-train=no,use=reference`. Per the referenced spec (contentsignals.org, linked in the file's own header comment), the only defined signals are `search`, `ai-input`, and `ai-train` (values `yes`/`no`). `use=reference` is not part of the documented syntax and `ai-input` is not set at all.
   **Recommendation:** Confirm intent — likely meant `ai-input=no` — and drop/replace `use=reference` if it isn't a recognized directive, so parsers don't silently ignore the whole line.
   **Owner:** WordPress (robots.txt is served with this content already, needs confirmation of whether it's WP/plugin-generated or hardcoded in the Next.js app — not determined in this audit).

### Info

9. **404 page body is a client-rendered shell** — `/this-page-does-not-exist/` correctly returns HTTP 404 with a real `<title>`, but the response body is Next.js's `NEXT_HTTP_ERROR_FALLBACK` shell (from `notFound()` thrown in a dynamic segment), not fully SSR'd content. Status code and indexability signal are correct; this is a rendering-strategy note, not a defect.
   **Owner:** N/A (informational).

10. **`/feed/`-pattern and `/wp-content/*` proxy paths return 404 in this local build only** — because `WORDPRESS_API_URL` and `NEXT_PUBLIC_SITE_URL` both point at `islamonlive.in` in this environment, which disables the split-host proxy rules by design in local/dev config. Not a production defect; will resolve once deployed with production env split.
   **Owner:** N/A (environment-config artifact, not app code).

11. **`post-sitemap23.xml`'s first `<loc>` is not a Malayalam-slug URL** — audit brief assumed the first entry would have a percent-encoded Malayalam slug; verified it is actually `/shariah/allah-knows-what-is-truly-within-your-heart/` (English slug), and a scan of all 297 entries in that specific child sitemap found zero Malayalam-slug URLs (they exist in `post-sitemap.xml`, e.g. `/culture/history/%e0%b4%96...%e0%b4%b0%e0%b4%bf/`). Noted for accuracy; not a site defect.
   **Owner:** N/A (informational — corrects a brief assumption).

---

## Not Checked (stopped before completion — do not treat as pass or fail)

- **Images** (task #8): `/wp-content/uploads/...` proxying and `/_next/image?...` optimizer response — not fetched.
- **Mobile overflow** (task #9): Playwright `scrollWidth` vs `innerWidth` check at 375px on `/` and an article — not run. Only the viewport `<meta>` tag itself was verified (see Finding 5).
- **Security headers on `/` and one article specifically** (task #5): not captured as a dedicated header dump. `X-Content-Type-Options`, `Referrer-Policy`, and `X-Frame-Options` were confirmed present on robots.txt, all sitemaps, and `/search/`, suggesting sitewide middleware, but this was not independently re-verified on `/` or an article URL. HSTS/CSP absence not evaluated (expected: HSTS added by Vercel in production).
- **JSON-LD structured-data validation and `inLanguage` consistency** (task #7, part of task #6): explicitly out of scope for this pass — covered by another agent.
- **hreflang tags**: not inspected (single-language `ml` site; likely not applicable, but not verified).
- **Structured Data category (task #7 in the audit scope list)**: not independently validated beyond confirming one `application/ld+json` block is present per page (see "What Works").
- **`news-sitemap.xml` `<news:news>` namespace elements** (publication name, publication_date, title): only the base `<url>/<loc>`/`<lastmod>` structure was validated, not the Google News-specific tags.
- Mixed-content scan and full duplicate-content/thin-content sweep beyond the pages explicitly listed in scope.

File written to: `D:/Projects/islamonlive/frontend/docs/seo-audit/findings/technical.md`
