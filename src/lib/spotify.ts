import { embedFor } from "@/lib/home-layout/schema";

/** The post meta key an article's Spotify link is kept under (the admin writes it, the article page reads it). */
export const SPOTIFY_META_KEY = "_iol_spotify_url";
/** Longest Spotify link accepted; a real share link is well under this. */
export const MAX_SPOTIFY_URL = 300;

export interface SpotifyEmbed {
  /** The player address, rebuilt from the parsed id — never the pasted text. */
  src: string;
  height: number;
}

/**
 * The Spotify player for an episode, show, track, playlist or album link, or
 * null for anything else. Reuses the homepage embed parser, so the host is
 * allow-listed and a pasted link can never put another page in the iframe.
 */
export function spotifyEmbed(input: string | null | undefined): SpotifyEmbed | null {
  const text = (input ?? "").trim();
  if (!text || text.length > MAX_SPOTIFY_URL) return null;
  const embed = embedFor(text);
  if (!embed?.src.startsWith("https://open.spotify.com/embed/")) return null;
  return { src: embed.src, height: embed.height ?? 152 };
}

/**
 * What a save sends for the Spotify link: the meta to store ("" clears it),
 * null when the form did not send the field, or "invalid" for a link that is
 * not a Spotify one.
 */
export function parseSpotifyField(raw: FormDataEntryValue | null): Record<string, string> | null | "invalid" {
  if (typeof raw !== "string") return null;
  const text = raw.trim();
  if (!text) return { [SPOTIFY_META_KEY]: "" };
  return spotifyEmbed(text) ? { [SPOTIFY_META_KEY]: text } : "invalid";
}

/** The post meta key for an audio file uploaded to the media library (played with the browser's own player). */
export const AUDIO_FILE_META_KEY = "_iol_audio_url";
const MAX_AUDIO_FILE_URL = 500;
const AUDIO_FILE_PATH = /\.(mp3|m4a|aac|wav|ogg|oga|opus)$/i;

/** The address of an uploaded audio file, or null when it is not an https link to an audio file. */
export function audioFileUrl(input: string | null | undefined): string | null {
  const text = (input ?? "").trim();
  if (!text || text.length > MAX_AUDIO_FILE_URL) return null;
  try {
    const url = new URL(text);
    return url.protocol === "https:" && AUDIO_FILE_PATH.test(url.pathname) ? url.href : null;
  } catch { return null; }
}

/** The meta to store for the uploaded audio file ("" clears it), null when not sent, "invalid" otherwise. */
export function parseAudioFileField(raw: FormDataEntryValue | null): Record<string, string> | null | "invalid" {
  if (typeof raw !== "string") return null;
  const text = raw.trim();
  if (!text) return { [AUDIO_FILE_META_KEY]: "" };
  const url = audioFileUrl(text);
  return url ? { [AUDIO_FILE_META_KEY]: url } : "invalid";
}
