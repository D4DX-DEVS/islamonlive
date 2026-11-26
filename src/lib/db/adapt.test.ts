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

describe("articleExtras featured video and audio file", () => {
  const base = { excerpt: "<p>Body [&hellip;]</p>" };
  const fv = { media_id: null, url: null, embed_url: null, poster_id: null, poster_url: null };
  it("passes a linked video to the article", () => {
    expect(articleExtras({ ...base, featured_video: { ...fv, source: "embed", embed_url: "https://youtu.be/dQw4w9WgXcQ" } })).toEqual({ featured_video: { kind: "embed", url: "https://youtu.be/dQw4w9WgXcQ" } });
  });
  it("passes an uploaded video to the article", () => {
    expect(articleExtras({ ...base, featured_video: { ...fv, source: "self", media_id: 9, url: "https://cdn.example/v.mp4" } })).toEqual({ featured_video: { kind: "file", url: "https://cdn.example/v.mp4" } });
  });
  it("ignores a cleared video", () => {
    expect(articleExtras({ ...base, featured_video: null })).toEqual({});
  });
  it("passes the uploaded audio file", () => {
    expect(articleExtras({ ...base, meta: { _iol_audio_url: "https://cdn.example/a.mp3" } })).toEqual({ audio_file_url: "https://cdn.example/a.mp3" });
  });
});
