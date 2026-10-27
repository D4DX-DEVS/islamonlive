import { feedResponse, feedUnavailable, latestFeedPosts, renderRss } from "@/lib/rss";

/* /feed/, /feed/rss2/ … (next.config rewrites them here when DATA_SOURCE=mongo).
   Live WordPress output reproduced by lib/rss.ts. */
export async function GET(): Promise<Response> {
  try {
    return feedResponse(renderRss(await latestFeedPosts()), "rss");
  } catch {
    return feedUnavailable();
  }
}
