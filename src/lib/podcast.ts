// Anchor.fm (Spotify for Podcasters) RSS feed of the site's podcast.
const RSS_URL = "https://anchor.fm/s/de450e50/podcast/rss";

export interface Episode {
  title: string;
  /** title minus the trailing "| speaker" — the subject on its own */
  topic: string;
  /** speaker credited after the last "|" in the title, else the feed's creator */
  speaker: string;
  audioUrl: string;
  date: string;
  duration: string;
  image: string;
  link: string;
}

export async function getEpisodes(limit = 8): Promise<Episode[]> {
  const res = await fetch(RSS_URL, { next: { revalidate: 1800 } });
  if (!res.ok) return [];
  const xml = await res.text();
  const items = xml.split("<item>").slice(1, limit + 1);
  return items.map((it) => {
    const pick = (re: RegExp) => it.match(re)?.[1] ?? "";
    const title = pick(/<title>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/title>/).trim();
    // the feed has no per-episode speaker field — every title is "subject | speaker",
    // so split on the last pipe. No pipe = no credit, fall back to the feed creator.
    const cut = title.lastIndexOf("|");
    const creator = pick(/<dc:creator>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/dc:creator>/).trim();
    return {
      title,
      topic: cut > 0 ? title.slice(0, cut).trim() : title,
      speaker: cut > 0 ? title.slice(cut + 1).trim() : creator,
      audioUrl: pick(/<enclosure url="([^"]+)"/),
      date: pick(/<pubDate>([^<]*)/),
      duration: pick(/<itunes:duration>([^<]*)/),
      image: pick(/<itunes:image href="([^"]+)"/),
      link: pick(/<link>([^<]+)/),
    };
  }).filter((e) => e.audioUrl);
}
