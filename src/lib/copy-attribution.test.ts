import { describe, expect, it } from "vitest";
import { attributesPath, sourceUrl, withAttribution } from "./copy-attribution";

const here = { origin: "https://islamonlive.in", pathname: "/culture/history/some-post/" };

describe("sourceUrl", () => {
  it("uses the canonical link when it is on this site", () => {
    expect(sourceUrl(here, "https://islamonlive.in/culture/history/real-post/?utm=x#top")).toBe("https://islamonlive.in/culture/history/real-post/");
  });

  it("resolves a relative canonical", () => {
    expect(sourceUrl(here, "/culture/history/real-post/")).toBe("https://islamonlive.in/culture/history/real-post/");
  });

  it("ignores a canonical on another host and falls back to the page address", () => {
    expect(sourceUrl(here, "https://wp.example.com/culture/history/real-post/")).toBe("https://islamonlive.in/culture/history/some-post/");
    expect(sourceUrl(here, null)).toBe("https://islamonlive.in/culture/history/some-post/");
  });
});

describe("attributesPath", () => {
  it("credits public pages", () => {
    expect(attributesPath("/")).toBe(true);
    expect(attributesPath("/culture/history/some-post/")).toBe(true);
    expect(attributesPath("/administration-news/x/")).toBe(true);
  });

  it("leaves the admin and previews alone", () => {
    expect(attributesPath("/admin")).toBe(false);
    expect(attributesPath("/admin/articles/")).toBe(false);
    expect(attributesPath("/preview/123/")).toBe(false);
  });
});

describe("withAttribution", () => {
  const url = "https://islamonlive.in/culture/history/some-post/";

  it("adds a blank line and the link after the copied text", () => {
    expect(withAttribution("ഒരു ഖണ്ഡിക.\n", "<p>ഒരു ഖണ്ഡിക.</p>", url)).toEqual({
      text: `ഒരു ഖണ്ഡിക.\n\n${url}`,
      html: `<p>ഒരു ഖണ്ഡിക.</p><br><br><a href="${url}">${url}</a>`,
    });
  });

  it("builds escaped HTML when the selection carried none", () => {
    expect(withAttribution("a < b\nc", "", url)?.html).toBe(`a &lt; b<br>c<br><br><a href="${url}">${url}</a>`);
  });

  it("does nothing for an empty selection", () => {
    expect(withAttribution("  \n", "", url)).toBeNull();
  });
});
