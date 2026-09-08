# Structured Data (JSON-LD) Audit — islamonlive.in Next.js frontend

Audited: local production build at `http://localhost:3686` (pre-launch replacement for `https://islamonlive.in`). All `@id`/`url` values intentionally point at the production host `https://islamonlive.in` — this is expected and not flagged as a mismatch. No external validator API was available; validation is against schema.org and Google Search Central rich-result requirements from the auditor's own knowledge, current as of this audit.

**Method note:** findings are based on the specific pages listed in the audit brief (a representative sample, not all 22,297 articles). References to `src/lib/schema.ts` / `src/lib/seo.ts` as the fix location follow the audit brief's own description of the codebase; the source files themselves were not opened/read during this audit, so exact function/line attribution is not verified — only the *symptom* (what the served HTML/JSON-LD contains) is verified.

## Schema Score: 62 / 100

Foundational structure is sound (valid JSON everywhere, correct `@context`, no deprecated types, correct node types per page, clean BreadcrumbLists, correct 404/search behavior). Score is held down by one **Critical**, systemic cross-page identity conflict on the two most-reused sitewide nodes (WebSite/Organization), plus a **High** gap in `dateModified` on articles despite the data being available.

## Per-Page Inventory

| Page | HTTP | JSON-LD node types found |
|---|---|---|
| `/` (home) | 200 | WebSite, Organization |
| `/culture/the-great-mosque-of-damascus/` | 200 | Article, WebPage, ImageObject, BreadcrumbList, WebSite, Organization, Person |
| `/shariah/allah-knows-what-is-truly-within-your-heart/` (1st `<loc>` of `post-sitemap23.xml`) | 200 | Article, WebPage, ImageObject, BreadcrumbList, WebSite, Organization, Person |
| `/shariah/i%ca%bftikaf-the-spiritual-retreat/` (bonus: percent-encoded-slug spot check from same sitemap) | 200 | Article, WebPage, ImageObject, BreadcrumbList, WebSite, Organization, Person |
| `/category/news/` | 200 | CollectionPage, BreadcrumbList, WebSite, Organization |
| `/category/news/page/2/` | 200 | CollectionPage, BreadcrumbList, WebSite, Organization |
| `/tag/al-faqeer-well/` (1st `<loc>` of `post_tag-sitemap.xml`) | 200 | CollectionPage, BreadcrumbList, WebSite, Organization |
| `/author/admin/` | 200 | ProfilePage, BreadcrumbList, WebSite, Organization, Person |
| `/authors-list/` | 200 | CollectionPage, BreadcrumbList |
| `/about/` | 200 | AboutPage, BreadcrumbList |
| `/contact/` | 200 | ContactPage, BreadcrumbList |
| `/privacy-policy/` | 200 | WebPage, BreadcrumbList, WebSite, Organization |
| `/search/?q=quran` | 200 | (none) |
| `/this-page-does-not-exist/` | 404 | (none) |

## What Works

- Every `<script type="application/ld+json">` block on every page parsed as valid JSON — zero parse errors across 12 non-empty blocks.
- `@context` is consistently `https://schema.org` (https, correct casing).
- No deprecated/restricted types found anywhere: no `HowTo`, `SpecialAnnouncement`, `CourseInfo`, `EstimatedSalary`, `LearningVideo`, and no `FAQPage` (so the Google Aug-2023 FAQ rich-result restriction is a non-issue here).
- `/this-page-does-not-exist/` correctly returns HTTP 404 with **zero** page schema.
- `/search/?q=quran` carries **zero** JSON-LD — compliant with "none or only site-level nodes."
- No literal unescaped `<` found in any JSON-LD block on any page — no `</script>`-breakout risk.
- `BreadcrumbList` is structurally correct everywhere it appears: position-1 `item` is always an absolute URL (`https://islamonlive.in/`); the final (current-page) item correctly omits `item`.
- `CollectionPage` correctly used on all listing templates (category, tag, authors-list).
- `Person` node present on the author page, linked via `mainEntityOfPage` back to the ProfilePage.
- No `admin.islamonlive.in` or `wp-json` URLs found **inside any JSON-LD block** on any page.
- The `@id` *strings* for WebSite (`https://islamonlive.in/#website`) and Organization (`https://islamonlive.in/#organization`) are identical across every page that includes them — the identifiers are consistent even though (see Finding 1) the objects attached to them are not.
- Percent-encoded slugs are lowercase and identical across `@id`, `url`, `<link rel=canonical>`, and `og:url` (verified on `/shariah/i%ca%bftikaf-the-spiritual-retreat/`).
- Dates that are present use ISO 8601 with UTC offset, e.g. `2025-12-18T05:33:06+00:00`.

---

## Findings

### CRITICAL

**1. WebSite and Organization share one `@id` sitewide but carry conflicting property values depending on the page — including two different SearchAction targets.**

- Evidence — `WebSite` (`@id: https://islamonlive.in/#website`):
  - On `/` only: `name: "Islamonlive.in"`, `inLanguage: "ml"`, `potentialAction.target.urlTemplate: "https://islamonlive.in/search/?q={search_term_string}"`.
  - On all 8 other sampled pages (article ×3, tag, category ×2, author, privacy): `name: "Islamonlive.in | The one and only Comprehensive Islamic portal in Malayalam"`, `inLanguage: "en-GB"`, `potentialAction.target.urlTemplate: "https://islamonlive.in/?s={search_term_string}"`.
  - Verified live behavior: `GET http://localhost:3686/?s=quran` → **301** redirect to `/search/?s=quran&q=quran` (extra hop). `GET http://localhost:3686/search/?q=quran` → **200** directly. So the SearchAction target used on 8/9 sampled non-home pages is the stale/legacy one.
  - Evidence — `Organization` (`@id: https://islamonlive.in/#organization`): home's `logo.url = https://islamonlive.in/logo.png`; every other sampled page's `logo.url = https://islamonlive.in/wp-content/uploads/2025/05/new-logo1-1.png` (350×95) — two different image files for the same entity.
- Why it matters: schema.org/JSON-LD treats a shared `@id` as one entity; serving conflicting definitions of it is a structural anti-pattern and duplicates/contradicts the sitewide Sitelinks-Search-Box entity and brand entity depending on which page a consumer (Google, an LLM, a knowledge-graph tool) reads it from.
- Recommendation: Pick one canonical WebSite+Organization definition (recommend the homepage's — it already has the correct `/search/?q=` action and correct `ml` locale) and reuse that exact object on every page, instead of letting the Yoast-rehosted `@graph` inject its own copy on interior pages.
- Fixable: **Frontend** (`src/lib/schema.ts` — the Yoast-`@graph` rehosting logic should not pass through Yoast's own WebSite/Organization nodes once the frontend has its own canonical ones) **and WordPress/Yoast** (WP site language setting, WP Reading/Search settings, and Yoast's Site Identity logo are the likely source of the `en-GB`/`?s=`/old-logo values being rehosted).

### HIGH

**2. `dateModified` is missing from `Article`/`WebPage` on 2 of 3 sampled articles, despite modified-date data existing.**

- Evidence:
  - `/culture/the-great-mosque-of-damascus/`: `Article` and `WebPage` nodes have `datePublished` but no `dateModified` key at all. Yet `<meta property="article:modified_time" content="2026-07-02T12:53:24"/>` is present on the same page (5.5 h after the `article:published_time`).
  - `/shariah/i%ca%bftikaf-the-spiritual-retreat/`: same — no `dateModified` in JSON-LD; `article:modified_time` meta = `2026-03-10T11:36:44` (note: **no UTC offset**, unlike `article:published_time` which has `+00:00`).
  - Control: `/shariah/allah-knows-what-is-truly-within-your-heart/` **does** include `dateModified: "2025-12-18T05:33:54+00:00"` in both nodes, and its `article:modified_time` meta **does** carry the `+00:00` offset.
  - Pattern observed: `dateModified` survives into JSON-LD only when the source modified-time string has a UTC offset; it's silently dropped (not defaulted/normalized) when the offset is missing.
- Recommendation: Always emit `dateModified` on Article/WebPage (Google recommends it on every article); normalize/append the UTC offset to the modified-date value rather than dropping the property on a parse mismatch.
- Fixable: **Frontend** — `src/lib/schema.ts` (date pass-through) and likely `src/lib/seo.ts` (the `article:modified_time` meta tag shares the same malformed source value).

### MEDIUM

**3. `ProfilePage` never sets `mainEntity`, which Google's Profile Page structured data requires.**

- Evidence: `/author/admin/` `ProfilePage` node keys = `url, name, isPartOf, description, breadcrumb, inLanguage, potentialAction` — no `mainEntity`. A `Person` node is present in the same graph and points back via `mainEntityOfPage: {"@id": "https://islamonlive.in/author/admin/"}`, but that inverse link does not satisfy Google's explicit requirement that `ProfilePage.mainEntity` reference a Person/Organization with a `name`.
- Recommendation: Add `"mainEntity": {"@id": "<the co-located Person @id>"}` to the ProfilePage node.
- Fixable: **Frontend** (`src/lib/schema.ts`, at rehosting time) — this is a known long-standing gap in Yoast's own ProfilePage output, not a WP setting.

**4. Home page's Organization `logo` (`https://islamonlive.in/logo.png`) is not directly reachable.**

- Evidence: `curl -I https://islamonlive.in/logo.png` → **301 Moved Permanently**. By contrast `https://islamonlive.in/wp-content/uploads/2025/05/new-logo1-1.png` (used on every other page) → **200 OK, image/png, 3034 bytes**. Reinforces Finding 1: two logos for one `@id`, one of which redirects instead of serving directly.
- Recommendation: Point the homepage Organization node at the same working logo used elsewhere, or fix the redirect at the hosting layer.
- Fixable: **Frontend** (`src/lib/schema.ts`, which logo URL it selects for `/`) and/or infra-level redirect fix.

**5. Sampled article images are below Google's recommended ≥696px width for large-image search results.**

- Evidence (declared `width`/`height` in the `ImageObject` node, corroborated live for one): `mosque-scaled.jpg` = 650×370 (fetched directly: 200 OK, image/jpeg, 48.7 KB — real file, just small); `iti.jpeg` = 289×175; `rabb.jpg` = 400×400. All three under Google's 696px guidance; two are well under.
- Recommendation: Not a code defect — source-media issue. Ensure featured images are uploaded/selected at ≥696px (ideally ≥1200px for Discover eligibility). If WordPress has a larger registered size available, prefer it when building the schema `image`.
- Fixable: **WordPress content-ops side** primarily; frontend (`src/lib/schema.ts`) could at most prefer a larger available size if one exists.

### LOW

**6. `inLanguage` is inconsistent — `ml` on frontend-authored pages, `en-GB` on Yoast-rehosted pages — even though sampled content is 100% Malayalam.**

- Evidence: `/`, `/about/`, `/contact/`, `/authors-list/` → `inLanguage: "ml"`. All Yoast-rehosted pages sampled (3 articles, category ×2, tag, author, privacy) → `inLanguage: "en-GB"` on WebPage/Article/WebSite/Organization/ImageObject nodes, despite Malayalam headlines/body (e.g. "ദി ഗ്രേറ്റ് മോസ്ക് ഓഫ് ദമസ്കസ്…").
- This *is* a real problem, not a benign mix: `en-GB` misdescribes the actual content language on the majority of page types.
- Recommendation: Fix WordPress's Settings → General → Site Language (Yoast derives `inLanguage` from it), and/or override to `ml` in `src/lib/schema.ts` when rehosting.
- Fixable: **WordPress/Yoast** (root cause) + optionally **frontend** override as a safety net.

**7. `/about/`, `/contact/`, `/authors-list/` reference `isPartOf: {"@id": ".../#website"}` but never embed the WebSite/Organization node on-page, unlike every other sampled page type (privacy, category, tag, author all embed both).**

- Recommendation: Embed the same canonical WebSite+Organization nodes on these three templates for consistency and so each page is a self-contained graph.
- Fixable: **Frontend** (`src/lib/schema.ts`).

### INFO

**8. WordPress REST `_links` (HATEOAS) data, including `wp-json/wp/v2/posts/…` and `wp-json/wp/v2/users/…` URLs, leaks into the page payload on `/author/admin/`, `/category/news/`, `/category/news/page/2/`, `/search/?q=quran`, `/tag/al-faqeer-well/`.** Verified this is **outside** the `application/ld+json` blocks — it's inside a separate untyped `<script>` (Next.js RSC/hydration payload), so it does **not** affect structured-data validity or Rich Results. Still an internal-API exposure worth cleaning up. Not a `schema.ts`/`seo.ts` fix — belongs to the WP REST fetch/data layer (strip `_links` before passing to client props).

**9. Article vs. NewsArticle.** Currently uniform `Article` via Yoast. Recommend keeping `Article` for evergreen/devotional categories (Shariah, Quran, Fiqh, Culture, Civilization, Opinion/Columns essays) and reserving `NewsArticle` for genuinely time-sensitive content (the `News` category; current-affairs pieces like the sampled "Kerala Local Body Elections" article). `NewsArticle` is a prerequisite (not sufficient alone) for Google News/Top Stories features. Yoast's Article-type setting is global, not per-category, so per-category typing is impractical purely in Yoast without custom PHP filters — more maintainable in **frontend** `src/lib/schema.ts` by mapping `articleSection`/category → `@type` at rehosting time. Optional strategic improvement, not a defect.

**10. Audit-brief correction, both checks pass.** The 1st `<loc>` of `post-sitemap23.xml` is `shariah/allah-knows-what-is-truly-within-your-heart/` — an ASCII English slug, not Malayalam-scripted as the brief assumed (no `%e0%b4…` Malayalam-Unicode percent-encoded slugs were found anywhere in that sitemap). Checked anyway: `@id`/`url`/canonical/`og:url` are identical — **pass**. Additionally spot-checked a genuinely percent-encoded diacritic slug from the same sitemap (`/shariah/i%ca%bftikaf-the-spiritual-retreat/`, Iʿtikāf): `@id`/`url`/canonical/`og:url` are all lowercase-percent-encoded and identical — **pass**.
