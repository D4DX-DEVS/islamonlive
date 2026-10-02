import { WP_URL } from "@/lib/env";
import { countPosts } from "@/lib/admin-posts";
import { decodeEntities } from "@/lib/wordpress";
import { wpAdminFetch } from "@/lib/wp-admin";
import { getAuthorProfiles, getCategoryNames, getThumbnails } from "@/lib/wp-lookup";

const DAY_MS = 86_400_000;
/** Posts are read 100 at a time; ten pages comfortably covers a 90-day window. */
const MAX_PAGES = 10;

export type ContentStatus = {
  windowDays: number;
  /** First and last day of the window in the WordPress site's own time zone, YYYY-MM-DD. */
  from: string;
  to: string;
  /** Current totals by status, whatever the window. */
  counts: { publish: number; draft: number; pending: number; future: number };
  published: { total: number; previous: number; daily: { date: string; count: number }[] };
  latest: { id: number; title: string; path: string; date: string; author: string | null; authorAvatar: string | null; imageUrl: string | null }[];
  topCategories: { id: number; name: string; count: number }[];
  topAuthors: { id: number; name: string; count: number; avatar: string | null }[];
};

let siteOffset: { ms: number; at: number } | null = null;

/** The site's UTC offset, so "today" and each post's day line up with how the newsroom sees them. */
async function getSiteOffsetMs(): Promise<number> {
  if (siteOffset && Date.now() - siteOffset.at < 3_600_000) return siteOffset.ms;
  let ms = siteOffset?.ms ?? 0;
  try {
    const response = await fetch(`${WP_URL}/wp-json/`, { cache: "no-store", signal: AbortSignal.timeout(2500) });
    const hours = response.ok ? Number((await response.json() as { gmt_offset?: number }).gmt_offset) : NaN;
    if (Number.isFinite(hours)) ms = hours * 3_600_000;
  } catch { /* fall back to the last known offset, or UTC */ }
  siteOffset = { ms, at: Date.now() };
  return ms;
}

const isoDay = (ms: number) => new Date(ms).toISOString().slice(0, 10);

type WindowPost = { id: number; date: string; author: number; categories: number[] };

async function publishedSince(from: string): Promise<WindowPost[]> {
  const query = (page: number) => `/posts?${new URLSearchParams({ status: "publish", after: `${from}T00:00:00`, per_page: "100", page: String(page), orderby: "date", order: "desc", _fields: "id,date,author,categories" })}`;
  const first = await wpAdminFetch(query(1));
  const firstRows = await first.json();
  if (!first.ok) throw new Error(firstRows?.message || "Could not load recent articles");
  const pages = Math.min(Number(first.headers.get("X-WP-TotalPages") || 1), MAX_PAGES);
  const rest = await Promise.all(Array.from({ length: Math.max(0, pages - 1) }, (_, index) => wpAdminFetch(query(index + 2)).then((response) => (response.ok ? response.json() : []))));
  return [firstRows, ...rest].flat() as WindowPost[];
}

function topFive(counts: Map<number, number>): { id: number; count: number }[] {
  return [...counts.entries()].map(([id, count]) => ({ id, count })).sort((a, b) => b.count - a.count).slice(0, 5);
}

export async function getContentStatus(windowDays: number): Promise<ContentStatus> {
  const offset = await getSiteOffsetMs();
  const today = Date.parse(`${isoDay(Date.now() + offset)}T00:00:00Z`);
  const start = today - (windowDays - 1) * DAY_MS;
  const from = isoDay(start);
  const previousFrom = isoDay(start - windowDays * DAY_MS);

  const [publish, draft, pending, future, previous, posts, latestResponse] = await Promise.all([
    countPosts({ status: "publish" }), countPosts({ status: "draft" }), countPosts({ status: "pending" }), countPosts({ status: "future" }),
    countPosts({ status: "publish", after: `${previousFrom}T00:00:00`, before: `${from}T00:00:00` }),
    publishedSince(from),
    wpAdminFetch(`/posts?${new URLSearchParams({ status: "publish", per_page: "8", orderby: "date", order: "desc", _fields: "id,date,title,author,link,featured_media" })}`),
  ]);
  const latestRows = await latestResponse.json();
  if (!latestResponse.ok) throw new Error(latestRows?.message || "Could not load the latest articles");
  const latestPosts = latestRows as { id: number; date: string; title?: { rendered?: string }; author?: number; link?: string; featured_media?: number }[];

  const perDay = new Map<string, number>();
  const categoryCounts = new Map<number, number>();
  const authorCounts = new Map<number, number>();
  for (const post of posts) {
    perDay.set(post.date.slice(0, 10), (perDay.get(post.date.slice(0, 10)) ?? 0) + 1);
    for (const category of post.categories ?? []) categoryCounts.set(category, (categoryCounts.get(category) ?? 0) + 1);
    if (post.author) authorCounts.set(post.author, (authorCounts.get(post.author) ?? 0) + 1);
  }
  const topCategoryIds = topFive(categoryCounts);
  const topAuthorIds = topFive(authorCounts);

  const [categoryNames, authors, thumbnails] = await Promise.all([
    getCategoryNames(topCategoryIds.map((item) => item.id)),
    getAuthorProfiles([...topAuthorIds.map((item) => item.id), ...latestPosts.flatMap((post) => post.author || [])]),
    getThumbnails(latestPosts.flatMap((post) => post.featured_media || [])),
  ]);

  return {
    windowDays,
    from,
    to: isoDay(today),
    counts: { publish, draft, pending, future },
    published: {
      total: posts.length,
      previous,
      daily: Array.from({ length: windowDays }, (_, index) => { const date = isoDay(start + index * DAY_MS); return { date, count: perDay.get(date) ?? 0 }; }),
    },
    latest: latestPosts.map((post) => ({
      id: post.id,
      title: decodeEntities((post.title?.rendered ?? "").replace(/<[^>]*>/g, "")).trim() || "(no title)",
      path: post.link ? new URL(post.link).pathname : "/",
      date: post.date,
      author: post.author ? authors.get(post.author)?.name ?? null : null,
      authorAvatar: post.author ? authors.get(post.author)?.avatar ?? null : null,
      imageUrl: post.featured_media ? thumbnails.get(post.featured_media) ?? null : null,
    })),
    topCategories: topCategoryIds.flatMap(({ id, count }) => categoryNames.has(id) ? [{ id, name: categoryNames.get(id)!, count }] : []),
    topAuthors: topAuthorIds.flatMap(({ id, count }) => authors.has(id) ? [{ id, name: authors.get(id)!.name, count, avatar: authors.get(id)!.avatar }] : []),
  };
}
