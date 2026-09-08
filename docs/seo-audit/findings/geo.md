# GEO (AI-Search Readiness) Audit - islamonlive.in

Audited: local production build at http://localhost:3686 (pre-launch replacement for https://islamonlive.in). Date: 2026-09-08.
Scope: /, /culture/the-great-mosque-of-damascus/, /shariah/allah-knows-what-is-truly-within-your-heart/ (first loc of /post-sitemap23.xml), /author/admin/, /authors-list/, /about/, /contact/, /robots.txt, /llms.txt, /feed/, plus /search/?q=..., /sitemap_index.xml, /news-sitemap.xml, /rsl.xml, /.well-known/rsl.xml for support. Fetched with curl, no JS execution, so results reflect what a non-JS AI crawler receives. Live robots.txt fetched once for comparison.

Method note: no DataForSEO, GSC or Bing credentials were available. Platform scores are structural heuristics from verified crawl access and on-page evidence, not measured citation data. Google position (Search Central, 2026-06-29): GEO is SEO fundamentals applied to AI surfaces; llms.txt is ignored by Google Search - used throughout.

## 1. GEO Readiness Score: 52/100

| Dimension | Weight | Score | Weighted |
|---|---|---|---|
| Citability | 25% | 48/100 | 12.0 |
| Structural Readability | 20% | 40/100 | 8.0 |
| Multi-Modal Content | 15% | 45/100 | 6.75 |
| Authority and Brand Signals | 20% | 55/100 | 11.0 |
| Technical Accessibility | 20% | 72/100 | 14.4 |
| Total | | | 52.15, rounds to 52/100 |

Strong technical foundation (real SSR, real entities, real editorial team, real office/contact data, working news sitemap) keeps this at moderate rather than weak. Deficit is mostly structured-data completeness (sameAs, inLanguage, dateModified) and content shaping (no in-body headings, paragraphs under optimal citation length) - both fixable without a redesign.

## 2. Platform Breakdown (heuristic, unmeasured)

| Platform | Estimate | Basis |
|---|---|---|
| Google AI Overviews / AI Mode | Fair, best positioned | Googlebot not blocked, only Google-Extended is (does not affect AIO/AI Mode eligibility). Strong SSR + sitemaps + news-sitemap support this. Cannot measure actual ranking without GSC data. |
| ChatGPT search | Limited-moderate | OAI-SearchBot open, but ChatGPT citations skew to Wikipedia (47.9%) and Reddit (11.3%) - neither presence found on-page (section 5). |
| Perplexity | Moderate | PerplexityBot fully open, not named at all in robots.txt. Perplexity also crawls arbitrary sites directly. |
| Bing Copilot | Unknown | Bingbot not blocked; Bing Webmaster Tools status not checkable from this environment. |

## 3. AI Crawler Access Status

Local and live robots.txt are substantively identical in bot-blocking directives (live additionally carries a Cloudflare legal preamble citing EU Directive 2019/790 Article 4, and a trailing empty Yoast block). Both declare under User-agent star: Content-Signal: search=yes,ai-train=no,use=reference

| Crawler | Purpose | Status | What publisher gives up |
|---|---|---|---|
| GPTBot | OpenAI training | Blocked (named) | Excluded from GPT training. Does not block ChatGPT live citations - that is OAI-SearchBot. |
| OAI-SearchBot | ChatGPT search citations | Allowed (not named, wildcard Allow: /) | Nothing today; allow-by-omission not explicit. |
| ChatGPT-User | User-triggered browsing | Allowed; also ignores robots.txt by design | Nothing |
| ClaudeBot | Anthropic crawler | Blocked (named) | Excluded under this UA. A separately-named Anthropic search/citation UA, if one exists distinct from ClaudeBot, is not named here and allowed by omission - verify current naming against Anthropic docs. |
| PerplexityBot | Perplexity search | Allowed (not named at all) | Nothing - fully open. |
| Google-Extended | Gemini app / Vertex AI training+grounding opt-out | Blocked (named) | Gemini app answers and Vertex grounding citations. Does NOT affect Google Search AI Overviews or AI Mode eligibility - that rides on standard Googlebot indexing, a separate mechanism. |
| Googlebot | Core Search indexing, feeds AIO/AI Mode | Allowed | Nothing |
| Applebot-Extended | Apple Intelligence training | Blocked (named) | AI training exclusion only; base Applebot (Siri/Spotlight index) not named, remains allowed. |
| CCBot | Common Crawl | Blocked (named) | Exclusion from Common Crawl dataset |
| Amazonbot | Alexa+/Rufus training+grounding | Blocked (named) | Alexa+/Rufus answer eligibility |
| Bytespider | ByteDance training | Blocked (named) | Exclusion from ByteDance crawl |
| meta-externalagent | Meta AI training+grounding, no separate search-only UA documented | Blocked (named) | Meta AI citation eligibility entirely - no separate bot to allow instead |
| CloudflareBrowserRenderingCrawler | 3rd-party agent rendering via Cloudflare API | Blocked (named) | Low impact, niche |
| Bingbot | Bing index, feeds Bing Copilot | Allowed | Nothing |

Net: a deliberate, well-calibrated policy matching ai-train=no/search=yes - named blocks are training-oriented; search-citation crawlers (OAI-SearchBot, PerplexityBot, Googlebot, Bingbot, base Applebot) are open. Risk: openness is by omission, not explicit Allow. Cloudflare managed Block AI Bots list has expanded before and could add a search-citation UA later without publisher action.

Recommended minimal change (publisher policy decision; frontend/Cloudflare implements): add explicit Allow stanzas for OAI-SearchBot, PerplexityBot and ChatGPT-User so current intent survives future Cloudflare list changes. This is a decision for the publisher, not a fix for an error - current setup already achieves its stated goal.

## 4. llms.txt Status: Absent (404, confirmed real 404, same app-shell template as /feed/ and /rsl.xml)

Google AI optimization guide (2026-06-29): Google Search ignores llms.txt entirely - will not harm nor help rankings. No ranking weight assigned; reported for completeness as optional, low-cost optionality for non-Google AI crawlers. SE Ranking 300k-domain study found it on only 1 of top 50 AI-cited domains.

Ready-to-use template (frontend, add public/llms.txt), optional/non-Google:

 # IslamOnlive.in
 Summary: The one and only comprehensive Islamic portal in Malayalam - news, opinion, columns, Shariah, Quran, culture and current affairs, published since 2012 from Kozhikode, Kerala, under D4 Media.

 Main sections:
 - Home (https://islamonlive.in/): Latest Islamic news, opinion and columns in Malayalam
 - Opinion (https://islamonlive.in/opinion/): Analysis and commentary
 - Shariah (https://islamonlive.in/shariah/): Islamic jurisprudence and rulings
 - Culture (https://islamonlive.in/culture/): Islamic history, art, civilization
 - Columns (https://islamonlive.in/columns/): Regular columnists
 - About (https://islamonlive.in/about/): Editorial team, founding history
 - Contact (https://islamonlive.in/contact/): Editorial contact, submissions

 Key facts:
 - Founded 18 June 2012, Kozhikode, Kerala, India
 - Published by D4 Media; language Malayalam (ml)
 - Editorial contact: editor@islamonlive.in
 - Licensing: search=yes, ai-train=no, use=reference (/robots.txt)

Banner for internal docs: Google Search ignores llms.txt (Google docs, 2026-06-29); no major LLM provider confirmed consumption; shipped for non-Google optionality, not citation.

## 5. Brand Mention Analysis

| Platform | Status | Evidence |
|---|---|---|
| YouTube | Confirmed active | Real channel youtube.com/@IslamOnlivePortal, embedded videos on-site, homepage Watch section. Not listed in Organization sameAs - see section 8 item 1. |
| Instagram | Confirmed active | Real account instagram.com/islam.onlive/, embedded Reels on-site. Not listed in Organization sameAs. |
| Facebook | Confirmed | In Organization sameAs: facebook.com/islamonlive |
| X (Twitter) | Confirmed | In Organization sameAs: x.com/islamonlive |
| Wikipedia | Not verifiable offline - no on-page link found; could not query Wikipedia/Wikidata from this environment | - |
| Reddit | Not verifiable offline - no on-page link found; no API access available | - |
| LinkedIn | Not verifiable offline - no on-page link found | - |

YouTube mentions correlate strongest with AI-citation likelihood (about 0.737, skill Ahrefs data) and the publisher already has the underlying asset - the gap is purely a schema sameAs omission, not a brand-building gap. Single cheapest lever in this audit.

## 6. Passage-Level Citability

Two article genres sampled; recommendations differ by genre (section 10).

Article 1 - /culture/the-great-mosque-of-damascus/ (analytical/historical; 463 words in actual .reader-body prose, 7 paragraphs, zero in-body headings, zero lists):

| Para | Words | In 134-167 optimal band? |
|---|---|---|
| 1 | 52 | No |
| 2 | 91 | No |
| 3 | 57 | No |
| 4 | 36 | No |
| 5 | 49 | No |
| 6 | 66 | No |
| 7 (closing Summary, English) | 112 | No - closest, needs +22-55 words |

Article 2 - /shariah/allah-knows-what-is-truly-within-your-heart/ (short devotional; 126 words in .reader-body, 5 paragraphs: 11-word Quranic verse+translation, 1-line blockquote, 42-word reflection, 4-word translator credit, 52-word closing Summary). No paragraph near optimal band - genre-appropriate short-form, not a defect.

Verified strengths: both articles already end with a self-contained English Summary paragraph - real, human-visible, editorially-authored, not hidden SEO. Right pattern already; needs to (a) consistently hit 134-167 words and (b) exist in Malayalam too. datePublished, named byline with bio, category tags present in raw HTML for both. Zero external hyperlinked source citations inside either body - realistic for devotional content citing Quran/Hadith by name, but a real gap for the analytical Article 1 (Umayyad-era construction claim, influence on Alhambra/Dome of the Rock, no linked source).

Verified weaknesses: zero in-body H2/H3 headings in either article (headings come only from the sitewide trending widget - section 7); zero lists/tables; no paragraph in the optimal band.

## 7. Server-Side Rendering Check: Pass (strong)

Confirmed via raw curl (no JS engine) on every page tested: full Malayalam article text, headings, author byline+bio, datePublished/dateModified, category tags, and complete JSON-LD graph blocks present in the initial HTML response. X-Powered-By: Next.js on all 200 responses. Strongest dimension in the audit.

Caveat: the same 15-item trending-articles widget (h3 headings) repeats verbatim across every template (home, both articles, author page, authors-list, about, contact). On article pages the article own heading outline is diluted - a heading-only skim surfaces 15 unrelated headlines since the article body itself contributes zero H2/H3. Not a rendering defect, a content-hierarchy one.

/search/?q=...: fully server-rendered - real result cards, bylines, dates, category tags, and an N-articles-match count line are present in raw HTML, reachable via plain GET query string with no JS required.

## 8. Top 5 Highest-Impact Changes

1. Add YouTube and Instagram to Organization sameAs. Owner: Frontend (schema builder). Effort: trivial (2 URL strings). Impact: high - targets the strongest verified brand-mention correlate (YouTube ~0.737) for an asset the publisher already owns and embeds on-site.
2. Fix inLanguage "en-GB" on Article/WebPage/Person schema for post and author-archive templates. Owner: Frontend (root cause likely WordPress/Yoast site-language setting). Effort: low-medium. Impact: medium-high - html lang is correctly ml everywhere, but JSON-LD for every article and author page declares English (UK) while static pages (home/about/contact/authors-list) correctly declare ml. Self-contradicts the page own language signal for a Malayalam-only publisher.
3. Explicitly allow-list OAI-SearchBot, PerplexityBot and ChatGPT-User in robots.txt. Owner: Publisher policy decision; frontend/Cloudflare config implements. Effort: trivial. Impact: medium - protects current search=yes access from silent withdrawal if the Cloudflare managed AI-bot list expands (section 3).
4. Add in-body H2/H3 subheadings to longer analytical articles, and grow the existing closing Summary block into the 134-167 word band, mirrored in Malayalam not English-only. Owner: WordPress editorial (authoring/style-guide change). Effort: medium (ongoing habit, not one-time). Impact: high - targets Citability, the highest-weighted dimension (25 percent), building on a pattern already adopted.
5. Add alt text to content-meaningful images (115/118 missing on homepage) and enrich Organization schema with the real foundingDate (2012-06-18), office address, and parentOrganization/brand (D4 Media) already published in prose on the About page. Owner: Frontend (template + minor CMS field mapping; source data already exists editorially). Effort: medium. Impact: medium.

## 9. Schema Recommendations

- Organization: add sameAs for YouTube and Instagram (confirmed active, section 5); add foundingDate 2012-06-18; add address (PostalAddress: Hira Centre, Mavoor Road, Kozhikode, Kerala, India, 673004 - already live human-visible text on /contact/); add email/contactPoint; consider parentOrganization/brand referencing D4 Media (About page says D4 Media, footer says Powered by D4DX - reconcile which name is authoritative).
- Article: emit dateModified consistently - present on Article 2 schema but absent entirely (not even duplicated from datePublished) on Article 1. Freshness signals should not depend on whether a post happened to be edited.
- Article translator credit: Article 2 shows a visible translated-by credit line (Malayalam script, translator name) as plain text only. Schema.org Article supports a translator property - worth structuring for translated/syndicated pieces (Article 2 original author, Adham Sharqawi, writes in Arabic).
- ContactPage: currently only ContactPage + BreadcrumbList - no machine-readable address/phone/email despite all three being real, visible page content. Add a mainEntity (Organization with ContactPoint).
- About/Authors-list/Contact pages: none carry Organization or WebSite schema directly (only AboutPage/ContactPage/CollectionPage + BreadcrumbList). Not a hard defect (entity resolves sitewide via id references elsewhere) but self-contained schema per page is more robust for AI parsers fetching a single URL in isolation.
- Minor data-quality note: Article 1 schema reports wordCount 160 while visible .reader-body prose measures 463 words - worth checking the WordPress word-count function feeding Yoast schema output for Malayalam script; low priority.

## 10. Content Reformatting Suggestions

Split by the two genres actually observed, realistic for a Malayalam WordPress editorial team producing daily output, not a rigid word-count mandate:

- Analytical/historical pieces (like Article 1): already cover 2-3 natural sub-topics (Quranic imagery of paradise; the mosque specific artistic features; its influence on later architecture). Recommend adding 2-3 H2 subheadings splitting these naturally - no new research required.
- Short devotional/reflective pieces (like Article 2): do not force headings or padding - the short form is the genre. Standardize the existing closing Summary habit: keep it, but write it in Malayalam too (currently English-only in both samples).
- Sitewide: a lightweight style-guide addition - every article ends with a 2-4 sentence Malayalam takeaway - is more sustainable than a precise word-count target; treat 134-167 words as a soft target for the closing summary only.
- Article 1 specifically: historical claims (Umayyad-era construction, influence on the Alhambra and Dome of the Rock) have no linked source inside the body. A single further-reading/source link would strengthen Trustworthiness without changing the writing style.

## 11. Agent-Readiness Check

| Conversion | Result | Evidence |
|---|---|---|
| Read an article | Pass | Full SSR (section 7); reachable via plain anchor links. |
| Search | Pass | Real anchor link to /search/ (aria-label Search) reachable with no JS; /search/?q=... is a real GET-based form returning fully server-rendered results (section 7). A separate, unrelated search-type input scoped to the homepage Listen (episodes) widget has no form ancestor and is JS-only - a minor secondary widget, not the primary site search, which passes. |
| Contact | Partial | The /contact/ form has no action/method attribute (JS onSubmit implied) - a non-JS agent cannot submit it directly. Real, agent-reachable fallbacks exist in raw HTML: mailto:editor@islamonlive.in and https://wa.me/919895944006 (plus an article-submission WhatsApp deep link with pre-filled text). Net: contact conversion is achievable without JS via these fallbacks. |

Real interactive elements (anchors, inputs, forms) used throughout areas inspected; no fake clickable-div patterns found. Homepage near-total missing alt text (115/118 images) is a real gap for the screenshot+vision-model agent channel, separate from the DOM/accessibility-tree channel which otherwise looks sound.

## 12. Preferred Sources Status: Not implemented; exact markup not available in this skill references

Google Search Central documented an official, embeddable "set as preferred source" button on 2026-08-20 per this skill reference notes, but the literal HTML/JS snippet is not included in the seo-geo skill reference files available to this audit, and none was found on any fetched page (no preferred-source button/link markup on home, article, or about templates). Do not guess the markup - pull the exact snippet from Google Search Central live documentation before implementing. The closest named doc in this skill references is developers.google.com/search/docs/appearance/ai-features (general AI-features appearance/controls doc); the button-specific page should be located via Search Central "Preferred sources" documentation (published 2026-08-20) directly, since this audit cannot confirm the exact URL or markup offline.

Recommendation: Owner: Frontend, pending the exact snippet from Google. Embed the button on the homepage and article template once retrieved - this skill notes describe it as currently the single cheapest Preferred-Sources lever for a publisher/brand audit.

## 13. Measurement Setup

- GSC platform properties (added Jul 2026, no site-ownership proof required): connect the confirmed real YouTube (@IslamOnlivePortal) and Instagram (islam.onlive) accounts today - both eligible now, closing the current measurement gap on the off-site brand-mention work (sections 5, 8). Owner: Publisher (GSC account action).
- Standard GSC domain property for islamonlive.in: the team own docs/MIGRATION.md cutover checklist (step 7) already plans to resubmit sitemap_index.xml post-cutover - consistent with this audit, no conflict found. Owner: Publisher.
- Bing Webmaster Tools: no property/sitemap status could be checked from this environment; recommend verifying and submitting sitemap_index.xml there too. Owner: Publisher.
- News sitemap (/news-sitemap.xml): verified present, well-formed (proper news:publication, news:language=ml, news:publication_date), and current - top entry timestamp matched same-day publication at audit time. A genuine freshness-signal strength already in place; ensure it is submitted alongside the main sitemap index. Owner: Publisher (GSC submission); already generated correctly by the frontend.
- No DataForSEO/GSC/Bing credentials were available in this session - every platform-visibility statement above is structural/heuristic. Recommend re-running with DataForSEO ai_optimization_chat_gpt_scraper / ai_opt_llm_ment_search once available, or manually spot-checking ChatGPT/Perplexity/Google AI Overview responses for representative Malayalam Islamic queries after launch.

## Appendix: Confirmed non-issues (verified, not defects)

- /feed/ returns 404 locally by design: docs/MIGRATION.md (lines 47-48, 81-83) documents the WordPress proxy/redirect layer is disabled when SPLIT_HOSTS=false, the current pre-cutover state (admin.islamonlive.in has no DNS yet; WordPress and the site share the same host). The migration doc own cutover checklist (step 6) already includes re-testing /feed/ in production. No action needed pre-cutover; re-verify at cutover as already planned.
- Local vs live robots.txt text differs only in the Cloudflare legal preamble/wrapper comments and a trailing empty Yoast block - the actual bot-blocking directives and the Content-Signal line are identical in substance.
- RSL 1.0: confirmed absent (/rsl.xml and /.well-known/rsl.xml both return real 404s; no License directive in robots.txt). Given the live robots.txt already invokes EU Directive 2019/790 Article 4 rights-reservation language and ai-train=no, a formal RSL 1.0 file would be a low-urgency, defensible publisher-policy addition to formalize that same intent in the industry-standard machine-readable format (backed by Reddit, Yahoo, Medium, Cloudflare) - optional, not required.
