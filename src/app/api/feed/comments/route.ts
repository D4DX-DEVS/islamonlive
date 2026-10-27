import { feedResponse, feedUnavailable, latestFeedComments, renderCommentsRss } from "@/lib/rss";

/* /comments/feed/ (rewritten here when DATA_SOURCE=mongo). */
export async function GET(): Promise<Response> {
  try {
    return feedResponse(renderCommentsRss(await latestFeedComments()), "rss");
  } catch {
    return feedUnavailable();
  }
}
