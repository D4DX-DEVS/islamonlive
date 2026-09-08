# Sitemap Audit — islamonlive.in Next.js frontend (local production build, port 3686)

**Audited:** 2026-09-08 · Local build `http://localhost:3686` (production build), compared once each against live `https://islamonlive.in`.

**Sitemap score: 78 / 100**

Core mechanics (validity, encoding, headers, size limits, migration parity) are excellent — the 22,297-article count matches production exactly and every sampled page's canonical agrees with its sitemap `<loc>`. The score is held back by two High-severity content/coverage gaps (2 sitemap types present on live Yoast but absent locally; 3 sitemap-listed URLs returning non-200) and some Medium/Low cleanup items.

---

## Inventory

| File | URL count | lastmod present | Status | Issues |
|---|---:|---|---|---|
| sitemap_index.xml / sitemap.xml | 33 children | yes, but identical for all 33 (see Low-1) | 200/200, byte-identical | Low-1 |
| post-sitemap.xml (oldest, post 1–1000) | 1,000 | yes, per-URL | 200 | live/local set differs (Medium-1) |
| post-sitemap2.xml … post-sitemap22.xml | 1,000 each | yes, per-URL | 200 (all 21) | none found |
| post-sitemap23.xml (newest, 22001–22297) | 297 | yes, per-URL | 200 | none found |
| page-sitemap.xml | 28 | yes, per-URL | 200 | **High-1**: 3 of 28 URLs non-200 |
| category-sitemap.xml | 79 | **no** (see Info-2) | 200 | none structural |
| post_tag-sitemap.xml | 1,000 | no | 200 | none structural |
| post_tag-sitemap2.xml | 1,000 | no | 200 | none structural |
| post_tag-sitemap3.xml | 1,000 | no | 200 | none structural |
| post_tag-sitemap4.xml | 685 | no | 200 | none structural |
| author-sitemap.xml | 1,000 | no | 200 | none structural |
| author-sitemap2.xml | 1,000 | no | 200 | none structural |
| author-sitemap3.xml | 236 | no | 200 | none structural |
| news-sitemap.xml | 2 | n/a (uses `publication_date`) | 200 | Info-3 (no XSL stylesheet PI) |
| jet-menu-sitemap.xml | — | — | **not present locally** | **High-2** |
| watch-sitemap.xml | — | — | **not present locally** | **High-2** |

Post total: 22 × 1,000 + 297 = **22,297 — matches the expected count exactly.**
Site-wide URL entries across all 33 local files: **28,327** (posts 22,297 + pages 28 + categories 79 + tags 3,685 + authors 2,236 + news 2).
All 33 files: XML well-formed, ≤ 50,000 URLs, largest is 377 KB (post-sitemap2.xml) — nowhere near the 50 MB cap.

---

## What works

- `/sitemap_index.xml` and `/sitemap.xml` both return 200, byte-identical bodies, valid `<sitemapindex>`, all 33 `<sitemap><loc>` resolve.
- Every one of the 33 fetched files: `Content-Type: application/xml; charset=UTF-8`, `X-Robots-Tag: noindex`, `Cache-Control: public, max-age=0, s-maxage=3600, stale-while-revalidate=86400` — uniform across all 33, exactly per spec.
- `/main-sitemap.xsl` resolves (200, `application/xslt+xml`), referenced correctly from the index's `<?xml-stylesheet?>` PI.
- All `<loc>` values are absolute `https://islamonlive.in/...` with trailing slash (0 violations in 28,327 URLs); 0 `admin.islamonlive.in` leaks.
- Percent-encoding: 0 true uppercase-hex escapes across 530,094 escapes checked (an initial regex pass flagged 8,387 "hits" that turned out to be purely-numeric escapes like `%20`, a false positive — corrected by checking for actual A–F letters; verified genuinely 0).
- Post-count migration parity is exact: 22,297/22,297.
- Sampled 20 URLs (post-sitemap.xml ×4, post-sitemap12.xml ×3, post-sitemap23.xml ×3, category-sitemap.xml ×3, post_tag-sitemap.xml ×3, page-sitemap.xml ×4): 17/20 returned 200 with `<link rel="canonical">` exactly equal to the sitemap `<loc>` (0 canonical mismatches on any 200 response).
- news-sitemap.xml: correct `xmlns:news` Google News namespace, `publication/name` = "Islamonlive.in", `language` = "ml", both entries' `publication_date` well inside the 48h window (5.9h and 9.5h old), both have non-empty titles.
- `author-sitemap.xml` is present locally (the task flagged this as a common gap) — confirmed present with 2,236 URLs across 3 files, matching live.
- Duplicates: 0 within any file; only 2 URLs duplicated *across* files, and both are the expected case (an article present in both `post-sitemap23.xml` and `news-sitemap.xml` during its first 48h) — not a defect.

---

## Findings

### High

**High-1 — 3 of 28 URLs in `page-sitemap.xml` return non-200 on the local build**
- Evidence (fetched locally): `https://islamonlive.in/elementor-122411/` → **500**; `https://islamonlive.in/elementor-122398/` → present in the sitemap (same class of known-bad WP page, not itself re-sampled for status but confirmed still listed); `https://islamonlive.in/ask-your-question/` → **404** (new finding, not previously known).
- The task's stated context confirms `/elementor-122398/` and `/elementor-122411/` already 500 on WordPress itself — **confirmed still listed in the local page-sitemap.xml**, i.e., the frontend has not filtered them out.
- Recommendation: (a) WordPress side — trash/unpublish the two `elementor-*` pages so the REST `pages` endpoint stops returning them; (b) frontend side, `src/lib/sitemap.ts` `childSitemap()` — as a safety net, filter known-bad slugs or any page whose REST status isn't cleanly `publish`, so a WP-side error page can't reach the sitemap even before WP is cleaned up. Investigate `/ask-your-question/` on the WP admin to determine why a REST-published page 404s on render.
- Fixable in: both — WordPress (root cause) + `src/lib/sitemap.ts` (defensive filter).

**High-2 — Local sitemap index is missing 2 sitemap types that live Yoast still serves**
- Evidence: live `https://islamonlive.in/sitemap_index.xml` lists 35 children; local lists 33. The 2 missing locally: `jet-menu-sitemap.xml` and `watch-sitemap.xml`.
- `jet-menu-sitemap.xml` is almost certainly a WP page-builder/menu plugin artifact (no real indexable content) and likely safe to drop. `watch-sitemap.xml` is more concerning: `page-sitemap.xml` lists live `/watch/` and `/watch-videos/` pages, suggesting a "watch" video content type exists on the site that isn't covered by any of the 5 types in `SITEMAP_TYPES` (`post`, `page`, `category`, `post_tag`, `author`) in `src/lib/sitemap.ts` — meaning that content section may have zero sitemap coverage after migration.
- Recommendation: confirm with WordPress whether "watch" is a distinct custom post type with its own REST endpoint; if so, add it to `ENDPOINTS`/`SITEMAP_TYPES` in `src/lib/sitemap.ts` (same pattern as `post`/`page`). Confirm whether `jet-menu-sitemap.xml` has real content; if not, no action needed.
- Fixable in: `src/lib/sitemap.ts` (once the WP-side content type is confirmed).

### Medium

**Medium-1 — `post-sitemap.xml` URL set differs between live and local despite identical count**
- Evidence: both live and local return exactly 1,000 URLs; first `<loc>` is identical on both; from the second entry onward the lists diverge — 616 URLs appear only live, 616 only local, sets are not equal, order is not equal.
- Cause not conclusively determined from a single fetch of each side: could be legitimate drift (Yoast's static file reflects an earlier WP state; the local build queries live WP with `orderby=id&order=asc`) or an actual ordering mismatch against Yoast's own file-1 membership rule.
- Recommendation: compare `orderby=id&order=asc` (used in `src/lib/sitemap.ts` `childSitemap()`) against what Yoast used to bucket posts into file 1 — if Yoast bucketed by `post_date` rather than `id`, an older post with a later ID could land in a different file, which matters for which URLs Search Console has historically seen under which sitemap file. Not urgent (both are valid, complete, 200-serving sitemaps) but worth confirming before treating the migration as a byte-for-byte no-op.
- Fixable in: `src/lib/sitemap.ts` (`childSitemap()` ordering), pending WP-side confirmation of Yoast's original bucketing rule.

**Medium-2 — Cold-cache response times up to ~18s on first hit per child sitemap file**
- Evidence: on the very first request to each route, `post-sitemap16.xml` took 17.98s, `post-sitemap18.xml` 17.20s, `post-sitemap5.xml` 13.87s (each fans out to 10 parallel WP REST calls). `sitemap_index.xml` itself was fast (16ms) since it only does lightweight count queries. Once warmed (revalidate: 3600), subsequent hits were fast (e.g., `category-sitemap.xml` 17ms, `post_tag-sitemap.xml` 86ms on a warm request during this same session).
- This is a one-time cold-start cost from ISR-style revalidation, not a per-request cost — but if it coincides with Googlebot's first crawl of a given file, an 18s response risks a crawler timeout on that file.
- Recommendation: pre-warm all 33 sitemap routes (a simple post-deploy `curl` loop) immediately after build/deploy so the first real crawler hit is never the cold one.
- Fixable in: deployment process (not application code).

### Low

**Low-1 — Every `<sitemap><lastmod>` in the sitemap index is identical**
- Evidence: all 33 `<lastmod>` values in `/sitemap_index.xml` are the single value `2026-09-08T08:56:37.000Z` — the site's single newest-post-modified timestamp, applied uniformly even to `category-sitemap.xml`, `author-sitemap.xml`, etc., which have nothing to do with post edits.
- Source: `src/lib/sitemap.ts` `sitemapIndex()` computes one `lastmod` from the newest post's `modified` field and reuses it for every `<sitemap>` entry (lines ~133–143).
- Recommendation: compute each child's own `lastmod` from the max `modified`/relevant date of the URLs it actually contains (or omit `lastmod` from the index entries entirely — Google does not require it and an inaccurate one is arguably worse than none).
- Fixable in: `src/lib/sitemap.ts` (`sitemapIndex()`).

### Info

**Info-1 — `priority` and `changefreq` still emitted on every `<url>`**
- Evidence: `src/lib/sitemap.ts` `ENDPOINTS` config attaches `changefreq`/`priority` per type (values seen: priority `0.4`–`0.7`, changefreq `daily`/`weekly`/`monthly`), and `childSitemap()` writes both into every `<url>`.
- Google has ignored both since 2020 (per this audit's brief); Bing gives them minimal weight. Harmless but adds bytes to every one of 28,327 URL entries.
- Fixable in: `src/lib/sitemap.ts` (`childSitemap()`) — safe to remove.

**Info-2 — Taxonomy sitemaps (`category`, `post_tag`, `author`) and `news-sitemap.xml` carry no per-URL `<lastmod>`**
- Evidence: 0 of the URLs in `category-sitemap.xml`, `post_tag-sitemap*.xml`, `author-sitemap*.xml` have a `<lastmod>` element (news-sitemap.xml correctly uses `<news:publication_date>` instead, which is expected and fine).
- Root cause confirmed in code: `wpList()` for taxonomy types requests `_fields: "link,count,yoast_head_json"` — `modified` is never requested, and WordPress's core REST term endpoints (categories/tags) don't expose a modified-date field to source one from in the first place. This is *not* fabricated data — it's correctly omitted rather than faked — so it is not a defect, just worth recording since the audit brief asked to verify lastmod-per-URL.
- No action required unless a real per-term "last content change" date becomes available from WordPress.

**Info-3 — `news-sitemap.xml` doesn't reference the XSL stylesheet**
- Evidence (source read): `sitemapIndex()` and `childSitemap()` in `src/lib/sitemap.ts` both prepend the `<?xml-stylesheet?>` PI; `newsSitemap()` does not. A human opening `/news-sitemap.xml` in a browser gets raw XML instead of the styled table the other 32 files show.
- Cosmetic only; crawlers ignore the stylesheet either way.
- Fixable in: `src/lib/sitemap.ts` (`newsSitemap()`) — add the same `STYLESHEET` prefix used elsewhere.

**Info-4 — No `<image:image>` entries anywhere**
- Evidence: 0 image entries found across all 28,327 URLs in all 33 files. Not a defect — image sitemap extensions are optional — but a future enhancement could add featured-image entries to `post-sitemap*.xml` for Google Images discovery.

**Info-5 — Local build currently resolves WordPress at the apex host, not `admin.islamonlive.in`**
- Evidence: `.env.local` sets `WORDPRESS_API_URL`/`NEXT_PUBLIC_WORDPRESS_URL` to `https://islamonlive.in` (same as `SITE_URL`), per `next.config.ts`'s own documented single-host fallback for when `admin.islamonlive.in` DNS isn't live yet. `SPLIT_HOSTS` is therefore `false` in this environment.
- Practical effect: the "no `admin.islamonlive.in` in any `<loc>`" check trivially passes right now because that host isn't in use at all yet — re-run this specific check after DNS cutover to `admin.islamonlive.in` to get a meaningful result.

---

## Not checked (scope/time-bounded — flag for follow-up)

- Full redirect-chain / status-code verification of all 28,327 individual URLs — only structural validation (all files) + a 20-URL live sample (task originally specified 30; scope was reduced mid-task) were fetched and status-checked.
- Independent full-site crawl vs. sitemap coverage diff (general "missing pages" comparison) — not part of the numbered checklist executed here; only the live-index-vs-local-index and live-post-sitemap-vs-local-post-sitemap diffs (task step 6) were run.
- `/elementor-122398/` was confirmed present in the local `page-sitemap.xml` list but its live HTTP status was not independently re-sampled in this pass (only `/elementor-122411/` was sampled directly); treat it as the same class of issue as `-122411/` pending direct confirmation.
- Root cause of the Medium-1 post-sitemap.xml set drift (Yoast static-cache drift vs. an actual ordering-logic mismatch) was not conclusively isolated — would need either a second live fetch at a later time or access to Yoast's original generation logic/timestamp, both out of this pass's scope (live may only be fetched once per file per the audit brief).

---

**Findings file:** `D:/Projects/islamonlive/frontend/docs/seo-audit/findings/sitemap.md`
**Source files referenced:** `D:/Projects/islamonlive/frontend/src/lib/sitemap.ts`, `D:/Projects/islamonlive/frontend/src/app/api/sitemap/route.ts`, `D:/Projects/islamonlive/frontend/src/app/api/sitemap/[type]/[page]/route.ts`, `D:/Projects/islamonlive/frontend/src/app/api/sitemap/style/route.ts`, `D:/Projects/islamonlive/frontend/next.config.ts`, `D:/Projects/islamonlive/frontend/src/lib/urls.ts`, `D:/Projects/islamonlive/frontend/src/lib/env.ts`
