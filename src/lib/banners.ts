import { WP_URL } from "@/lib/env";
import { mediaOriginUrl, rewriteUrl } from "@/lib/urls";

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
  /* WP_URL, not the public site.

     This reads the *WordPress-rendered* home page for an Elementor widget. Once
     the apex serves Next.js, fetching islamonlive.in here would fetch this app's
     own home page — which has no Elementor markup, so the strip would silently
     empty out (and the app would be calling itself in a loop). The banner lives
     in the CMS, so it is read from the CMS. */
  const res = await fetch(`${WP_URL}/`, { next: { revalidate: 1800, tags: ["banners"] } });
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
    // scraped href: allow only http(s)/relative — blocks javascript: and data: URIs
    const href = decode(m[1]);
    if (!/^(https?:\/\/|\/)/i.test(href)) continue;
    out.push({
      // the click goes to the public site; the artwork is a next/image src, so
      // it points at the origin the optimizer has to fetch from
      href: rewriteUrl(href),
      img: mediaOriginUrl(img),
      width: Number(attr(m[2], "width")) || 1440,
      height: Number(attr(m[2], "height")) || 120,
      alt: attr(m[2], "alt") || "",
    });
  }
  return out;
}
