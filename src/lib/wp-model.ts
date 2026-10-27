import type { YoastHead } from "@/lib/seo";
import { mediaOriginUrl, toSitePath } from "@/lib/urls";

/* The WordPress REST shapes the site renders, and the pure helpers that read
   them. Kept apart from the data fetching in wordpress.ts so client components
   (PostCard, InfiniteFeed) can import them without pulling a data source,
   and its database driver, into the browser bundle. wordpress.ts re-exports
   all of it, so server code keeps importing from there. */

export interface WPPost {
  id: number;
  date: string;
  /** last edit — drives sitemap <lastmod> and the article's dateModified */
  modified?: string;
  slug: string;
  link: string;
  /** Edit time in UTC without an offset ("2026-03-10T11:36:44") — see modifiedIso() */
  modified_gmt?: string;
  status?: string;
  author?: number;
  title: { rendered: string };
  excerpt: { rendered: string };
  content: { rendered: string };
  categories: number[];
  tags?: number[];
  /** Yoast's precomputed head: titles, canonical, robots, OG and the JSON-LD graph */
  yoast_head_json?: YoastHead;
  _embedded?: {
    author?: { id?: number; slug?: string; name: string; description?: string; avatar_urls?: Record<string, string>; mpp_avatar?: Record<string, string> }[];
    "wp:featuredmedia"?: {
      source_url: string;
      alt_text: string;
      caption?: { rendered: string };
      media_details?: { width?: number; height?: number; sizes?: Record<string, { source_url: string; width: number; height?: number }> };
    }[];
    "wp:term"?: { id: number; name: string; slug: string; taxonomy: string; link?: string }[][];
  };
}

export interface WPCategory {
  id: number;
  name: string;
  slug: string;
  count: number;
  /** The archive's own blurb, when an editor wrote one — HTML */
  description?: string;
  parent?: number;
  link?: string;
  yoast_head_json?: YoastHead;
}

/** What the WP REST pagination headers tell us about a list request. */
export interface WPPage_<T> {
  items: T[];
  total: number;
  totalPages: number;
}

export interface PostQuery {
  page?: number;
  perPage?: number;
  categories?: number[];
  /** Posts filed under descendants of `categories` too — what an archive page shows. */
  includeChildren?: boolean;
  search?: string;
  author?: number;
  tags?: number[];
}

export interface WPPage {
  id: number;
  slug: string;
  link?: string;
  modified?: string;
  title: { rendered: string };
  content: { rendered: string };
  yoast_head_json?: YoastHead;
}

export interface WPUser {
  id: number;
  name: string;
  slug: string;
  description: string;
  link?: string;
  avatar_urls?: Record<string, string>;
  /** Metronet Profile Picture sizes, or an {errors} object when the user has none */
  mpp_avatar?: Record<string, unknown>;
  yoast_head_json?: YoastHead;
}

/* WP matches a post on its slug alone, so /literally-anything/that-slug/ would
   render the article at a 200 — an unlimited supply of duplicate URLs for Google
   to index instead of the real one. The route asks for the whole path and
   compares it against the post's own permalink; a mismatch is the caller's cue
   to 301 to `canonical` rather than serve the page twice. */
export interface ResolvedPost {
  post: WPPost;
  /** The post's real path on this site, trailing slash and all. */
  canonical: string;
  /** True when the requested path already is the canonical one. */
  exact: boolean;
}

// helpers
// WP stores pre-scaled variants; card thumbnails must not pull the multi-MB original.
const THUMB_SIZES = ["medium_large", "large", "medium"];

// aspect-preserving WP sizes, widest first (crops like epic-* would change the ratio)
const FULL_SIZES = ["2048x2048", "1536x1536", "large", "medium_large"];

export interface FeaturedImage {
  url: string;
  alt: string;
  width?: number;
  height?: number;
  caption?: string;
}

export function featuredImage(post: WPPost, thumb = false): FeaturedImage | null {
  const m = post._embedded?.["wp:featuredmedia"]?.[0];
  if (!m?.source_url) return null;
  const sizes = m.media_details?.sizes;
  const caption = m.caption?.rendered ? stripHtml(m.caption.rendered) : undefined;
  if (thumb) {
    const variant = sizes ? THUMB_SIZES.map((s) => sizes[s]).find(Boolean) : null;
    // mediaOriginUrl, not the public URL: these become next/image srcs, and the
    // optimizer has to fetch the file from the origin that stores it
    return { url: mediaOriginUrl(variant?.source_url ?? m.source_url), alt: m.alt_text || "", caption };
  }
  // some "full" originals are broken tiny uploads while the generated sizes stay
  // large — serve the widest variant when it beats the original
  const fullW = m.media_details?.width ?? Infinity;
  const big = sizes ? FULL_SIZES.map((s) => sizes[s]).find((v) => v && v.width > fullW) : null;
  const chosen = big ?? { source_url: m.source_url, width: m.media_details?.width, height: m.media_details?.height };
  return {
    url: mediaOriginUrl(chosen.source_url),
    alt: m.alt_text || "",
    width: chosen.width,
    height: "height" in chosen ? chosen.height : undefined,
    caption,
  };
}

export function authorName(post: WPPost): string {
  return post._embedded?.author?.[0]?.name ?? "";
}

// real author photos live in mpp_avatar (Metronet Profile Picture plugin).
// avatar_urls is Gravatar with d=mm, which always returns the grey mystery-person
// placeholder — so ignore it and let the caller draw its own fallback icon.
export function authorAvatar(post: WPPost): string | null {
  const a = post._embedded?.author?.[0]?.mpp_avatar;
  const url = a?.["96"] ?? a?.["150"] ?? a?.["48"] ?? null;
  return url ? mediaOriginUrl(url) : null;
}

export function author(post: WPPost): { id?: number; name: string; slug?: string; avatar: string | null; bio: string } | null {
  const a = post._embedded?.author?.[0];
  return a?.name ? { id: a.id, name: a.name, slug: a.slug, avatar: authorAvatar(post), bio: a.description ? stripHtml(a.description).trim() : "" } : null;
}

/** The post's edit time as schema.org wants it — WP's *_gmt fields carry no offset. */
export function modifiedIso(post: WPPost): string | undefined {
  const gmt = post.modified_gmt;
  if (gmt) return /[zZ]$|[+-]\d\d:?\d\d$/.test(gmt) ? gmt : `${gmt}+00:00`;
  return post.modified;
}

export function primaryCategory(post: WPPost): { name: string; slug: string } | null {
  const terms = post._embedded?.["wp:term"]?.flat().filter((t) => t.taxonomy === "category");
  const t = terms?.[0];
  return t ? { name: decodeEntities(t.name), slug: t.slug } : null;
}

/** Every category term embedded on the post, in WP's order. */
export function postCategories(post: WPPost): { name: string; slug: string }[] {
  return (post._embedded?.["wp:term"]?.flat() ?? [])
    .filter((t) => t.taxonomy === "category")
    .map((t) => ({ name: decodeEntities(t.name), slug: t.slug }));
}

// preserve the original /{category}/{slug}/ URL structure, percent-encoding and all
export function postPath(post: WPPost): string {
  try {
    return toSitePath(post.link);
  } catch {
    return `/${primaryCategory(post)?.slug ?? "news"}/${post.slug}/`;
  }
}

const ENTITIES: Record<string, string> = {
  "&nbsp;": " ", "&amp;": "&", "&hellip;": "…", "&#8217;": "’", "&#8216;": "‘",
  "&#8220;": "“", "&#8221;": "”", "&#8211;": "–", "&#8212;": "—", "&#039;": "'", "&quot;": '"',
};

/* For text only: every caller renders the result as text (React escapes it),
   never as HTML. Numeric entities beyond the table — wptexturize's &#8230;,
   &#038; and friends — decode too, so they stop showing up literally. */
export function decodeEntities(s: string): string {
  return s
    .replace(/&[#\w]+;/g, (m) => ENTITIES[m] ?? numericEntity(m) ?? m)
    .replace(/\[…\]|\[&hellip;\]/g, "…");
}

function numericEntity(m: string): string | null {
  const hex = /^&#x([\da-f]+);$/i.exec(m);
  const dec = /^&#(\d+);$/.exec(m);
  const code = hex ? parseInt(hex[1], 16) : dec ? Number(dec[1]) : NaN;
  return code > 0 && code <= 0x10ffff ? String.fromCodePoint(code) : null;
}

export function stripHtml(html: string): string {
  return decodeEntities(html.replace(/<[^>]*>/g, "")).trim();
}

/** numeric dd/mm/yyyy everywhere — "01/09/2026", never "1 September 2026" */
export function formatDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  return `${dd}/${mm}/${d.getFullYear()}`;
}

/** slug for /author/{slug}; null when the post carries no embedded author */
export function authorSlug(post: WPPost): string | null {
  return post._embedded?.author?.[0]?.slug ?? null;
}

/** the user's own uploaded photo (Metronet plugin) — Gravatar is always the grey placeholder here */
export function userAvatar(user: WPUser): string | null {
  const a = user.mpp_avatar;
  if (!a || typeof a !== "object" || "errors" in a) return null;
  const m = a as Record<string, string>;
  const url = m["full"] ?? m["300"] ?? m["150"] ?? m["96"] ?? null;
  return url ? mediaOriginUrl(url) : null;
}
