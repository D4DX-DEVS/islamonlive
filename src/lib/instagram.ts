// Real reels come from Instagram (islam.onlive). Instagram blocks anonymous API access,
// but the WordPress homepage server-renders the Smash Balloon feed with reel links +
// signed CDN thumbnails - so we parse them from there. WP refreshes the signed URLs.
// Batches past the first 10 come from Smash Balloon's own load-more AJAX endpoint.
export interface Reel {
  id: string;
  url: string;
  thumbnail: string;
  /** signed CDN mp4 — plays inline, expires with the feed cache */
  video?: string;
  title?: string;
  /** unix seconds from the feed's data-date — used to sort newest first */
  date?: number;
}

function decode(s: string): string {
  return s
    .replace(/&#0?38;|&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}

/** value of a double-quoted attribute, decoded — null when absent */
function attr(block: string, name: string): string | null {
  const key = `${name}="`;
  const a = block.indexOf(key);
  if (a < 0) return null;
  const start = a + key.length;
  const end = block.indexOf('"', start);
  return end < 0 ? null : decode(block.slice(start, end));
}

/** parse Smash Balloon sbi_item blocks out of an HTML fragment */
function parseReels(html: string, out: Reel[], seen: Set<string>, limit: number): void {
  for (const block of html.split('class="sbi_item').slice(1)) {
    if (out.length >= limit) break;
    const a = block.indexOf("instagram.com/reel/");
    if (a < 0) continue;
    const idStart = a + "instagram.com/reel/".length;
    const idEnd = block.indexOf("/", idStart);
    const id = idEnd < 0 ? "" : block.slice(idStart, idEnd);
    if (!id || seen.has(id)) continue;
    const t = block.indexOf("scontent.cdninstagram.com", idEnd);
    if (t < 0) continue;
    const tEnd = block.indexOf('"', t);
    if (tEnd < 0) continue;
    seen.add(id);
    out.push({
      id,
      url: `https://www.instagram.com/reel/${id}/`,
      thumbnail: "https://" + decode(block.slice(t, tEnd)),
      video: attr(block, "data-video") ?? undefined,
      // caption embeds literal <br> tags for line breaks — rendered as plain text, so drop them
      title: attr(block, "data-title")?.replace(/<br\s*\/?>/gi, " ").replace(/\s+/g, " ").trim() || undefined,
      date: Number(attr(block, "data-date")) || undefined,
    });
  }
}

/* One page of the feed, straight from Smash Balloon's load-more endpoint.

   This, and NOT the homepage HTML, is where the video URLs have to come from.
   Instagram signs its CDN links and re-signs them every few hours; the
   homepage is behind WordPress's page cache, so the `data-video` links baked
   into it are usually hours or days stale and the CDN answers 403 for every
   one of them — which is why reels would not play even on islamonlive.in
   itself. admin-ajax.php is never page-cached, so the links it hands back are
   signed at that moment and play anywhere.

   The call costs about six seconds, and POST bodies are never put in Next's
   data cache, so pages are held off it by the small TTL cache below rather
   than by fetch options. */
const PAGE_TTL = 20 * 60 * 1000;
const pageCache = new Map<number, { at: number; html: string }>();

async function loadMore(offset: number, fresh = false): Promise<string> {
  const hit = pageCache.get(offset);
  if (!fresh && hit && Date.now() - hit.at < PAGE_TTL) return hit.html;

  const res = await fetch("https://islamonlive.in/wp-admin/admin-ajax.php", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      action: "sbi_load_more_clicked",
      offset: String(offset),
      page: "1",
      feed_id: "*1",
      atts: '{"feed":"1"}',
      location: "content",
      post_id: "132642",
      current_resolution: "full",
    }),
  }).catch(() => null);
  if (!res?.ok) return "";
  const { html } = (await res.json().catch(() => ({ html: "" }))) as { html?: string };
  if (html) pageCache.set(offset, { at: Date.now(), html });
  return html ?? "";
}

/** the feed, newest first, with freshly signed video links */
export async function getReels(limit = 8): Promise<Reel[]> {
  const out: Reel[] = [];
  const seen = new Set<string>();

  // every page at once: they are independent, and six seconds each in series
  // is what made /reels take fifteen
  const pages = await Promise.all(
    Array.from({ length: Math.ceil(limit / 10) }, (_, i) => loadMore(i * 10))
  );
  for (const html of pages) {
    if (!html) break;
    const before = out.length;
    parseReels(html, out, seen, limit);
    if (out.length === before) break; // feed exhausted
  }

  // last resort: the page-cached homepage. Its thumbnails and captions are
  // fine; its videos will mostly 403, and the player falls back to Instagram's
  // own embed for those.
  if (!out.length) {
    const res = await fetch("https://islamonlive.in/", { next: { revalidate: 1800 } }).catch(() => null);
    if (res?.ok) parseReels(await res.text(), out, seen, limit);
  }

  // newest first, like the Instagram profile
  return out.sort((a, b) => (b.date ?? 0) - (a.date ?? 0));
}

/** A freshly signed video link for one reel, by its shortcode.

    The player calls this through /api/reel when a link it was given has gone
    stale mid-session, so a reel that has been sitting on screen for an hour
    still plays instead of dropping to the embed. */
export async function getReelVideo(code: string): Promise<string | null> {
  // `fresh`: the caller is here precisely because the link it had has gone
  // stale, so a cached page would just hand back the same dead link
  const pages = await Promise.all(
    Array.from({ length: 5 }, (_, i) => loadMore(i * 10, true))
  );
  const seen = new Set<string>();
  for (const html of pages) {
    if (!html) continue;
    const page: Reel[] = [];
    parseReels(html, page, seen, 10);
    const found = page.find((r) => r.id === code);
    if (found?.video) return found.video;
  }
  return null;
}
