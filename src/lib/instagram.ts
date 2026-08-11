// Real reels come from Instagram (islam.onlive). Instagram blocks anonymous API access,
// but the WordPress homepage server-renders the Smash Balloon feed with reel links +
// signed CDN thumbnails - so we parse them from there. WP refreshes the signed URLs.
export interface Reel {
  id: string;
  url: string;
  thumbnail: string;
}

export async function getReels(limit = 8): Promise<Reel[]> {
  const res = await fetch("https://islamonlive.in/", { next: { revalidate: 1800 } });
  if (!res.ok) return [];
  const html = await res.text();
  const out: Reel[] = [];
  const seen = new Set<string>();
  let pos = 0;
  while (out.length < limit) {
    const a = html.indexOf("instagram.com/reel/", pos);
    if (a < 0) break;
    const idStart = a + "instagram.com/reel/".length;
    const idEnd = html.indexOf("/", idStart);
    const id = html.slice(idStart, idEnd);
    pos = idEnd;
    if (seen.has(id) || !id) continue;
    const t = html.indexOf("scontent.cdninstagram.com", idEnd);
    if (t < 0) break;
    const tEnd = html.indexOf('"', t);
    const thumbnail = "https://" + html.slice(t, tEnd).split("&#038;").join("&");
    seen.add(id);
    out.push({ id, url: `https://www.instagram.com/reel/${id}/`, thumbnail });
  }
  return out;
}
