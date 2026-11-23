import { describe, expect, it } from "vitest";
import { parseSpotifyField, spotifyEmbed, SPOTIFY_META_KEY } from "./spotify";

const EPISODE = "https://open.spotify.com/episode/4rOoJ6Egrf8K2IrywzwOMk?si=abc";

describe("spotifyEmbed", () => {
  it("builds the player for an episode link", () => {
    expect(spotifyEmbed(EPISODE)).toEqual({ src: "https://open.spotify.com/embed/episode/4rOoJ6Egrf8K2IrywzwOMk", height: 152 });
  });

  it("gives shows and playlists the tall player", () => {
    expect(spotifyEmbed("https://open.spotify.com/show/1juxiGQT9bAOsCKCRYeFi0")?.height).toBe(352);
  });

  it("accepts country-prefixed share links", () => {
    expect(spotifyEmbed("https://open.spotify.com/intl-ml/episode/4rOoJ6Egrf8K2IrywzwOMk")?.src).toBe("https://open.spotify.com/embed/episode/4rOoJ6Egrf8K2IrywzwOMk");
  });

  it("refuses other hosts, even ones the homepage embeds", () => {
    expect(spotifyEmbed("https://www.youtube.com/watch?v=dQw4w9WgXcQ")).toBeNull();
    expect(spotifyEmbed("https://evil.example/episode/4rOoJ6Egrf8K2IrywzwOMk")).toBeNull();
    expect(spotifyEmbed("http://open.spotify.com/episode/4rOoJ6Egrf8K2IrywzwOMk")).toBeNull();
  });

  it("refuses empty, malformed and over-long input", () => {
    expect(spotifyEmbed("")).toBeNull();
    expect(spotifyEmbed(null)).toBeNull();
    expect(spotifyEmbed("open.spotify.com/episode/x")).toBeNull();
    expect(spotifyEmbed(`${EPISODE}&pad=${"x".repeat(400)}`)).toBeNull();
  });
});

describe("parseSpotifyField", () => {
  it("is null when the form did not send the field", () => {
    expect(parseSpotifyField(null)).toBeNull();
  });

  it("clears the link with an empty value", () => {
    expect(parseSpotifyField("  ")).toEqual({ [SPOTIFY_META_KEY]: "" });
  });

  it("keeps a valid link, trimmed", () => {
    expect(parseSpotifyField(` ${EPISODE} `)).toEqual({ [SPOTIFY_META_KEY]: EPISODE });
  });

  it("flags anything that is not a Spotify link", () => {
    expect(parseSpotifyField("https://example.com/audio.mp3")).toBe("invalid");
  });
});
