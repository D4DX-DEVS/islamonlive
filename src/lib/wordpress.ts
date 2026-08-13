const WP_URL = process.env.NEXT_PUBLIC_WORDPRESS_URL ?? "https://islamonlive.in";
const API = `${WP_URL}/wp-json/wp/v2`;

export interface WPPost {
  id: number;
  date: string;
  slug: string;
  link: string;
  title: { rendered: string };
  excerpt: { rendered: string };
  content: { rendered: string };
  categories: number[];
  _embedded?: {
    author?: { name: string; avatar_urls?: Record<string, string>; mpp_avatar?: Record<string, string> }[];
    "wp:featuredmedia"?: {
      source_url: string;
      alt_text: string;
      media_details?: { width?: number; sizes?: Record<string, { source_url: string; width: number }> };
    }[];
    "wp:term"?: { id: number; name: string; slug: string; taxonomy: string }[][];
  };
}

export interface WPCategory {
  id: number;
  name: string;
  slug: string;
  count: number;
}

// ponytail: one retry — origin 5xx/522 (Cloudflare timeout) is transient. Add backoff if it turns flakier.
async function wpFetch<T>(path: string, revalidate = 300): Promise<T> {
  for (let attempt = 0; ; attempt++) {
    const res = await fetch(`${API}${path}`, { next: { revalidate } });
    if (res.ok) return res.json();
    if (res.status < 500 || attempt > 0) throw new Error(`WP API ${res.status}: ${path}`);
  }
}

export function getPosts(opts: { page?: number; perPage?: number; categories?: number[]; search?: string; author?: number; tags?: number[] } = {}) {
  const p = new URLSearchParams({
    // lists never render post content; full posts (2-15MB per response) blow Next's
    // 2MB data-cache limit, which forced a WP round-trip on every request
    _embed: "wp:featuredmedia,author,wp:term",
    _fields: "id,date,slug,link,title,excerpt,categories,tags,_links,_embedded",
    page: String(opts.page ?? 1),
    per_page: String(opts.perPage ?? 12),
  });
  if (opts.categories?.length) p.set("categories", opts.categories.join(","));
  if (opts.search) p.set("search", opts.search);
  if (opts.author) p.set("author", String(opts.author));
  if (opts.tags?.length) p.set("tags", opts.tags.join(","));
  return wpFetch<WPPost[]>(`/posts?${p}`);
}

export interface WPPage {
  id: number;
  slug: string;
  title: { rendered: string };
  content: { rendered: string };
}

export async function getPageBySlug(slug: string): Promise<WPPage | null> {
  const pages = await wpFetch<WPPage[]>(`/pages?slug=${encodeURIComponent(slug)}`, 3600);
  return pages[0] ?? null;
}

export interface WPUser {
  id: number;
  name: string;
  slug: string;
  description: string;
  avatar_urls?: Record<string, string>;
}

export async function getUserBySlug(slug: string): Promise<WPUser | null> {
  const users = await wpFetch<WPUser[]>(`/users?slug=${encodeURIComponent(slug)}`, 3600);
  return users[0] ?? null;
}

export function searchUsers(q: string): Promise<WPUser[]> {
  return wpFetch<WPUser[]>(`/users?search=${encodeURIComponent(q)}&_fields=id,name,slug`, 3600);
}

export async function getTagBySlug(slug: string): Promise<WPCategory | null> {
  const tags = await wpFetch<WPCategory[]>(`/tags?slug=${encodeURIComponent(slug)}&_fields=id,name,slug,count`, 3600);
  return tags[0] ?? null;
}

export async function getPostBySlug(slug: string): Promise<WPPost | null> {
  const posts = await wpFetch<WPPost[]>(`/posts?slug=${encodeURIComponent(slug)}&_embed=1`, 600);
  return posts[0] ?? null;
}

export function getCategories(perPage = 50) {
  return wpFetch<WPCategory[]>(`/categories?per_page=${perPage}&orderby=count&order=desc&_fields=id,name,slug,count`, 3600);
}

export async function getCategoryBySlug(slug: string): Promise<WPCategory | null> {
  const cats = await wpFetch<WPCategory[]>(`/categories?slug=${encodeURIComponent(slug)}&_fields=id,name,slug,count`, 3600);
  return cats[0] ?? null;
}

// helpers
// WP stores pre-scaled variants; card thumbnails must not pull the multi-MB original.
const THUMB_SIZES = ["medium_large", "large", "medium"];

// aspect-preserving WP sizes, widest first (crops like epic-* would change the ratio)
const FULL_SIZES = ["2048x2048", "1536x1536", "large", "medium_large"];

export function featuredImage(post: WPPost, thumb = false): { url: string; alt: string } | null {
  const m = post._embedded?.["wp:featuredmedia"]?.[0];
  if (!m?.source_url) return null;
  const sizes = m.media_details?.sizes;
  if (thumb) {
    const variant = sizes ? THUMB_SIZES.map((s) => sizes[s]).find(Boolean) : null;
    return { url: variant?.source_url ?? m.source_url, alt: m.alt_text || "" };
  }
  // some "full" originals are broken tiny uploads while the generated sizes stay
  // large — serve the widest variant when it beats the original
  const fullW = m.media_details?.width ?? Infinity;
  const big = sizes ? FULL_SIZES.map((s) => sizes[s]).find((v) => v && v.width > fullW) : null;
  return { url: big?.source_url ?? m.source_url, alt: m.alt_text || "" };
}

export function authorName(post: WPPost): string {
  return post._embedded?.author?.[0]?.name ?? "";
}

// real author photos live in mpp_avatar (Metronet Profile Picture plugin).
// avatar_urls is Gravatar with d=mm, which always returns the grey mystery-person
// placeholder — so ignore it and let the caller draw an initial instead.
export function authorAvatar(post: WPPost): string | null {
  const a = post._embedded?.author?.[0]?.mpp_avatar;
  return a?.["96"] ?? a?.["150"] ?? a?.["48"] ?? null;
}

export function primaryCategory(post: WPPost): { name: string; slug: string } | null {
  const terms = post._embedded?.["wp:term"]?.flat().filter((t) => t.taxonomy === "category");
  const t = terms?.[0];
  return t ? { name: decodeEntities(t.name), slug: t.slug } : null;
}

// preserve original /{category}/{slug}/ URL structure
export function postPath(post: WPPost): string {
  try {
    return new URL(post.link).pathname;
  } catch {
    return `/${primaryCategory(post)?.slug ?? "news"}/${post.slug}/`;
  }
}

const ENTITIES: Record<string, string> = {
  "&nbsp;": " ", "&amp;": "&", "&hellip;": "…", "&#8217;": "’", "&#8216;": "‘",
  "&#8220;": "“", "&#8221;": "”", "&#8211;": "–", "&#8212;": "—", "&#039;": "'", "&quot;": '"',
};

export function decodeEntities(s: string): string {
  return s.replace(/&[#\w]+;/g, (m) => ENTITIES[m] ?? m).replace(/\[…\]|\[&hellip;\]/g, "…");
}

export function stripHtml(html: string): string {
  return decodeEntities(html.replace(/<[^>]*>/g, "")).trim();
}

export function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-IN", { year: "numeric", month: "long", day: "numeric" });
}
