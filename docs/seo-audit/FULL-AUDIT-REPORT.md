# islamonlive.in — full SEO / GEO audit and fix pass

**Date:** 2026-09-08 · **Target:** the Next.js 16 frontend, production build (`next start`), reading the live WordPress at `islamonlive.in` (22,297 posts, Yoast). Canonicals, sitemaps and JSON-LD point at `https://islamonlive.in` by design.
**Method:** the `seo-audit` skill's seven agents (technical, schema, sitemap, GEO, content, visual, performance — evidence in `findings/`), a 725-URL replay of the original Yoast sitemaps through `scripts/url-audit.mjs`, 20 Lighthouse runs (`performance/`), 27 agent screenshots plus 8 verification screenshots (`screenshots/`), then a fix pass on everything the frontend owns and a 107-probe verification suite against the rebuilt server.

## Executive summary

| | Before the fix pass | After (frontend verified) |
|---|---|---|
| **SEO health score** | **64 / 100** | **77 / 100** |
| Technical SEO (22 %) | 76 | 90 |
| Content quality (23 %) | 58 | 66 |
| On-page (20 %) | 55 | 75 |
| Schema (10 %) | 62 | 88 |
| Performance (10 %) | 83 | 86 |
| AI search readiness (10 %) | 52 | 62 |
| Images (5 %) | 65 | 72 |

The "before" column aggregates the agents' own scores with the skill's weights. The "after" column re-scores the same rubric against what the probes now verify; it is an estimate, not a fresh agent run. **The remaining 23 points are not reachable from the frontend**: they sit in Yoast templates and WordPress settings, in editorial content (descriptions, bylines, bios, headings, image sizes), in decisions only the publisher can take (AI-crawler policy, pinch-zoom), and in field data that only exists after launch (mobile Core Web Vitals behind Cloudflare and Vercel's edge). `ACTION-PLAN.md` lists every item with its owner.

### Top findings (and where they stand)

1. **Category and tag titles carried the site name and tagline twice** (`News Islamonlive.in | The one and only … | Islamonlive.in | The one and only …`, 158 characters) — Yoast's taxonomy template plus WordPress's site title, which itself contains the tagline. **Fixed** in `src/lib/seo.ts` (`cleanTitle`): `News | Islamonlive.in`, `News - Page 2 | Islamonlive.in`. The root cause (WordPress site title = "Islamonlive.in | The one and only…") stays in WordPress.
2. **No content route was cached.** Every article, archive and WP page rendered per request (`Cache-Control: private, no-store`) because the dynamic routes had no `generateStaticParams()` and the archives read `searchParams`. **Fixed**: ISR on all of them (`s-maxage=60, stale-while-revalidate`), archive pagination moved to `/page/N/` paths (which is what WordPress used anyway).
3. **Yoast's JSON-LD contradicted the frontend's own nodes**: `inLanguage: en-GB` on every node, a second Organization logo/name, the old `?s=` SearchAction, no `dateModified` on 2 of 3 articles, no `ProfilePage.mainEntity`. **Fixed** by normalising the graph at every depth (`normalizeGraph` / `deep` in `src/lib/seo.ts`); WordPress's site language (`en-GB`) should still be set to Malayalam.
4. **`page-sitemap.xml` advertised Elementor template pages that answer 500** and pages this app 301s. **Fixed** in the sitemap (each WP page is checked with the same fetch the page route makes); the three `elementor-*` pages themselves still need trashing in WordPress — they are the three 500s in the URL audit.
5. **Archives had no crawlable pagination** (the list loads on scroll; the audit found no link to any `/page/N/`). **Fixed**: real Previous/Next links under every archive, the Next link following whatever the reader has already loaded.
6. **Meta descriptions**: 6 of 11 sampled pages truncated mid-sentence, in English on Malayalam posts, or `Title |` only; the privacy policy's description is about the site. These are Yoast values passed through as written, i.e. what Google has been indexing. **Editorial** (frontend now trims its own fallbacks on a sentence/word boundary and no longer emits a whitespace-only archive blurb).

### Quick wins for the WordPress side

- Trash or noindex `/elementor-119103/`, `/elementor-122398/`, `/elementor-122411/`.
- Settings → General → Site Language: Malayalam. Site Title: `Islamonlive.in` (move the tagline to the Tagline field).
- Yoast → Search Appearance: fix "compelete" / "middile" in the archive description template; shorten the post title template.
- Give the `islamonlive` admin account a real display name and bio, or reassign its posts.
- Decide the AI-crawler policy (GPTBot and ClaudeBot are blocked, which also blocks ChatGPT search and Claude web results).
- Restore or trash the 2012 posts whose bodies are empty (five in the 725-URL sample, all under `/islam-padanam/`).

## What was verified after the fix pass

107 HTTP probes (`verify.mjs`) against the rebuilt server, plus the 725-URL audit, plus browser checks at 375 and 1280 px:

- **URL contract**: `/page/2/` → 301 `/`; `/life/`, `/hadith-padanam/`, `/ask-your-question/`, `/watch/`, `/watch/*`, `/authors/x/`, `/{article}/feed/`, `/{article}/amp/` → single 301s; `/?s=term` → 301 `/search/?q=term` (trimmed); `/?p=136123` and `/?cat=3` → one 301 to the permalink; `/?p=unknown` → 404; any archive's explicit `/page/1/` → 301 to the bare archive from `next.config.ts`; nested category by its leaf and an article under the wrong category → 308 to the real path.
- **725-URL audit**: 717 × 200, 4 × 301 (single hop, correct targets), 3 × 500 (Elementor templates, WordPress), 1 × 404 (`/author/hasan-abu/`, an account WordPress hides from REST because it has no visible posts — WordPress). Zero canonical mismatches, zero backend hosts.
- **ISR**: articles, category/tag/author archives (and their `/page/N/`), WP pages and `/authors-list/` all answer with `x-nextjs-cache` and `s-maxage=60`.
- **Titles and descriptions**: archive titles cleaned; page-N titles and self-canonicals; `og:url` = canonical; home OG/Twitter defaults; search title carries the query; descriptions trimmed on a sentence or word boundary.
- **JSON-LD**: one WebSite and one Organization identity on every page (name, `/logo.png` 298×81, SearchAction `/search/?q=`, `inLanguage: ml` at every depth); `dateModified` with a UTC offset on every Article/WebPage (verified on a post edited seven days after publication, which also shows "Updated 23/05/2026" to readers); `ProfilePage.mainEntity`; AboutPage/ContactPage with `mainEntity` → Organization and the site nodes embedded; Organization `sameAs` (Facebook, X, YouTube, Instagram), `foundingDate` 2012-06-18, office address, editorial email, parent D4 Media — the facts the About and Contact pages already show.
- **Articles**: visible breadcrumb (Home / category / title) on tablet and desktop, author bio in the author box, byline links with trailing slashes, "Updated" date when the edit is a day or more after publication.
- **Archives**: Previous/Next links (`rel="prev"`/`rel="next"`) rendered server-side; page past the end → 404; unknown term → 404; h1 reads "News, page 2 of 866".
- **Search**: relevance ordering; both Malayalam spellings (chillu / ZWJ, ZWNJ) searched and interleaved (`ഖുർആൻ` → 3,701 results = 1,257 + 2,444); `Search: “q”` title and h1; honest empty state with a way back on a page past the end; `noindex, follow`.
- **Sitemaps**: index with 33 children; `lastmod` only where WordPress can say (post and news files: newest post edit; page file: newest page edit; none on term/author files); `page-sitemap.xml` keeps about/contact/privacy-policy/terms-of-use/authors-list and drops Elementor templates and redirected pages; no `changefreq`/`priority`; the news file carries the stylesheet; `X-Robots-Tag: noindex` everywhere.
- **Home**: own h1 (the site), top story h2; YouTube player is a click-to-play facade (no embed iframe until the tap, then autoplay); four font preloads (the two reader faces load on demand); AVIF from `next/image`; RSS autodiscovery; `/llms.txt` (optional; Google ignores it).
- **Headers**: HSTS (2 y), `X-Content-Type-Options`, `Referrer-Policy`, `X-Frame-Options`, CSP `frame-ancestors 'self'`, `Permissions-Policy`.
- **Payload**: WordPress `_links` blocks stripped from every list (posts, embedded authors, images, terms).
- **Browser**: no horizontal overflow at 375/1280; article, author box, category pagination, home Watch facade and authors-list page 2 photographed (`screenshots/verification-2026-09-08/`).

Known and accepted: the first, uncached answer at an app-level 308 carries the `Location` header twice with the same value (Next 16.3.0–16.3.4 replays the render's headers with `appendHeader`); cached answers carry it once; browsers and Googlebot accept identical duplicates; the static redirects are unaffected. Documented in `docs/MIGRATION.md` §2.

## Per-category detail

### Technical SEO — 76 → 90
Robots, 33 sitemaps at Yoast's paths, self-canonicals, real 404s, single-hop legacy redirects, ISR, security headers are all in place (see above). Left: the Elementor 500s (WordPress), the pinch-zoom viewport (publisher decision), a full CSP (needs report-only testing), and the Next duplicate-Location quirk. `findings/technical.md`.

### Content quality — 58 → 66
Frontend now shows breadcrumbs, author bios, updated dates, an own h1 on home and search, and trims descriptions honestly. What remains is editorial: Yoast descriptions (mid-sentence cuts, English on Malayalam posts, `Title |` on 2012 posts, off-topic privacy description), the archive template typos, the admin-account bylines, missing author bios, no in-body subheadings, English-only closing summaries, and empty 2012 post bodies. `findings/content.md`.

### On-page — 55 → 75
Archive titles fixed, page-N titles, `og:url`, home OG, internal links with trailing slashes, crawlable pagination. Left: article titles of 105–152 characters from Yoast's tagline suffix (WordPress template).

### Schema — 62 → 88
Identity conflict resolved, `dateModified`, `inLanguage`, `ProfilePage.mainEntity`, logo, Organization facts and `sameAs`, self-contained graphs on About/Contact/Authors. Left: featured images below 696 px on older posts (content), optional `NewsArticle` per category, translator credits as `translator`. `findings/schema.md`.

### Sitemaps — 78 → 90
Page-sitemap filter, honest index `lastmod`, no changefreq/priority, styled news file, warm-up script. Left: `watch-sitemap.xml` and `jet-menu-sitemap.xml` from Yoast's index have no counterpart here (the `watch` post type is 301'd to `/watch-videos/`, `jet-menu` is menu data — set noindex in Yoast); `post-sitemap.xml` buckets posts by id rather than by Yoast's order — every URL is still present, only the file it sits in differs. `findings/sitemap.md`.

### Performance — 83 → 86
Lab only: CLS 0 and TBT good everywhere; desktop LCP 1.2–1.8 s. ISR, AVIF, four font preloads instead of ten, and the YouTube facade remove the largest first-paint costs on the home page. Mobile LCP (5–11 s in throttled Lighthouse with no CDN) must be judged on Search Console field data after launch; what remains on the page is Instagram preview images (signed URLs, not resizable) and the podcast artwork (hot-linked at 880 KB — route through the media proxy). `findings/performance.md`, `performance/`.

### AI search readiness — 52 → 62
Full SSR, news sitemap, `sameAs` with YouTube/Instagram, `inLanguage`, `dateModified`, bios, breadcrumbs, `llms.txt`. The two biggest remaining levers are editorial (headings and Malayalam summaries in the 134–167 word band) and a publisher decision (GPTBot/ClaudeBot). Google's position, applied throughout: GEO is SEO fundamentals; `llms.txt` is ignored by Google Search. `findings/geo.md`.

### Visual / images — 80 / 65 → 84 / 72
No overflow, no broken images, no layout shift, no console errors on real pages; the search page now has an h1. Decorative `alt=""` on thumbnails and avatars beside their visible titles is correct accessibility practice and was left as is. Left: header tap targets under 44 px at tablet/desktop and 12–14 px card bylines (design decisions; Lighthouse scores tap targets on mobile only, where they pass), a 1200×630 default social image for old posts. `findings/visual.md`.

## Artifacts

- `findings/*.md` — the seven agent reports (pre-fix evidence)
- `ACTION-PLAN.md` — every item with owner and status
- `audit-data.json` — the structured envelope (scores, findings, phases)
- `screenshots/` — 27 agent captures at 375/768/1280 and `verification-2026-09-08/` after the fixes
- `performance/` — 20 Lighthouse JSON runs and `summary.json`
- `scripts/url-audit.mjs`, `scripts/warm-sitemaps.mjs` — re-runnable checks
- `docs/MIGRATION.md` — the cutover runbook, URL contract and open items
