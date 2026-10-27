/* "which list am I looking at?", small enough to hand to a client component and
   hand back with every load-more call. The listing pages resolve slugs to ids
   server-side, so the browser only ever carries ids — never a slug lookup.
   Lives apart from feed.ts so InfiniteFeed can import it without pulling the
   data source into the browser bundle. */
export type FeedQuery =
  | { kind: "category"; ids: number[] }
  | { kind: "author"; id: number }
  | { kind: "tag"; id: number }
  | { kind: "search"; q: string };

export const FEED_PER_PAGE = 12;
