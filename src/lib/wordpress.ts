import { TTL, wpTag } from "@/lib/cache";
import * as mongo from "@/lib/db/content";
import { DATA_SOURCE, WP_API } from "@/lib/env";
import { slugForApi } from "@/lib/urls";
import { postPath, type PostQuery, type ResolvedPost, type WPCategory, type WPPage, type WPPage_, type WPPost, type WPUser } from "@/lib/wp-model";

export * from "@/lib/wp-model";

/* Every read below asks WordPress, unless DATA_SOURCE=mongo, in which case the
   same question goes to lib/db (docs/backend-migration-plan.md). Same inputs,
   same REST-shaped answers, so nothing that calls these changes. */

const API = WP_API;

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
  if (DATA_SOURCE === "mongo") return mongo.getPosts(opts);
  return (await wpFetch<WPPost[]>(`/posts?${postQuery(opts)}`)).map(slim);
}

/** Same query as getPosts, plus the X-WP-Total / X-WP-TotalPages counts. */
export async function getPostsPage(opts: PostQuery = {}): Promise<WPPage_<WPPost>> {
  if (DATA_SOURCE === "mongo") return mongo.getPostsPage(opts);
  const page = await wpFetchPage<WPPost>(`/posts?${postQuery(opts)}`);
  return { ...page, items: page.items.map(slim) };
}


export async function getPageBySlug(slug: string): Promise<WPPage | null> {
  if (DATA_SOURCE === "mongo") return mongo.getPageBySlug(slug);
  // no _embed: nothing reads a page's embedded author/media, and the embed
  // adds ~50% to the payload the data cache has to hold
  const pages = await wpFetch<WPPage[]>(`/pages?slug=${slugForApi(slug)}`, TTL.page);
  return pages[0] ?? null;
}


export async function getUserBySlug(slug: string): Promise<WPUser | null> {
  if (DATA_SOURCE === "mongo") return mongo.getUserBySlug(slug);
  const users = await wpFetch<WPUser[]>(`/users?slug=${slugForApi(slug)}`, TTL.taxonomy);
  return users[0] ?? null;
}

/* The /authors-list/ directory. WP's public users endpoint only lists people
   with published posts, A→Z — the same population Yoast put in its author
   sitemaps. Paged through the X-WP-Total headers like the post archives. */
export function getUsersPage(page = 1, perPage = 60): Promise<WPPage_<WPUser>> {
  if (DATA_SOURCE === "mongo") return mongo.getUsersPage(page, perPage);
  return wpFetchPage<WPUser>(
    `/users?per_page=${perPage}&page=${page}&orderby=name&order=asc&_fields=id,name,slug,description,mpp_avatar`,
    TTL.taxonomy
  );
}

export function searchUsers(q: string): Promise<WPUser[]> {
  if (DATA_SOURCE === "mongo") return mongo.searchUsers(q);
  return wpFetch<WPUser[]>(`/users?search=${encodeURIComponent(q)}&_fields=id,name,slug`, TTL.taxonomy);
}

export async function getTagBySlug(slug: string): Promise<WPCategory | null> {
  if (DATA_SOURCE === "mongo") return mongo.getTagBySlug(slug);
  const tags = await wpFetch<WPCategory[]>(
    `/tags?slug=${slugForApi(slug)}&_fields=id,name,slug,count,description,link,yoast_head_json`,
    TTL.taxonomy
  );
  return tags[0] ?? null;
}

export async function getPostBySlug(slug: string): Promise<WPPost | null> {
  if (DATA_SOURCE === "mongo") return mongo.getPostBySlug(slug);
  // Articles need the body, SEO head, author, image and terms. WordPress uses
  // the requested HATEOAS links to populate `_embedded`, so they stay in this
  // response; the explicit field set still avoids unrelated REST fields and
  // makes the cached article payload smaller than a full `_embed=1` response.
  const fields = "id,date,modified,modified_gmt,slug,link,title,excerpt,content,categories,tags,yoast_head_json,_links,_embedded";
  const posts = await wpFetch<WPPost[]>(`/posts?slug=${slugForApi(slug)}&_embed=author,wp:featuredmedia,wp:term&_fields=${fields}`, TTL.posts);
  return posts[0] ?? null;
}


export async function resolvePostByPath(requestPath: string, slug: string): Promise<ResolvedPost | null> {
  // a renamed post answers at its old URL with exact=false, which the article route turns into a 301
  const post = (await getPostBySlug(slug)) ?? (DATA_SOURCE === "mongo" ? await mongo.getPostByOldPath(requestPath) : null);
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

export function getCategories(perPage = 50): Promise<WPCategory[]> {
  if (DATA_SOURCE === "mongo") return mongo.getCategories(perPage);
  return wpFetch<WPCategory[]>(
    `/categories?per_page=${perPage}&orderby=count&order=desc&_fields=id,name,slug,count,parent,link`,
    TTL.taxonomy
  );
}

/** Every category, paged out — the sitemap and the redirect map need all 81. */
export async function getAllCategories(): Promise<WPCategory[]> {
  if (DATA_SOURCE === "mongo") return mongo.getAllCategories();
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
  if (DATA_SOURCE === "mongo") return mongo.getCategoryBySlug(slug);
  const cats = await wpFetch<WPCategory[]>(
    `/categories?slug=${slugForApi(slug)}&_fields=id,name,slug,count,description,parent,link,yoast_head_json`,
    TTL.taxonomy
  );
  return cats[0] ?? null;
}

