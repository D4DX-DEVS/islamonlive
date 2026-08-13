// The promo strip between the video playlist and the reels feed is an Elementor
// image widget on the WordPress homepage. Editors swap it there, so read it from
// the rendered page rather than hard-coding the artwork.
export interface Banner {
  href: string;
  img: string;
  width: number;
  height: number;
  alt: string;
}

function decode(s: string): string {
  return s.replace(/&#0?38;|&amp;/g, "&").replace(/&quot;/g, '"').replace(/&#0?39;/g, "'");
}

function attr(tag: string, name: string): string | null {
  const m = tag.match(new RegExp(`${name}="([^"]*)"`));
  return m ? decode(m[1]) : null;
}

export async function getHomeBanners(): Promise<Banner[]> {
  const res = await fetch("https://islamonlive.in/", { next: { revalidate: 1800 } });
  if (!res.ok) return [];
  const html = await res.text();
  // the slot sits between the video playlist and the Instagram feed.
  // lastIndexOf, not indexOf — "jet-blog-playlist" also appears in earlier
  // markup, and a wider region sweeps up the logo and infographic tiles.
  const end = html.indexOf('class="sbi_item');
  const start = end < 0 ? -1 : html.lastIndexOf("jet-blog-playlist", end);
  if (start < 0 || end < 0 || end <= start) return [];

  const out: Banner[] = [];
  for (const m of html.slice(start, end).matchAll(/<a[^>]*href="([^"]+)"[^>]*>\s*<img([^>]*)>/g)) {
    const img = attr(m[2], "src");
    if (!img || !img.includes("/wp-content/uploads/")) continue;
    out.push({
      href: decode(m[1]),
      img,
      width: Number(attr(m[2], "width")) || 1440,
      height: Number(attr(m[2], "height")) || 120,
      alt: attr(m[2], "alt") || "",
    });
  }
  return out;
}
