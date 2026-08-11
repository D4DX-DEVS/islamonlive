// Anchor.fm (Spotify for Podcasters) RSS feed of the site's podcast.
const RSS_URL = "https://anchor.fm/s/de450e50/podcast/rss";

export interface Episode {
  title: string;
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
    return {
      title: pick(/<title>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/title>/).trim(),
      audioUrl: pick(/<enclosure url="([^"]+)"/),
      date: pick(/<pubDate>([^<]*)/),
      duration: pick(/<itunes:duration>([^<]*)/),
      image: pick(/<itunes:image href="([^"]+)"/),
      link: pick(/<link>([^<]+)/),
    };
  }).filter((e) => e.audioUrl);
}
