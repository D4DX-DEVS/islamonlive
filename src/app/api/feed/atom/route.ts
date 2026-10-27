import { feedResponse, feedUnavailable, latestFeedPosts, renderAtom } from "@/lib/rss";

/* /feed/atom/ (rewritten here when DATA_SOURCE=mongo). */
export async function GET(): Promise<Response> {
  try {
    return feedResponse(renderAtom(await latestFeedPosts()), "atom");
  } catch {
    return feedUnavailable();
  }
}
