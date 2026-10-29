import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { collection } from "@/lib/db/client";
import { loadFixture, seedFixtures } from "@/test/fixtures";

/* sitemap.ts in MongoDB mode. It keeps one code path for both sources and only
   swaps wpList() for lib/db/rest-list.ts, so these tests pin the rows that
   swap produces: which URLs, in which order, with which lastmod. */

type Sitemap = typeof import("@/lib/sitemap");
let sitemap: Sitemap;

const locs = (xml: string) => [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1].replace(/&amp;/g, "&"));
const lastmods = (xml: string) => [...xml.matchAll(/<lastmod>([^<]+)<\/lastmod>/g)].map((m) => m[1]);
const body = async (r: Response) => r.text();

const posts = loadFixture("posts");
const published = posts.filter((p) => p.status === "publish").sort((a, b) => a._id - b._id);

describe("sitemaps from MongoDB", () => {
  beforeAll(async () => {
    vi.stubEnv("DATA_SOURCE", "mongo");
    vi.resetModules();
    sitemap = await import("@/lib/sitemap");
    await seedFixtures();
  });

  afterAll(() => {
    vi.unstubAllEnvs();
  });

  it("lists every published post by id ascending, as the WordPress path asks for", async () => {
    const xml = await body(await sitemap.childSitemap("post", 1));
    expect(locs(xml)).toEqual(published.map((p) => `https://islamonlive.in${p.path}`));
  });

  it("writes lastmod from modified_gmt — the IST `modified` read as UTC lands 5.5 h in the future", async () => {
    const xml = await body(await sitemap.childSitemap("post", 1));
    expect(lastmods(xml)).toEqual(published.map((p) => new Date(`${p.modified_gmt}Z`).toISOString()));
  });

  it("dates the index's post files by the newest edit, in UTC", async () => {
    const xml = await body(await sitemap.sitemapIndex());
    const newest = [...published].sort((a, b) => b.modified_gmt.localeCompare(a.modified_gmt))[0];
    expect(lastmods(xml)[0]).toBe(new Date(`${newest.modified_gmt}Z`).toISOString());
  });

  it("keeps WordPress's lowercase percent-encoding of Malayalam slugs", async () => {
    const xml = await body(await sitemap.childSitemap("post", 1));
    const encoded = locs(xml).filter((u) => u.includes("%"));
    expect(encoded.length).toBeGreaterThan(0);
    for (const u of encoded) expect(u).toBe(u.replace(/%[0-9A-F]{2}/g, (m) => m.toLowerCase()));
  });

  it("drops a post an editor marked noindex", async () => {
    const target = published[0];
    const col = await collection("posts");
    await col.updateOne({ _id: target._id }, { $set: { "seo.robots.index": "noindex" } });
    try {
      const xml = await body(await sitemap.childSitemap("post", 1));
      expect(locs(xml)).not.toContain(`https://islamonlive.in${target.path}`);
    } finally {
      await col.updateOne({ _id: target._id }, { $set: { "seo.robots.index": "index" } });
    }
  });

  it("lists only categories and tags that have published posts, by name", async () => {
    const live = new Set(published.flatMap((p) => p.categories));
    const xml = await body(await sitemap.childSitemap("category", 1));
    const expected = loadFixture("categories")
      .filter((c) => live.has(c._id))
      .sort((a, b) => a.name.localeCompare(b.name, "en", { sensitivity: "base" }) || a._id - b._id)
      .map((c) => c.link);
    expect(locs(xml)).toEqual(expected);
  });

  it("lists only authors with published posts", async () => {
    const authors = new Set(published.map((p) => p.author_id));
    const xml = await body(await sitemap.childSitemap("author", 1));
    const listed = locs(xml);
    expect(listed.length).toBe(loadFixture("users").filter((u) => authors.has(u._id)).length);
  });

  it("indexes every child sitemap with Yoast's file names", async () => {
    const xml = await body(await sitemap.sitemapIndex());
    const files = locs(xml).map((u) => new URL(u).pathname);
    expect(files).toContain("/post-sitemap.xml");
    expect(files).toContain("/category-sitemap.xml");
    expect(files).toContain("/post_tag-sitemap.xml");
    expect(files).toContain("/author-sitemap.xml");
    expect(files.at(-1)).toBe("/news-sitemap.xml");
  });

  it("puts a post published in the last 48 hours in the news sitemap, with its title", async () => {
    const col = await collection("posts");
    const now = new Date();
    const gmt = now.toISOString().slice(0, 19);
    const local = new Date(now.getTime() + 5.5 * 3600_000).toISOString().slice(0, 19);
    const fresh = { ...published[0], _id: 9_100_001, slug: "fresh-news", path: "/news/fresh-news/", link: "https://islamonlive.in/news/fresh-news/", title: "Fresh &amp; new&#8230; A &gt; B", date: local, date_gmt: gmt, published_at: now };
    // a row with dates nothing can parse ("g…" sorts after any ISO date, so `after` keeps it)
    const broken = { ...fresh, _id: 9_100_002, slug: "broken-date", path: "/news/broken-date/", link: "https://islamonlive.in/news/broken-date/", date: "garbage", date_gmt: "garbage" };
    await col.insertMany([fresh, broken]);
    try {
      const response = await sitemap.newsSitemap();
      expect(response.status).toBe(200);
      const xml = await body(response);
      expect(locs(xml)).toContain("https://islamonlive.in/news/fresh-news/");
      // entities decoded once, then XML-escaped once: Google News shows "Fresh & new… A > B"
      expect(xml).toContain("<news:title>Fresh &amp; new… A &gt; B</news:title>");
      expect(xml).toContain(`<news:publication_date>${gmt}.000Z</news:publication_date>`);
      // the unparseable row is dropped, not printed as "undefined", and does not sink the file
      expect(locs(xml)).not.toContain("https://islamonlive.in/news/broken-date/");
      expect(xml).not.toContain("undefined");
    } finally {
      await col.deleteMany({ _id: { $in: [9_100_001, 9_100_002] } });
    }
  });
});
