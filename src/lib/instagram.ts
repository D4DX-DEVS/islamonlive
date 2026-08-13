// Real reels come from Instagram (islam.onlive). Instagram blocks anonymous API access,
// but the WordPress homepage server-renders the Smash Balloon feed with reel links +
// signed CDN thumbnails - so we parse them from there. WP refreshes the signed URLs.
export interface Reel {
  id: string;
  url: string;
  thumbnail: string;
  /** signed CDN mp4 — plays inline, expires with the feed cache */
  video?: string;
  title?: string;
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

export async function getReels(limit = 8): Promise<Reel[]> {
  const res = await fetch("https://islamonlive.in/", { next: { revalidate: 1800 } });
  if (!res.ok) return [];
  const html = await res.text();
  const out: Reel[] = [];
  const seen = new Set<string>();
  // one Smash Balloon item per block — keeps each reel's mp4/caption with its own id
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
      title: attr(block, "data-title") ?? undefined,
    });
  }
  return out;
}
