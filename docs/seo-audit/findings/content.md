# Content Quality & E-E-A-T Audit — islamonlive.in (local build, http://localhost:3686)

Audited: 2026-09-08. Local production build only (`http://localhost:3686`); canonical/og URLs intentionally point at `https://islamonlive.in` (Yoast pass-through) — not treated as a mismatch. All 11 target pages returned HTTP 200.

## Content Score: 58 / 100

Solid technical/structured-data foundation, undermined by widespread, verifiable meta-description and title-template defects (6 of 11 sampled pages), a missing visible breadcrumb trail, no rendered author-bio text, and several page bodies not reachable before this audit's time-box closed.

### E-E-A-T Breakdown

| Factor | Weight | Score /100 | Notes |
|---|---|---|---|
| Experience | 20% | 55 | Bylines linked to author pages; no first-hand/original-reporting signals visible in the sample; several pieces read as translated devotional content. |
| Expertise | 25% | 45 | No author bio/credentials rendered anywhere sampled; at least one article path uses the generic "islamonlive" admin account as byline, not a named writer. |
| Authoritativeness | 25% | 60 | Full Yoast JSON-LD graph (Article/Person/Organization/WebSite/BreadcrumbList) present and correctly re-hosted; no visible breadcrumb UI to reinforce it to human readers. |
| Trustworthiness | 30% | 55 | Privacy/About/Contact pages exist, but About/Contact body content (editorial team, address, email) was **not checked**; Home/About/Contact share one duplicate meta description; Privacy Policy's description is off-topic. |

Weighted E-E-A-T composite ≈ 54/100.

### AI Citation Readiness: 50 / 100
Strong machine-readable layer (complete Yoast JSON-LD graph, clean HTML on the article checked, descriptive featured-image alt text) is undercut by: no visible breadcrumb hierarchy, zero in-body subheadings on the article sampled (all non-H1 headings belong to site chrome — "Related Articles" / footer widgets, not the article text), and meta descriptions that are truncated mid-sentence or in the wrong language — exactly the field an AI summarizer would otherwise quote.

## Per-Page Table

| Page | Title (chars) | Description (chars) | H1 | Byline | Dates visible | Key issues |
|---|---|---|---|---|---|---|
| `/` (home) | 75 | 92 (dup.) | Present, but = rotating article teaser, not a homepage heading | N/A (listing) | N/A | H1 misuse |
| `/culture/the-great-mosque-of-damascus/` | 146 | 142, truncated mid-sentence, English | Present, unique | Present | Yes (publish date only) | Overlong title; broken/English description |
| `/shariah/allah-knows-what-is-truly-within-your-heart/` (sitemap23 #1) | 152 | 137, English, ends in authored "..." | Present, unique | Present, linked (`/author/adham-sharqawi/`) | Yes | Overlong title; English description on Malayalam page; no visible breadcrumb; no author bio text |
| `/culture/muslim-conquest-of-jerusalem/` (sitemap23 #10) | 136 | 140, hard cutoff, no punctuation | Present, unique | not checked in detail | not checked in detail | Broken description |
| 2012 article "സിറിയന്‍ ജനതക്കുള്ള സന്ദേശം" (sitemap #1) | 105 | 29, malformed ("Title \|") | Present, unique | not checked in detail | not checked in detail | Broken/empty description; shortcode/entity/markup integrity **not checked** |
| `/author/admin/` | 98 | 154, 2 typos | Present ("islamonlive") | N/A | not checked | Generic admin-account author identity; typo'd boilerplate description |
| `/authors-list/` | 24 | 46 | Present ("Authors") | N/A | N/A | Thin — acceptable, it's an index page |
| `/about/` | 33 | 92 (dup. of home/contact) | Present | N/A | not checked | Duplicate description; body E-E-A-T content **not checked** |
| `/contact/` | 27 | 92 (dup. of home/about) | Present | N/A | not checked | Duplicate description; body content **not checked** |
| `/category/news/` | 158 (site-suffix doubled) | 159, same 2 typos | Present ("News") | N/A | N/A | Title-doubling bug; thin — acceptable, it's an archive |
| `/privacy-policy/` | 92 | 137, off-topic/generic | Present | N/A | not checked | Description unrelated to page content |

## What Works

- Full Yoast JSON-LD graph (Article, BreadcrumbList, ImageObject, Organization, Person, WebSite, SearchAction) republished per article with every URL correctly rewritten onto the public host (verified `src/lib/seo.ts` `rewriteGraph()`/`seoSchema()`) — a strong structured-data/AI-citation base.
- Byline is present and linked to `/author/{slug}/` wherever WordPress supplies a slug (verified `AuthorName` component, `src/app/[category]/[...slug]/page.tsx`).
- Publish date is visible near the byline in DD/MM/YYYY format, not only in JSON-LD/meta (verified `<time>` element, matches `formatDate(post.date)` at page.tsx:252).
- `src/lib/content.ts` actively strips leftover WP shortcodes (`[su_...]`, `[caption]`, `[gallery]`, etc.), inline scripts/event handlers, and adds `loading="lazy"`/`decoding="async"` to images — verified clean (no shortcode remnants, no double-encoded entities, no empty paragraphs) on the one recent article checked in full.
- Featured-image alt text is descriptive, not empty, on both articles inspected directly.
- H1 is present and unique per article on every article-type page sampled.
- robots.txt is sensible: blocks `/wp-admin/`, `/wp-json/`, search/replytocom query strings; carries explicit AI-training opt-out signals; allows `/wp-content/uploads/`.

## Findings (Critical → Info)

**Critical**

1. **Category-archive `<title>` duplicates the entire site-name/tagline suffix.** `/category/news/` title = *"News Islamonlive.in \| The one and only Comprehensive Islamic portal in Malayalam \| Islamonlive.in \| The one and only Comprehensive Islamic portal in Malayalam"* (158 chars — the 130-char suffix appears twice, verified by exact string dump). `src/lib/seo.ts` sets `title: { absolute: title }` specifically so the layout's `%s \| Islamonlive.in` template can't append a second suffix (per its own code comment), and no other sampled page type shows this doubling — pointing at the **WordPress/Yoast side**: check Search Appearance → Taxonomies → Category title template for a duplicated `%%sitename%% \| %%tagline%%` segment. If that field is already correct, add a defensive guard in `src/lib/seo.ts` to strip a repeated tail. Only verified on `/category/news/`; likely template-wide (all category/tag archives).

2. **6 of 11 sampled meta descriptions are broken, mid-sentence-truncated, wrong-language, or exact duplicates**, each verified by exact string dump: Damascus article ends "...through its **breathtaking**." (142 chars, incomplete, English on a Malayalam page); Jerusalem article ends "...later Muslim rulers **lacked**" (140 chars, no closing punctuation); the 2012 article's description is just the title plus a dangling `" |"` (29 chars, no content after the pipe); Home/About/Contact all share one identical 92-char description. Per `src/lib/seo.ts`'s own comment, Yoast-supplied descriptions "win whenever there" and pass through unmodified — these read as authored prose, not code-truncated output, so **WordPress editorial**: finish the Damascus/Jerusalem descriptions to a complete sentence in Yoast, write a real description for the 2012 post, and give About/Contact their own descriptions instead of the site default. (If any of these are actually empty in Yoast and falling through to the frontend, the fallback is `stripHtml(post.excerpt.rendered).slice(0, 160)` in `src/app/[category]/[...slug]/page.tsx:64` — that hard-cuts mid-word with no ellipsis and should be fixed to truncate at a word boundary.)

**High**

3. **No visible breadcrumb trail on articles** — only JSON-LD `BreadcrumbList` exists. Verified on the sitemap23-#1 article: every `<nav>` and `aria-label` in the rendered HTML was checked; only the main site nav (Home/Read/Watch/Listen/Settings) and the mobile bottom nav were found, no Home → Category → Article UI. **Frontend**: add a visible breadcrumb to `src/app/[category]/[...slug]/page.tsx`, mirroring the `breadcrumbSchema()` data already built in `src/lib/schema.ts`.

4. **No author bio/credentials text is ever rendered**, only avatar + linked name + "View Other Articles" button. Verified directly in `src/app/[category]/[...slug]/page.tsx:266-290` — there is no bio/description field in that block at all. **Frontend**: render the WordPress author "description" field (already available via the REST API's embedded author data) in that box.

5. **Generic "islamonlive" admin account used as a visible byline** — `/author/admin/` title is *"islamonlive, Author at Islamonlive.in..."*, i.e. articles attributed to it show no named writer. **WordPress editorial**: reassign posts to real bylines, or give that account a proper display name and bio if it's an intentional "staff" byline.

**Medium**

6. **Privacy Policy's meta description is unrelated to the page**: *"Discover the beauty of Islam with our comprehensive Malayalam web portal. Find informative articles, connect with like-minded individuals"* — never mentions privacy or data. **WordPress editorial**: write a description that actually describes the policy.

7. **Shared archive-description boilerplate contains two typos, repeated across page types** — "**compelete**" and "**middile**" appear verbatim on both `/author/admin/` and `/category/news/` ("...a compelete malayalam islamic web portal on islam, muslim, middile east..."). `grep -rn "compelete|middile" src/` returned no matches, confirming this text is **not** in the frontend — it's generated on the **WordPress side**; fixing it once likely corrects every author and category archive site-wide.

8. **Only the original publish date is ever shown to readers**; `post.modified`/`article:modified_time` is emitted in meta/JSON-LD but `src/app/[category]/[...slug]/page.tsx` never renders it (only `formatDate(post.date)` at line 252). Genuinely updated articles show no visible freshness signal. **Frontend**: add a secondary "Updated on {date}" near the byline when `post.modified` meaningfully differs from `post.date`.

9. **Homepage `<h1>` is a rotating article teaser headline, not a homepage heading** — verified: home.html's only `<h1>` is *"കഅ്ബയേക്കാൾ പവിത്രമാണ് മനുഷ്യ രക്തം..."*, the top featured-story card's title. **Frontend**: give the homepage its own H1 (can be visually hidden) and demote the featured-card headline to H2/H3 in the homepage component that renders it.

**Low**

10. **Empty `alt=""` on contentful images**: author avatar is hardcoded `alt=""` — verified directly at `src/app/[category]/[...slug]/page.tsx:269`; related-article thumbnails on the sitemap23-#1 article also carry `alt=""` despite each card having a visible title (likely `PostCard`, imported at page.tsx:10, but not opened to confirm); the header's white logo (`logo-white.png`) uses `alt=""` while the purple logo elsewhere correctly uses `alt="islamonlive"`. **Frontend**: pass post/author name into `alt` at each of these call sites.

11. **Title tags are long and inconsistently templated.** Articles run 105–152 characters because of a fixed 61-character `" | Islamonlive.in | The one and only Comprehensive Islamic portal in Malayalam"` suffix (guaranteeing SERP truncation), while About/Contact/Authors-list (24–33 chars) skip that suffix entirely. **WordPress editorial**: shorten the Yoast title template's tagline segment for post/category/author templates.

**Info / Not checked**

12. Shortcode/entity/empty-paragraph body-integrity checks were run in full only on the sitemap23-#1 article (clean: no `[su_...]` remnants, no double-encoded entities, no empty `<p>`s). The 2012-era article — the highest-risk page for legacy shortcode leftovers per the audit brief — was fetched (`sm1_1st.html`) but **not checked** before this audit was cut short.
13. `/about/` and `/contact/` body content — editorial team listing, physical address, contact email, mission statement — was fetched but **not checked**; cannot confirm E-E-A-T trust-page completeness beyond the title/description findings above.
14. Word counts against the Content Minimums table, duplicate-title risk across pagination (e.g. `/category/news/page/2/`), and full body review of `/author/admin/` and `/authors-list/` were **not checked**.
15. Heading hierarchy on the sitemap23-#1 article: 1 H1, 1 H2 ("Related Articles" — chrome), 15 H3s (all related-article-card titles + footer widget headings) — the article body itself contains zero in-content subheadings. Not necessarily wrong for a short devotional piece, but worth revisiting on longer articles.
