import { TTL, wpTag } from "@/lib/cache";
import { WP_API } from "@/lib/env";
import type { YoastHead } from "@/lib/seo";
import { mediaOriginUrl, slugForApi, toSitePath } from "@/lib/urls";

const API = WP_API;

export interface WPPost {
  id: number;
  date: string;
  /** last edit — drives sitemap <lastmod> and the article's dateModified */
  modified?: string;
  slug: string;
  link: string;
  /** Edit time in UTC without an offset ("2026-03-10T11:36:44") — see modifiedIso() */
  modified_gmt?: string;
  title: { rendered: string };
  excerpt: { rendered: string };
  content: { rendered: string };
  categories: number[];
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

/* One retry, for both ways a request to WordPress fails transiently.

   An origin 5xx or a 522 (Cloudflare timed out reaching WP) arrives as a
   response and is retried on its status. A connection that never completes —
   UND_ERR_CONNECT_TIMEOUT, ECONNRESET, a DNS blip — does not arrive as a
   response at all: fetch() *throws*, so the status check below is never
   reached and the old shape propagated it on the first attempt with no retry.
   That is the same class of transient failure and now gets the same second
   chance. It matters more since the move off Vercel: the app reaches
   admin.islamonlive.in across the public internet from a single container, and
   one dropped connection was enough to turn the home page into a 500.

   Still one retry, not a loop with backoff — a reader is waiting, and the
   connect timeout has already spent 10s by the time we get here. Add backoff
   if it turns flakier.

   Every response is tagged ("wp" + the endpoint) so app/api/revalidate can drop
   it the moment WordPress publishes, instead of waiting the TTL out. */
async function wpRequest(path: string, revalidate: number): Promise<Response> {
  const tags = ["wp", wpTag(path)];
  for (let attempt = 0; ; attempt++) {
    let res: Response;
    try {
      res = await fetch(`${API}${path}`, { next: { revalidate, tags } });
    } catch (error: unknown) {
      // rethrown as-is on the second failure: wpFetchPage reads the message to
      // tell an over-the-end page number from a real outage
      if (attempt > 0) throw error;
      continue;
    }
    if (res.ok) return res;
    if (res.status < 500 || attempt > 0) throw new Error(`WP API ${res.status}: ${path}`);
  }
}

async function wpFetch<T>(path: string, revalidate: number = TTL.posts): Promise<T> {
  return (await wpRequest(path, revalidate)).json();
}

/* The list endpoints report their totals in headers, not the body. Anything that
   has to page through the whole archive — the sitemaps, "page N of M" — needs
   them, so this variant hands them back alongside the rows. */
async function wpFetchPage<T>(path: string, revalidate: number = TTL.posts): Promise<WPPage_<T>> {
  let res: Response;
  try {
    res = await wpRequest(path, revalidate);
  } catch (error: unknown) {
    /* WP answers a page number past the end of an archive with 400
       rest_post_invalid_page_number. For a list request that is "this page is
       empty", not a failure — the listing routes turn an empty page > 1 into a
       404, which is what /category/news/page/9999/ should be, rather than the
       500 the raw error would produce. Anything else still throws. */
    if (error instanceof Error && error.message.startsWith("WP API 400")) {
      return { items: [], total: 0, totalPages: 0 };
    }
    throw error;
  }
  return {
    items: (await res.json()) as T[],
    total: Number(res.headers.get("X-WP-Total") ?? 0),
    totalPages: Number(res.headers.get("X-WP-TotalPages") ?? 0),
  };
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

function postQuery(opts: PostQuery): URLSearchParams {
  const p = new URLSearchParams({
    // lists never render post content; full posts (2-15MB per response) blow Next's
    // 2MB data-cache limit, which forced a WP round-trip on every request
    _embed: "wp:featuredmedia,author,wp:term",
    _fields: "id,date,modified,modified_gmt,slug,link,title,excerpt,categories,tags,_links,_embedded",
    page: String(opts.page ?? 1),
    per_page: String(opts.perPage ?? 12),
  });
  if (opts.categories?.length) {
    if (opts.includeChildren) {
      /* `categories=` matches assigned terms only. The object form (WP 5.7+)
         takes the whole subtree, which is what WordPress's own category archive
         lists — shariah alone is 570 posts, with its descendants 1,931 — and
         the X-WP-Total it returns is the count of that same list. */
      for (const id of opts.categories) p.append("categories[terms][]", String(id));
      p.set("categories[include_children]", "true");
    } else {
      p.set("categories", opts.categories.join(","));
    }
  }
  if (opts.search) {
    p.set("search", opts.search);
    // REST orders newest-first even for a search; relevance puts title matches
    // ahead of body matches and only then falls back to date
    p.set("orderby", "relevance");
  }
  if (opts.author) p.set("author", String(opts.author));
  if (opts.tags?.length) p.set("tags", opts.tags.join(","));
  return p;
}

function dropLinks<T extends object>(o: T): T {
  const copy = { ...o } as T & { _links?: unknown };
  delete copy._links;
  return copy;
}

/* WordPress's HATEOAS `_links` blocks — on the post and again on every embedded
   author, image and term — have to be asked for (REST refuses to embed without
   them) but nothing here reads them, and a list's posts travel twice, in the
   HTML and in the RSC payload: ~1.5 KB a post, 24 posts a page, gone. */
function slim(post: WPPost): WPPost {
  const out = dropLinks(post);
  const e = out._embedded;
  if (e) {
    out._embedded = {
      ...e,
      ...(e.author ? { author: e.author.map(dropLinks) } : {}),
      ...(e["wp:featuredmedia"] ? { "wp:featuredmedia": e["wp:featuredmedia"].map(dropLinks) } : {}),
      ...(e["wp:term"] ? { "wp:term": e["wp:term"].map((terms) => terms.map(dropLinks)) } : {}),
    };
  }
  return out;
}

export async function getPosts(opts: PostQuery = {}): Promise<WPPost[]> {
  return (await wpFetch<WPPost[]>(`/posts?${postQuery(opts)}`)).map(slim);
}

/** Same query as getPosts, plus the X-WP-Total / X-WP-TotalPages counts. */
export async function getPostsPage(opts: PostQuery = {}): Promise<WPPage_<WPPost>> {
  const page = await wpFetchPage<WPPost>(`/posts?${postQuery(opts)}`);
  return { ...page, items: page.items.map(slim) };
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

export async function getPageBySlug(slug: string): Promise<WPPage | null> {
  // no _embed: nothing reads a page's embedded author/media, and the embed
  // adds ~50% to the payload the data cache has to hold
  const pages = await wpFetch<WPPage[]>(`/pages?slug=${slugForApi(slug)}`, TTL.page);
  return pages[0] ?? null;
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

export async function getUserBySlug(slug: string): Promise<WPUser | null> {
  const users = await wpFetch<WPUser[]>(`/users?slug=${slugForApi(slug)}`, TTL.taxonomy);
  return users[0] ?? null;
}

/* The /authors-list/ directory. WP's public users endpoint only lists people
   with published posts, A→Z — the same population Yoast put in its author
   sitemaps. Paged through the X-WP-Total headers like the post archives. */
export function getUsersPage(page = 1, perPage = 60): Promise<WPPage_<WPUser>> {
  return wpFetchPage<WPUser>(
    `/users?per_page=${perPage}&page=${page}&orderby=name&order=asc&_fields=id,name,slug,description,mpp_avatar`,
    TTL.taxonomy
  );
}

export function searchUsers(q: string): Promise<WPUser[]> {
  return wpFetch<WPUser[]>(`/users?search=${encodeURIComponent(q)}&_fields=id,name,slug`, TTL.taxonomy);
}

export async function getTagBySlug(slug: string): Promise<WPCategory | null> {
  const tags = await wpFetch<WPCategory[]>(
    `/tags?slug=${slugForApi(slug)}&_fields=id,name,slug,count,description,link,yoast_head_json`,
    TTL.taxonomy
  );
  return tags[0] ?? null;
}

export async function getPostBySlug(slug: string): Promise<WPPost | null> {
  const posts = await wpFetch<WPPost[]>(`/posts?slug=${slugForApi(slug)}&_embed=1`, TTL.posts);
  return posts[0] ?? null;
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

export async function resolvePostByPath(requestPath: string, slug: string): Promise<ResolvedPost | null> {
  const post = await getPostBySlug(slug);
  if (!post) return null;
  const canonical = postPath(post);
  return { post, canonical, exact: decodePath(canonical) === decodePath(requestPath) };
}

/* Compare paths by their decoded form. The permalink keeps WP's original
   lowercase percent-encoding (%e0%b4...) while the request may arrive
   re-encoded in uppercase by a browser, a mail client or a scraper — the same
   URL, byte-different. Comparing raw strings would 301 those into a loop. */
function decodePath(path: string): string {
  try {
    return decodeURIComponent(path).replace(/\/+$/, "").toLowerCase();
  } catch {
    return path.replace(/\/+$/, "").toLowerCase();
  }
}

export function getCategories(perPage = 50) {
  return wpFetch<WPCategory[]>(
    `/categories?per_page=${perPage}&orderby=count&order=desc&_fields=id,name,slug,count,parent,link`,
    TTL.taxonomy
  );
}

/** Every category, paged out — the sitemap and the redirect map need all 81. */
export async function getAllCategories(): Promise<WPCategory[]> {
  const out: WPCategory[] = [];
  for (let page = 1; page <= 10; page++) {
    const { items, totalPages } = await wpFetchPage<WPCategory>(
      `/categories?per_page=100&page=${page}&_fields=id,name,slug,count,parent,link`,
      TTL.taxonomy
    );
    out.push(...items);
    if (page >= totalPages) break;
  }
  return out;
}

export async function getCategoryBySlug(slug: string): Promise<WPCategory | null> {
  const cats = await wpFetch<WPCategory[]>(
    `/categories?slug=${slugForApi(slug)}&_fields=id,name,slug,count,description,parent,link,yoast_head_json`,
    TTL.taxonomy
  );
  return cats[0] ?? null;
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

export function decodeEntities(s: string): string {
  return s.replace(/&[#\w]+;/g, (m) => ENTITIES[m] ?? m).replace(/\[…\]|\[&hellip;\]/g, "…");
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
