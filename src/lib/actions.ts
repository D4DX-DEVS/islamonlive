"use server";

import { feedPosts, type FeedQuery } from "@/lib/feed";
import type { WPPost } from "@/lib/wordpress";

/* the one server entry point behind the infinite lists. It exists so the WP
   endpoint, its query shape and the API host stay on the server — the browser
   posts a `FeedQuery` and gets posts back, nothing else. */
export async function loadMorePosts(query: FeedQuery, page: number, perPage: number): Promise<WPPost[]> {
  try {
    return await feedPosts(query, page, perPage);
  } catch (error: unknown) {
    // WP answers a page past the last one with 400 rest_post_invalid_page_number.
    // That is "no more posts", not a failure — anything else is a real error and
    // must reach the caller, or a dropped request would look like the end of the
    // list and quietly hide the rest of the archive.
    const message = error instanceof Error ? error.message : "";
    if (message.includes("WP API 400") || message.includes("WP API 404")) return [];
    throw error;
  }
}
