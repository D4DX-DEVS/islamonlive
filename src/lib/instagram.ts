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

export async function getReels(limit = 8): Promise<Reel[]> {
  const res = await fetch("https://islamonlive.in/", { next: { revalidate: 1800 } });
  if (!res.ok) return [];
  const out: Reel[] = [];
  const seen = new Set<string>();
  parseReels(await res.text(), out, seen, limit);

  // homepage widget renders 10; page the rest through Smash Balloon's load-more endpoint
  // (POST fetches skip the Next data cache — callers' page-level ISR covers it)
  let offset = out.length;
  while (out.length < limit && offset > 0) {
    const more = await fetch("https://islamonlive.in/wp-admin/admin-ajax.php", {
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
    if (!more?.ok) break;
    const { html } = (await more.json().catch(() => ({ html: "" }))) as { html?: string };
    if (!html) break;
    const before = out.length;
    parseReels(html, out, seen, limit);
    if (out.length === before) break; // feed exhausted
    offset += 10;
  }
  // newest first, like the Instagram profile
  return out.sort((a, b) => (b.date ?? 0) - (a.date ?? 0));
}
