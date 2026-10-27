import type { Filter, Sort } from "mongodb";
import { TTL } from "@/lib/cache";
import { toWPPost, type ListPostDoc, type PostRefs } from "@/lib/db/adapt";
import { cached } from "@/lib/db/cache";
import { collection } from "@/lib/db/client";
import { searchPostsPage } from "@/lib/db/search";
import type { CategoryDoc, MediaDoc, PostDoc, TagDoc, UserDoc } from "@/lib/db/types";
import { safeDecode } from "@/lib/urls";
import type { PostQuery, WPPage_, WPPost } from "@/lib/wp-model";

/* Posts from MongoDB, answering the same questions wordpress.ts asks the REST
   API, with the same answers: what an anonymous reader may see, in the same
   order, paged the same way. */

const POST_TAGS = ["wp", "wp:posts"];
/** WP's own ceiling for per_page; it 400s above it. */
const MAX_PER_PAGE = 100;
const LIST_PROJECTION = { content: 0, content_raw: 0, seo: 0, password: 0, content_sha256: 0 } as const;
const EMPTY: WPPage_<WPPost> = { items: [], total: 0, totalPages: 0 };

/** What an anonymous reader may see: published posts, plus scheduled ones whose time has come. */
export function publicFilter(now: Date = new Date()): Filter<PostDoc> {
  return { status: { $in: ["publish", "future"] }, published_at: { $lte: now } };
}

/* WordPress lists ORDER BY post_date DESC, and 594 published posts share their
   exact timestamp with another. MySQL walks the date index backwards, which
   puts the higher ID first on a tie; matching that keeps every post on the same
   page number as before, which is what the paginated archive URLs index. */
export const NEWEST_FIRST: Sort = { published_at: -1, _id: -1 };

const uniq = (values: (number | null | undefined)[]): number[] => [...new Set(values.filter((v): v is number => typeof v === "number" && v > 0))];

async function byIds<T extends { _id: number }>(name: "users" | "media" | "categories" | "tags", ids: number[], projection: Record<string, 1>): Promise<Map<number, T>> {
  if (!ids.length) return new Map();
  const docs = (await (await collection(name)).find({ _id: { $in: ids } }, { projection }).toArray()) as unknown as T[];
  return new Map(docs.map((d) => [d._id, d]));
}

/** The authors, images and terms a set of posts embeds — four batched reads, not four per post. */
export async function loadRefs(posts: ListPostDoc[]): Promise<PostRefs> {
  const [users, media, categories, tags] = await Promise.all([
    byIds<UserDoc>("users", uniq(posts.map((p) => p.author_id)), { name: 1, slug: 1, description: 1, avatars: 1 }),
    byIds<MediaDoc>("media", uniq(posts.map((p) => p.featured_media_id)), { source_url: 1, alt_text: 1, caption: 1, width: 1, height: 1, sizes: 1 }),
    byIds<CategoryDoc>("categories", uniq(posts.flatMap((p) => p.categories)), { name: 1, slug: 1, link: 1 }),
    byIds<TagDoc>("tags", uniq(posts.flatMap((p) => p.tags)), { name: 1, slug: 1, link: 1 }),
  ]);
  return { users, media, categories, tags };
}

/* The category tree, for `includeChildren` — WordPress's own category archive
   lists the whole subtree (shariah alone is 570 posts, with descendants 1,931). */
const categoryParents = cached(
  "categories:parents",
  async (): Promise<[number, number][]> => {
    const docs = await (await collection("categories")).find({}, { projection: { parent_id: 1 } }).toArray();
    return docs.map((d) => [d._id, d.parent_id ?? 0]);
  },
  { revalidate: TTL.taxonomy, tags: ["wp", "wp:categories"] }
);

export async function categorySubtree(ids: number[]): Promise<number[]> {
  const children = new Map<number, number[]>();
  for (const [id, parent] of await categoryParents()) children.set(parent, [...(children.get(parent) ?? []), id]);
  const out = new Set<number>();
  const stack = [...ids];
  while (stack.length) {
    const id = stack.pop()!;
    if (out.has(id)) continue;
    out.add(id);
    stack.push(...(children.get(id) ?? []));
  }
  return [...out];
}

export async function postFilter(opts: PostQuery): Promise<Filter<PostDoc>> {
  const filter: Filter<PostDoc> = publicFilter();
  if (opts.categories?.length) {
    const ids = opts.includeChildren ? await categorySubtree(opts.categories) : opts.categories;
    filter.categories = { $in: ids };
  }
  if (opts.tags?.length) filter.tags = { $in: opts.tags };
  if (opts.author) filter.author_id = opts.author;
  return filter;
}

export function paging(opts: PostQuery): { page: number; perPage: number } {
  const page = Math.max(1, Math.trunc(opts.page ?? 1) || 1);
  const perPage = Math.min(MAX_PER_PAGE, Math.max(1, Math.trunc(opts.perPage ?? 12) || 12));
  return { page, perPage };
}

async function listPage(opts: PostQuery): Promise<WPPage_<WPPost>> {
  if (opts.search) return searchPostsPage(opts);
  const { page, perPage } = paging(opts);
  const filter = await postFilter(opts);
  const posts = await collection("posts");
  const [docs, total] = await Promise.all([
    posts.find(filter, { projection: LIST_PROJECTION }).sort(NEWEST_FIRST).skip((page - 1) * perPage).limit(perPage).toArray(),
    posts.countDocuments(filter),
  ]);
  const totalPages = Math.ceil(total / perPage);
  // WP answers a page past the end with 400, which wordpress.ts turns into an empty page
  if (page > 1 && page > totalPages) return EMPTY;
  const refs = await loadRefs(docs as ListPostDoc[]);
  return { items: docs.map((d) => toWPPost(d as ListPostDoc, refs)), total, totalPages };
}

const cachedListPage = cached("posts:page", listPage, { revalidate: TTL.posts, tags: POST_TAGS });

export async function getPosts(opts: PostQuery = {}): Promise<WPPost[]> {
  return (await cachedListPage(opts)).items;
}

export function getPostsPage(opts: PostQuery = {}): Promise<WPPage_<WPPost>> {
  return cachedListPage(opts);
}

/* The slug as stored is WordPress's: Malayalam percent-encoded in lowercase hex.
   The route hands over a decoded segment (or, from an old link, an encoded one
   in either case), so both forms are tried. */
export function slugCandidates(slug: string): string[] {
  const decoded = safeDecode(slug);
  return [...new Set([encodeURIComponent(decoded).toLowerCase(), decoded, slug])];
}

async function postBySlug(slug: string): Promise<WPPost | null> {
  const doc = await (await collection("posts")).findOne(
    { ...publicFilter(), slug: { $in: slugCandidates(slug) } },
    { projection: { content_raw: 0, password: 0, content_sha256: 0 }, sort: NEWEST_FIRST }
  );
  if (!doc) return null;
  return toWPPost(doc, await loadRefs([doc]), true);
}

export const getPostBySlug = cached("posts:slug", postBySlug, { revalidate: TTL.posts, tags: POST_TAGS });
