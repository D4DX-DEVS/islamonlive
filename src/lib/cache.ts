/* One place for "how stale may this be, and what purges it early".
   Page-level `export const revalidate` has to stay a literal (Next static-analyses
   it), so these tiers govern the data layer — the fetches inside lib/ — while each
   page repeats its number with the tier named in a comment. */

export const TTL = {
  /** post lists and single posts — the only thing editors touch through the day */
  posts: 60,
  /** categories, tags, authors: renamed a few times a year */
  taxonomy: 3600,
  /** WP static pages (about, contact, privacy, ...) */
  page: 3600,
  /** third-party feeds we scrape: YouTube, Instagram, podcast RSS, home banners */
  media: 1800,
} as const;

/* Tags let a WP webhook (or a hand-run curl) purge a slice of the cache before
   its TTL is up — see app/api/revalidate. Every WP fetch carries "wp" plus a
   per-endpoint tag; the scrapers carry their source name. */
export const TAGS = ["wp", "wp:posts", "wp:pages", "wp:categories", "wp:tags", "wp:users", "youtube", "instagram", "podcast", "banners"] as const;

export type CacheTag = (typeof TAGS)[number];

/** "/posts?per_page=12" -> "wp:posts" */
export function wpTag(path: string): string {
  return `wp:${path.slice(1).split("?")[0].split("/")[0]}`;
}
