import type { Collection, Filter, Sort } from "mongodb";
import { cached } from "@/lib/db/cache";
import { safeTitle } from "@/lib/sanitize";
import { collection } from "@/lib/db/client";
import { publicFilter } from "@/lib/db/posts";
import { allTermCounts } from "@/lib/db/taxonomy";
import type { PostDoc } from "@/lib/db/types";
import { authorsWithPublishedPosts } from "@/lib/db/users";

/* The handful of anonymous WP REST list queries lib/sitemap.ts makes, answered
   from MongoDB in the REST shape.

   sitemap.ts keeps one code path for both data sources — the filtering, the
   ordering, the noindex rule, the lastmod formatting — and only swaps where
   the rows come from. That is what makes the MongoDB sitemaps identical to the
   WordPress ones by construction rather than by a second implementation.

   Supported: posts, pages, categories, tags, users with per_page/page,
   orderby (id | modified | date | name), order, after (posts), hide_empty
   (terms). Rows carry exactly the fields sitemap.ts reads. */

export interface RestRow {
  link?: string;
  slug?: string;
  modified?: string;
  modified_gmt?: string;
  date?: string;
  date_gmt?: string;
  title?: { rendered: string };
  count?: number;
  yoast_head_json?: { robots?: { index?: string } };
}

export interface RestList {
  items: RestRow[];
  total: number;
}

type Path = "posts" | "pages" | "categories" | "tags" | "users";
const PATHS: readonly string[] = ["posts", "pages", "categories", "tags", "users"];

const DEFAULT_ORDER: Record<Path, string> = { posts: "date", pages: "date", categories: "name", tags: "name", users: "name" };
const FIELD: Record<string, string> = { id: "_id", modified: "modified", date: "published_at", name: "name" };

function sortFor(path: Path, params: URLSearchParams): Sort {
  const orderby = params.get("orderby") ?? DEFAULT_ORDER[path];
  const dir = (params.get("order") ?? (orderby === "name" ? "asc" : "desc")) === "asc" ? 1 : -1;
  const field = FIELD[orderby] ?? FIELD[DEFAULT_ORDER[path]];
  // a tie on date or name is broken by id in the same direction, as MySQL's index walk does
  return field === "_id" ? { _id: dir } : { [field]: dir, _id: dir };
}

function robots(seo: unknown): RestRow["yoast_head_json"] {
  const index = (seo as { robots?: { index?: string } } | null)?.robots?.index;
  return index ? { robots: { index } } : undefined;
}

async function listImpl(path: Path, query: string): Promise<RestList> {
  const params = new URLSearchParams(query);
  const perPage = Math.min(100, Math.max(1, Number(params.get("per_page") ?? 10) || 10));
  const page = Math.max(1, Number(params.get("page") ?? 1) || 1);
  const skip = (page - 1) * perPage;
  const sort = sortFor(path, params);

  if (path === "posts" || path === "pages") {
    const filter: Filter<PostDoc> = path === "posts" ? publicFilter() : { status: "publish" };
    /* WP's `after` is compared with post_date — the site-local column — after
       PHP formats the given instant in UTC. So "48 hours ago" reaches 5.5 h
       further back on an IST site. Same comparison here, so the news sitemap
       lists the same posts. */
    const after = params.get("after");
    if (after && path === "posts" && !Number.isNaN(Date.parse(after))) filter.date = { $gt: new Date(after).toISOString().slice(0, 19) };
    // pages share every field read here with posts
    const col = (await collection(path)) as unknown as Collection<PostDoc>;
    const [docs, total] = await Promise.all([
      col.find(filter, { projection: { link: 1, slug: 1, modified: 1, modified_gmt: 1, date: 1, date_gmt: 1, title: 1, seo: 1 } }).sort(sort).skip(skip).limit(perPage).toArray(),
      col.countDocuments(filter),
    ]);
    const items = docs.map((d) => ({
      link: d.link,
      slug: d.slug,
      modified: d.modified,
      modified_gmt: d.modified_gmt,
      date: d.date,
      date_gmt: d.date_gmt,
      title: { rendered: safeTitle(d.title) },
      yoast_head_json: robots(d.seo),
    }));
    return { items, total };
  }

  if (path === "users") {
    const ids = await authorsWithPublishedPosts();
    const col = await collection("users");
    const filter = { _id: { $in: ids } };
    const [docs, total] = await Promise.all([
      col.find(filter, { projection: { link: 1, slug: 1, seo: 1, name: 1 } }).collation({ locale: "en" }).sort(sort).skip(skip).limit(perPage).toArray(),
      col.countDocuments(filter),
    ]);
    return { items: docs.map((d) => ({ link: d.link, slug: d.slug, yoast_head_json: robots(d.seo) })), total };
  }

  // terms: live counts, so hide_empty tracks what is published now
  const counts = (await allTermCounts())[path];
  const col = await collection(path);
  const docs = await col.find({}, { projection: { link: 1, slug: 1, seo: 1, name: 1 } }).collation({ locale: "en" }).sort(sort).toArray();
  const rows = docs
    .map((d) => ({ link: d.link, slug: d.slug, count: counts[d._id] ?? 0, yoast_head_json: robots(d.seo) }))
    .filter((r) => params.get("hide_empty") !== "true" || r.count > 0);
  return { items: rows.slice(skip, skip + perPage), total: rows.length };
}

const cachedList = cached("rest:list", listImpl, { revalidate: 3600, tags: ["wp", "sitemap"] });

/** The MongoDB answer to `GET /wp/v2/<path>?<params>` for the sitemap's queries. */
export function restList(path: string, params: Record<string, string>, revalidate: number): Promise<RestList> {
  if (!PATHS.includes(path)) return Promise.reject(new Error(`rest-list: unsupported collection ${path}`));
  // the query string is the cache key; posts re-read on the posts TTL, the rest hourly
  const run = revalidate < 3600 ? cachedPosts : cachedList;
  return run(path as Path, new URLSearchParams(params).toString());
}

const cachedPosts = cached("rest:list:posts", listImpl, { revalidate: 60, tags: ["wp", "wp:posts", "sitemap"] });
