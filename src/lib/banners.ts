import { WP_URL, DATA_SOURCE } from "@/lib/env";
import { mediaOriginUrl, rewriteUrl } from "@/lib/urls";
import { collection } from "@/lib/db/client";
import { cached } from "@/lib/db/cache";
import { TTL } from "@/lib/cache";

// The promo strip between the video playlist and the reels feed is an Elementor
// image widget on the WordPress homepage. Editors swap it there, so read it from
// the rendered page (WordPress mode) or from the database (MongoDB mode).
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

async function getHomeBannersFromWordPress(): Promise<Banner[]> {
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

async function getHomeBannersFromMongo(): Promise<Banner[]> {
  /* Read banners from the MongoDB "banners" collection. The documents are
     stored with rewritten (public-site) URLs, so they can be used directly
     for HTML content and next/image srcs. */
  const coll = await collection("banners");
  const docs = await coll.find({}).sort({ _id: 1 }).toArray();
  // the same http(s)/relative rule as the scraped path: no javascript: or data: links on the home page
  return docs.filter((doc) => /^(https?:\/\/|\/)/i.test(doc.href)).map((doc) => ({
    href: doc.href,
    img: mediaOriginUrl(doc.img), // Ensure next/image uses the right origin
    width: doc.width,
    height: doc.height,
    alt: doc.alt,
  }));
}

/* Cached MongoDB read for banners, same TTL as WordPress fetches. */
const getCachedMongobanners = cached(
  "home-banners",
  getHomeBannersFromMongo,
  { revalidate: TTL.media, tags: ["banners"] }
);

export async function getHomeBanners(): Promise<Banner[]> {
  if (DATA_SOURCE === "mongo") {
    return getCachedMongobanners();
  }
  return getHomeBannersFromWordPress();
}
