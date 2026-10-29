import { describe, expect, it } from "vitest";
import { atPermalink, seoMetadata, seoSchema, type YoastHead } from "@/lib/seo";

/* atPermalink: an old Yoast indexable that still names a category the post has
   left must not publish a canonical (or schema @ids) at an address the article
   route 308s away from. Shape taken from post 136400 in the archive. */

const stale = "https://islamonlive.in/columns/your-voice/journey-to-the-forests-of-muthanga/";
const real = "/culture/travel/journey-to-the-forests-of-muthanga/";

function head(url: string): YoastHead {
  return {
    title: "Muthanga | Islamonlive.in",
    canonical: url,
    og_url: url,
    schema: {
      "@context": "https://schema.org",
      "@graph": [
        { "@type": "Article", "@id": `${url}#article`, isPartOf: { "@id": url }, mainEntityOfPage: { "@id": url }, image: { "@id": `${url}#primaryimage` } },
        { "@type": "WebPage", "@id": url, url, breadcrumb: { "@id": `${url}#breadcrumb` } },
        {
          "@type": "BreadcrumbList",
          "@id": `${url}#breadcrumb`,
          itemListElement: [
            { "@type": "ListItem", position: 1, item: "https://islamonlive.in/" },
            { "@type": "ListItem", position: 2, item: "https://islamonlive.in/category/columns/your-voice/" },
          ],
        },
        { "@type": "WebSite", "@id": "https://islamonlive.in/#website", url: "https://islamonlive.in/" },
      ],
    },
  };
}

describe("atPermalink", () => {
  it("moves canonical, og:url and every schema reference to the real permalink", () => {
    const y = atPermalink(head(stale), real)!;
    const site = `https://islamonlive.in${real}`;
    expect(y.canonical).toBe(site);
    expect(y.og_url).toBe(site);
    const json = JSON.stringify(y.schema);
    expect(json).not.toContain("/columns/your-voice/journey");
    expect(json).toContain(`${site}#article`);
    expect(json).toContain(`${site}#primaryimage`);
    expect(json).toContain(`${site}#breadcrumb`);
  });

  it("leaves other URLs alone — the category archive in the breadcrumb, the site root", () => {
    const json = JSON.stringify(atPermalink(head(stale), real)!.schema);
    expect(json).toContain("https://islamonlive.in/category/columns/your-voice/");
    expect(json).toContain("https://islamonlive.in/#website");
  });

  it("returns a head that already agrees untouched (same object)", () => {
    const y = head(`https://islamonlive.in${real}`);
    expect(atPermalink(y, real)).toBe(y);
  });

  it("treats Yoast's decoded Malayalam canonical and the encoded permalink as the same address", () => {
    const encoded = "/opinion/%e0%b4%b8%e0%b4%bf%e0%b4%b1/";
    const y = head(`https://islamonlive.in${decodeURI(encoded)}`);
    expect(atPermalink(y, encoded)).toBe(y);
  });

  it("keeps the decoded form where Yoast wrote one, the encoded one in schema", () => {
    const staleEncoded = "/columns/%e0%b4%b8%e0%b4%bf%e0%b4%b1/";
    const realEncoded = "/culture/%e0%b4%b8%e0%b4%bf%e0%b4%b1/";
    // Yoast's quirk: canonical/og:url decoded, schema @ids percent-encoded
    const y = head(`https://islamonlive.in${staleEncoded}`);
    y.canonical = y.og_url = `https://islamonlive.in${decodeURI(staleEncoded)}`;
    const moved = atPermalink(y, realEncoded)!;
    expect(moved.canonical).toBe(`https://islamonlive.in${decodeURI(realEncoded)}`);
    expect(JSON.stringify(moved.schema)).toContain(`https://islamonlive.in${realEncoded}#article`);
  });

  it("moves a draft-era /?p=ID canonical, and only the URLs that name it", () => {
    // post 127577's real shape: Yoast captured the indexable before the slug existed
    const y = head("https://islamonlive.in/?p=127577");
    const moved = atPermalink(y, real)!;
    const site = `https://islamonlive.in${real}`;
    expect(moved.canonical).toBe(site);
    const json = JSON.stringify(moved.schema);
    expect(json).not.toContain("?p=127577");
    expect(json).toContain(`${site}#article`);
    // the site root has an empty path too: it must not be mistaken for the stale address
    expect(json).toContain('"@id":"https://islamonlive.in/#website"');
    expect(json).toContain('"item":"https://islamonlive.in/"');
  });

  it("leaves an editor's cross-post canonical alone", () => {
    const y = head("https://islamonlive.in/news/original-story/");
    expect(atPermalink(y, real)).toBe(y);
  });

  it("leaves a bare site-root canonical alone rather than rewriting every root URL", () => {
    const y = head("https://islamonlive.in/");
    expect(atPermalink(y, real)).toBe(y);
  });

  it("passes undefined and canonical-less heads through", () => {
    expect(atPermalink(undefined, real)).toBeUndefined();
    const y: YoastHead = { title: "x" };
    expect(atPermalink(y, real)).toBe(y);
  });

  it("drops an address-less ImageObject and every reference to it (featured file deleted)", () => {
    const url = `https://islamonlive.in${real}`;
    const y = head(url);
    const graph = y.schema!["@graph"] as Record<string, unknown>[];
    graph[0].thumbnailUrl = "";
    graph[1].primaryImageOfPage = { "@id": `${url}#primaryimage` };
    graph.push({ "@type": "ImageObject", "@id": `${url}#primaryimage`, url: "", contentUrl: "" });
    const out = seoSchema(y)!["@graph"] as Record<string, unknown>[];
    expect(out.some((n) => n["@type"] === "ImageObject")).toBe(false);
    expect(JSON.stringify(out)).not.toContain("#primaryimage");
    expect(out[0]).not.toHaveProperty("thumbnailUrl");
    // a real image is kept
    graph[graph.length - 1] = { "@type": "ImageObject", "@id": `${url}#primaryimage`, url: "https://islamonlive.in/wp-content/uploads/a.jpg", contentUrl: "https://islamonlive.in/wp-content/uploads/a.jpg" };
    expect(JSON.stringify(seoSchema(y))).toContain("#primaryimage");
  });

  it("reaches the rendered metadata and JSON-LD", () => {
    const y = atPermalink(head(stale), real);
    const meta = seoMetadata(y, { path: real });
    expect(String(meta.alternates?.canonical)).toBe(`https://islamonlive.in${real}`);
    expect(JSON.stringify(seoSchema(y))).not.toContain("/columns/your-voice/journey");
  });
});
