import { describe, expect, it } from "vitest";
import { articleExtras } from "./adapt";
import { SPOTIFY_META_KEY } from "@/lib/spotify";

describe("articleExtras", () => {
  it("shows the excerpt an editor typed in the admin", () => {
    expect(articleExtras({ excerpt: "<p>x</p>", excerpt_raw: "Typed summary &amp; more" })).toEqual({ manual_excerpt: "Typed summary & more" });
  });

  it("hides an auto-excerpt saved from the admin", () => {
    expect(articleExtras({ excerpt: "<p>Body start [&hellip;]</p>\n", excerpt_raw: "" })).toEqual({});
  });

  it("judges migrated posts by WordPress's [...] ending", () => {
    expect(articleExtras({ excerpt: "<p>Body start [&hellip;]</p>\n" })).toEqual({});
    expect(articleExtras({ excerpt: "<p>Hand written &#8211; summary</p>\n" })).toEqual({ manual_excerpt: "Hand written – summary" });
  });

  it("keeps the editor's line breaks", () => {
    expect(articleExtras({ excerpt: "<p>one<br />\ntwo</p>\n" }).manual_excerpt).toBe("one\ntwo");
  });

  it("carries the Spotify link from the post meta", () => {
    expect(articleExtras({ excerpt: "", excerpt_raw: "", meta: { [SPOTIFY_META_KEY]: " https://open.spotify.com/episode/4rOoJ6Egrf8K2IrywzwOMk " } }))
      .toEqual({ spotify_url: "https://open.spotify.com/episode/4rOoJ6Egrf8K2IrywzwOMk" });
    expect(articleExtras({ excerpt: "", excerpt_raw: "", meta: { [SPOTIFY_META_KEY]: "" } })).toEqual({});
  });
});
