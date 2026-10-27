import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { buildPostSeo, loadSeoRefs, pickedPrimaryCategory, rawTitleOf, renderTitle, yoastWordCount, type SeoDocInput } from "@/lib/admin-rest/posts-seo";
import type { PostDoc } from "@/lib/db/types";
import { loadFixture, seedFixtures } from "@/test/fixtures";

/* Regenerate the Yoast head of every published fixture post from the post's
   own fields and compare it with what Yoast served, field by field. A field
   an editor wrote by hand (custom SEO title/description) is fed back as the
   meta it came from and kept out of that field's score, so the numbers
   measure the templates, not the copying. */

const SITE_SUFFIX = " | Islamonlive.in | The one and only Comprehensive Islamic portal in Malayalam";
const TRIMMED = 1500; // make-fixtures.mjs cuts all but a few bodies to this length

// fields that reach the rendered <head> or JSON-LD (lib/seo.ts); og_locale, og_site_name,
// the WebSite node and inLanguage are overwritten there, twitter_misc is never read
const HEAD = /^(title|description|canonical|robots|og_type|og_title|og_description|og_url|og_image|article_published_time|article_modified_time|author|twitter_card|twitter_site|twitter_creator|schema\.(Article|WebPage|ImageObject|BreadcrumbList|Person)\.(?!inLanguage))/;

type Stat = { match: number; total: number; misses: string[] };
const stats = new Map<string, Stat>();
const stale: number[] = [];
function score(field: string, ok: boolean, detail: string) {
  const s = stats.get(field) ?? { match: 0, total: 0, misses: [] };
  s.total++;
  if (ok) s.match++;
  else if (s.misses.length < 4) s.misses.push(detail);
  stats.set(field, s);
}

// Yoast served the newest posts while WordPress answered on admin.islamonlive.in;
// lib/seo.ts moves every such URL onto the public host, so the host is not a difference
const publicHost = (v: unknown) => JSON.stringify(v)?.replaceAll("https://admin.islamonlive.in", "https://islamonlive.in");
const same = (a: unknown, b: unknown) => publicHost(a) === publicHost(b);
const typeOf = (n: Record<string, unknown>) => String(n["@type"]);

/** Rendered body back to roughly the raw post_content (undo wptexturize's entities). */
const rawContentOf = (html: string) =>
  html.replace(/&#82(16|17);/g, "'").replace(/&#82(20|21);/g, '"').replace(/&#8230;/g, "...").replace(/&#8211;/g, "-").replace(/&#8212;/g, "--").replace(/&#038;/g, "&").replace(/&#215;/g, "x");

const posts = loadFixture("posts").filter((p) => p.status === "publish" && p.seo) as PostDoc[];
const categories = loadFixture("categories");

describe("Yoast head for posts saved through the MongoDB admin", () => {
  beforeAll(async () => {
    await seedFixtures();
    for (const p of posts) {
      const stored = p.seo!;
      const raw = rawTitleOf(p.title);
      const templatedTitle = `${raw}${SITE_SUFFIX}`;
      const picked = pickedPrimaryCategory(p, categories);
      const templatedDesc = picked ? `${raw} | ${picked.name}` : `${raw} |`;
      const customTitle = stored.title !== undefined && stored.title !== templatedTitle;
      const customDesc = stored.description !== undefined && stored.description !== templatedDesc;
      const input: SeoDocInput = {
        _id: p._id,
        title: p.title,
        content: rawContentOf(p.content),
        link: p.link,
        date: p.date,
        date_gmt: p.date_gmt,
        modified_gmt: p.modified_gmt,
        meta: { ...(customTitle ? { _yoast_wpseo_title: stored.title! } : {}), ...(customDesc ? { _yoast_wpseo_metadesc: stored.description! } : {}) },
        author_id: p.author_id,
        featured_media_id: p.featured_media_id,
        categories: p.categories,
        tags: p.tags,
        picked_primary_category_id: picked?._id ?? null,
      };
      // a new post has only the author's earlier posts to take the Person @id from
      const refs = await loadSeoRefs(input, { excludeSelfFromPerson: true });
      const ours = buildPostSeo(input, refs) as Record<string, unknown>;
      const theirs = stored as Record<string, unknown>;
      const fullBody = p.content.length !== TRIMMED;
      /* Yoast's head is a snapshot of its indexable; when an editor moved the
         post to another category WordPress did not always rebuild it, so the
         canonical (and anything else recorded then) describes an older post.
         A fresh save cannot reproduce a stale snapshot: counted, not scored. */
      if (!same(ours.canonical, stored.canonical)) {
        stale.push(p._id);
        continue;
      }

      for (const key of new Set([...Object.keys(theirs), ...(theirs.schema ? Object.keys(ours) : [])])) {
        if (key === "schema") continue;
        if (key === "article_author") continue; // 4 posts in the archive; a Facebook URL editors typed on old profiles
        if ((key === "title" && customTitle) || ((key === "description" || key === "og_description") && customDesc)) continue;
        score(key, same(ours[key], theirs[key]), `${p._id}: ${JSON.stringify(ours[key])} ≠ ${JSON.stringify(theirs[key])}`);
      }
      const graph = (theirs.schema as { "@graph"?: Record<string, unknown>[] } | undefined)?.["@graph"];
      if (!graph) continue;
      const ourGraph = (ours.schema as { "@graph": Record<string, unknown>[] })["@graph"];
      score("schema.@graph types", same(ourGraph.map(typeOf), graph.map(typeOf)), `${p._id}: ${ourGraph.map(typeOf)} ≠ ${graph.map(typeOf)}`);
      for (const node of graph) {
        const mine = ourGraph.find((n) => typeOf(n) === typeOf(node)) ?? {};
        for (const key of new Set([...Object.keys(node), ...Object.keys(mine)])) {
          const field = `schema.${typeOf(node)}.${key}`;
          if (!refs.person && (field === "schema.Person.@id" || field === "schema.Article.author" || field === "schema.WebPage.author")) continue;
          if (field === "schema.Article.wordCount" && !fullBody) continue;
          if (customTitle && field === "schema.WebPage.name") continue;
          if (customDesc && field === "schema.WebPage.description") continue;
          score(field, same(mine[key], node[key]), `${p._id}: ${JSON.stringify(mine[key])?.slice(0, 160)} ≠ ${JSON.stringify(node[key])?.slice(0, 160)}`);
        }
      }
    }
  });

  afterAll(() => {
    const rows = [...stats.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([field, s]) => ({ field, head: HEAD.test(field) ? "yes" : "", match: `${s.match}/${s.total}`, pct: Math.round((s.match / s.total) * 1000) / 10 }));
    console.table(rows);
    console.log(`stale Yoast snapshots (not scored): ${stale.length}/${posts.length} — ${stale.join(", ")}`);
  });

  it("scored every published post whose Yoast snapshot is current (stale ones are rare)", () => {
    expect(stats.get("robots")!.total + stale.length).toBe(posts.length);
    expect(stale.length / posts.length).toBeLessThan(0.05);
  });

  it("matches Yoast on every field that reaches the page head, at 95% or better", () => {
    const low = [...stats.entries()]
      .filter(([field]) => HEAD.test(field))
      .filter(([, s]) => s.match / s.total < 0.95)
      .map(([field, s]) => `${field} ${s.match}/${s.total} — ${s.misses.join(" | ")}`);
    expect(low).toEqual([]);
  });

  it("counts words the way PHP's str_word_count does for Yoast", () => {
    // archive posts with a raw body: these are Yoast's own counts
    expect(yoastWordCount("x", "Also read - Also read -")).toBe(6);
    expect(yoastWordCount("", "Prophet's mosque")).toBe(3);
    expect(yoastWordCount("", "മലയാളം - മലയാളം -")).toBe(1);
  });

  it("renders a typed title the way WordPress shows it", () => {
    expect(renderTitle("മുത്തങ്ങയിൽ...")).toBe("മുത്തങ്ങയിൽ&#8230;");
    expect(renderTitle("'ഇസ്ലാം ഭീതി നല്ലതിനാണ്'")).toBe("&#8216;ഇസ്ലാം ഭീതി നല്ലതിനാണ്&#8217;");
    expect(renderTitle("Art & Literature - 2026")).toBe("Art &#038; Literature &#8211; 2026");
    const titles = posts.map((p) => p.title);
    const roundTrip = titles.filter((t) => renderTitle(rawTitleOf(t)) === t.trim()).length;
    expect(roundTrip / titles.length).toBeGreaterThan(0.95);
  });
});
