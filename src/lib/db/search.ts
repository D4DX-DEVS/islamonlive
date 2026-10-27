import type { PostQuery, WPPage_, WPPost } from "@/lib/wp-model";

/* Post search from MongoDB — the `search` branch of a PostQuery. One spelling
   per call; lib/search.ts still fans a query out into its Malayalam variants
   and interleaves the pages. */

export async function searchPostsPage(opts: PostQuery): Promise<WPPage_<WPPost>> {
  void opts;
  throw new Error("db/search.searchPostsPage: not implemented");
}
