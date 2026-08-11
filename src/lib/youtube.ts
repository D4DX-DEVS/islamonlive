// Scrapes the public YouTube channel pages (no API key needed).
// ponytail: HTML scrape of ytInitialData; if YouTube markup changes, switch to YouTube Data API v3.
const CHANNEL = "https://www.youtube.com/@IslamOnlivePortal";
const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120 Safari/537.36";

export interface YTVideo {
  id: string;
  title: string;
  thumbnail: string;
  url: string;
}

async function fetchChannelPage(path: "videos" | "shorts"): Promise<string> {
  const res = await fetch(`${CHANNEL}/${path}`, {
    headers: { "User-Agent": UA, "Accept-Language": "en" },
    next: { revalidate: 3600 },
  });
  if (!res.ok) return "";
  return res.text();
}

// YouTube renders channel grids as "lockupViewModel" blocks:
// thumbnail URL carries the video id (/vi/<id>/), metadata carries the title.
export async function getVideos(limit = 8): Promise<YTVideo[]> {
  const html = await fetchChannelPage("videos");
  const out: YTVideo[] = [];
  const seen = new Set<string>();
  for (const block of html.split('"lockupViewModel":{').slice(1)) {
    const vi = block.indexOf("/vi/");
    if (vi < 0) continue;
    const id = block.slice(vi + 4, vi + 15);
    if (!/^[\w-]{11}$/.test(id) || seen.has(id)) continue;
    seen.add(id);
    const tj = block.indexOf('"title":{"content":"');
    const title = tj >= 0 ? block.slice(tj + 20, block.indexOf('"', tj + 20)) : "";
    out.push({
      id,
      title,
      thumbnail: `https://i.ytimg.com/vi/${id}/hqdefault.jpg`,
      url: `https://www.youtube.com/watch?v=${id}`,
    });
    if (out.length >= limit) break;
  }
  return out;
}

export async function getShorts(limit = 8): Promise<YTVideo[]> {
  const html = await fetchChannelPage("shorts");
  const out: YTVideo[] = [];
  const seen = new Set<string>();
  for (const m of html.matchAll(/"videoId":"([\w-]{11})"/g)) {
    const id = m[1];
    if (seen.has(id)) continue;
    seen.add(id);
    out.push({
      id,
      title: "",
      // hqdefault always exists; portrait oardefault is missing for some shorts
      thumbnail: `https://i.ytimg.com/vi/${id}/hqdefault.jpg`,
      url: `https://www.youtube.com/shorts/${id}`,
    });
    if (out.length >= limit) break;
  }
  return out;
}
