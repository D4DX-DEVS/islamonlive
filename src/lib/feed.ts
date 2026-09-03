import { getPosts, type WPPost } from "@/lib/wordpress";

/* "which list am I looking at?", small enough to hand to a client component and
   hand back with every load-more call. The listing pages resolve slugs to ids
   server-side, so the browser only ever carries ids — never a slug lookup. */
export type FeedQuery =
  | { kind: "category"; ids: number[] }
  | { kind: "author"; id: number }
  | { kind: "tag"; id: number }
  | { kind: "search"; q: string };

export const FEED_PER_PAGE = 12;

// WP itself 400s past the last page; these are belt-and-braces ceilings on input
// that arrives from the browser
const MAX_PAGE = 400;
const MAX_PER_PAGE = 24;
const MAX_IDS = 60;
const MAX_SEARCH = 120;

function clamp(n: number, lo: number, hi: number): number {
  return Number.isFinite(n) ? Math.min(hi, Math.max(lo, Math.trunc(n))) : lo;
}

function ids(list: unknown): number[] {
  if (!Array.isArray(list)) return [];
  return list.filter((n): n is number => Number.isInteger(n) && n > 0).slice(0, MAX_IDS);
}

/* the query crosses the network, so nothing is spread into the WP call — every
   field is rebuilt from a whitelisted, range-checked value */
export function feedPosts(query: FeedQuery, page: number, perPage: number): Promise<WPPost[]> {
  const p = clamp(page, 1, MAX_PAGE);
  const per = clamp(perPage, 1, MAX_PER_PAGE);

  switch (query?.kind) {
    case "category": {
      const categories = ids(query.ids);
      return categories.length ? getPosts({ categories, perPage: per, page: p }) : Promise.resolve([]);
    }
    case "author": {
      const author = clamp(query.id, 0, Number.MAX_SAFE_INTEGER);
      return author ? getPosts({ author, perPage: per, page: p }) : Promise.resolve([]);
    }
    case "tag": {
      const tag = clamp(query.id, 0, Number.MAX_SAFE_INTEGER);
      return tag ? getPosts({ tags: [tag], perPage: per, page: p }) : Promise.resolve([]);
    }
    case "search": {
      const search = String(query.q ?? "").slice(0, MAX_SEARCH).trim();
      return search ? getPosts({ search, perPage: per, page: p }) : Promise.resolve([]);
    }
    default:
      return Promise.resolve([]);
  }
}
