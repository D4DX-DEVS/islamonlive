import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { beforeAll, describe, expect, it } from "vitest";
import { cdata, latestFeedComments, latestFeedPosts, renderAtom, renderCommentsRss, renderRss, rfc822, rfc3339 } from "@/lib/rss";
import { seedFixtures } from "@/test/fixtures";

/* The live WordPress feeds saved on 2026-10-27 are the spec. Their ten posts
   are all in the fixture slice, the newest with its full body, so items can be
   compared byte for byte. */
const ref = (name: string) => readFileSync(fileURLToPath(new URL(`./__fixtures__/feeds/${name}`, import.meta.url)), "utf8");
const items = (xml: string, tag: string) => [...xml.matchAll(new RegExp(`\\t<${tag}>[\\s\\S]*?</${tag}>`, "g"))].map((m) => m[0]);
// <updated> is the post's last edit; the newest post was edited on WordPress after the export
const noUpdated = (entry: string) => entry.replace(/<updated>[^<]*</, "<updated>…<");
const withoutBody = (item: string) => noUpdated(item.replace(/<(description|content:encoded|summary|content)\b[^>]*>[\s\S]*?<\/\1>/g, "<$1/>"));
const header = (xml: string) => xml.slice(0, xml.indexOf("<item>") > 0 ? xml.indexOf("\t<item>") : xml.indexOf("\t<entry>")).replace(/<(lastBuildDate|updated)>[^<]*</, "<$1>…<");

describe("feeds", () => {
  beforeAll(async () => {
    await seedFixtures();
  });

  it("formats dates the way WordPress does", () => {
    const d = new Date("2026-10-27T04:52:58Z");
    expect(rfc822(d)).toBe("Tue, 27 Oct 2026 04:52:58 +0000");
    expect(rfc3339(d)).toBe("2026-10-27T04:52:58Z");
  });

  it("keeps ]]> from closing a CDATA section early", () => {
    expect(cdata("a]]>b")).toBe("<![CDATA[a]]]]><![CDATA[>b]]>");
  });

  it("lists the same ten posts, newest first, as the live feed", async () => {
    const posts = await latestFeedPosts();
    const live = [...ref("reference-rss.xml").matchAll(/\?p=(\d+)<\/guid>/g)].map((m) => Number(m[1]));
    expect(posts.map((p) => p.post.id)).toEqual(live);
  });

  it("reproduces the live RSS channel and the newest item byte for byte", async () => {
    const ours = renderRss(await latestFeedPosts());
    const live = ref("reference-rss.xml");
    expect(header(ours)).toBe(header(live));
    expect(items(ours, "item")[0]).toBe(items(live, "item")[0]);
  });

  it("matches every other RSS item apart from the (fixture-trimmed) bodies", async () => {
    const ours = items(renderRss(await latestFeedPosts()), "item").map(withoutBody);
    const live = items(ref("reference-rss.xml"), "item").map(withoutBody);
    expect(ours).toEqual(live);
  });

  it("reproduces the live Atom feed header and entries", async () => {
    const ours = renderAtom(await latestFeedPosts());
    const live = ref("reference-atom.xml");
    expect(header(ours)).toBe(header(live));
    expect(noUpdated(items(ours, "entry")[0])).toBe(noUpdated(items(live, "entry")[0]));
    expect(items(ours, "entry").map(withoutBody)).toEqual(items(live, "entry").map(withoutBody));
  });

  it("never exposes the backend or Cloudways hosts", async () => {
    const all = renderRss(await latestFeedPosts()) + renderAtom(await latestFeedPosts());
    expect(all).not.toMatch(/admin\.islamonlive\.in|cloudwaysapps\.com/);
  });

  it("renders a valid comments feed from the comments collection (empty is fine)", async () => {
    const xml = renderCommentsRss(await latestFeedComments());
    expect(xml).toContain("<atom:link href=\"https://islamonlive.in/comments/feed/\"");
    expect(xml.trim().endsWith("</rss>")).toBe(true);
  });
});
