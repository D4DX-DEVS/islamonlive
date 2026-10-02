import { wpAdminRoute } from "@/lib/wp-admin";
import { parseEmbed } from "@/lib/video-embed";

/*
 * The article's featured video lives in the "Really Simple Featured Video"
 * plugin, not in the post itself: its data is private post meta that the core
 * REST API does not expose, so it is read and written through the plugin's own
 * routes (/rsfv/v1). Those routes are limited to administrators.
 */

export type FeaturedVideo = {
  /** False when the plugin cannot be used here; `message` then says why. */
  available: boolean;
  source: "" | "self" | "embed";
  embedUrl: string;
  mediaId: number;
  /** The uploaded file's address, for the preview. */
  url: string;
  message?: string;
};

export type VideoChange = { source: "embed"; url: string } | { source: "self"; mediaId: number } | { source: "none" };

const none: FeaturedVideo = { available: true, source: "", embedUrl: "", mediaId: 0, url: "" };

function failure(status: number, message?: string): string {
  if (status === 404) return "The featured video plugin is not active on this WordPress site.";
  if (status === 401 || status === 403) return "Only WordPress administrators can set a featured video.";
  return message || `The featured video plugin answered ${status}.`;
}

/** The video attached to a post. The plugin can only list posts, so the post is found by searching its title. */
export async function readFeaturedVideo(postId: number, title: string): Promise<FeaturedVideo> {
  try {
    const response = await wpAdminRoute(`/rsfv/v1/posts?${new URLSearchParams({ post_type: "post", search: title.slice(0, 200), per_page: "100" })}`);
    const rows = await response.json().catch(() => null);
    if (!response.ok) return { ...none, available: false, message: failure(response.status, rows?.message) };
    const row = (rows as { id: number; video_source?: string; video_id?: number; video_url?: string; embed_url?: string }[]).find((entry) => entry.id === postId);
    if (!row) return none;
    const source = row.video_source === "embed" && row.embed_url ? "embed" : row.video_source === "self" && row.video_id ? "self" : "";
    return { available: true, source, embedUrl: source === "embed" ? String(row.embed_url) : "", mediaId: source === "self" ? Number(row.video_id) : 0, url: source === "self" ? String(row.video_url || "") : "" };
  } catch (error) {
    return { ...none, available: false, message: error instanceof Error ? error.message : "Could not reach the featured video plugin." };
  }
}

/** What the editor chose, from the form field; "invalid" when it is not something the plugin would accept. */
export function parseVideoChange(raw: FormDataEntryValue | null): VideoChange | null | "invalid" {
  if (typeof raw !== "string" || !raw) return null;
  let value: { source?: string; url?: unknown; mediaId?: unknown };
  try { value = JSON.parse(raw); } catch { return "invalid"; }
  if (value.source === "none") return { source: "none" };
  if (value.source === "embed") return typeof value.url === "string" && parseEmbed(value.url) ? { source: "embed", url: value.url.trim() } : "invalid";
  if (value.source === "self") return Number.isInteger(value.mediaId) && Number(value.mediaId) > 0 ? { source: "self", mediaId: Number(value.mediaId) } : "invalid";
  return "invalid";
}

/** Attaches (or removes) the video; returns what went wrong, or null. The article itself is already saved by now. */
export async function saveFeaturedVideo(postId: number, change: VideoChange): Promise<string | null> {
  const body = change.source === "embed" ? { video_source: "embed", embed_url: change.url }
    : change.source === "self" ? { video_source: "self", video_id: change.mediaId }
    : { video_source: "self", video_id: 0 }; // the plugin clears the video when a file-based video has no file
  try {
    const response = await wpAdminRoute("/rsfv/v1/posts/update-video", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ post_id: postId, ...body }) });
    if (response.ok) return null;
    return failure(response.status, (await response.json().catch(() => null))?.message);
  } catch (error) {
    return error instanceof Error ? error.message : "Could not reach the featured video plugin.";
  }
}
