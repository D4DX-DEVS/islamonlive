import { revalidatePath, revalidateTag } from "next/cache";
import { purgePaths } from "@/lib/cloudflare";
import { toSitePath } from "@/lib/urls";

type SavedPost = {
  link?: unknown;
  status?: unknown;
  /** URLs the post has left (MongoDB backend); their cached pages must go too. */
  old_paths?: unknown;
};

function postPath(link: unknown): string | null {
  if (typeof link !== "string" || !link) return null;
  try {
    return toSitePath(link);
  } catch {
    return null;
  }
}

/**
 * Drop the public cache after a write made through the admin workspace.
 *
 * The WordPress webhook covers edits made in wp-admin. The Next admin writes
 * through the REST API directly, so it must perform the same invalidation
 * itself or readers can continue to receive the old article until TTL expiry.
 */
export async function invalidatePublicPostCache(post: SavedPost): Promise<void> {
  const removed = post.status === "draft" || post.status === "trash";
  const profile = removed ? { expire: 0 } : "max";
  const tags = ["wp", "wp:posts", "wp:categories", "wp:tags", "sitemap"];
  const paths = new Set<string>(["/"]);
  const articlePath = postPath(post.link);
  if (articlePath) paths.add(articlePath);
  /* A renamed post's old URL is cached as the article (200). Left to
     stale-while-revalidate, Next re-renders it in the background into a 308
     and replays that from cache without its Location header, so readers and
     Google get a redirect to nowhere. Purging the path makes the next visit
     render the redirect fresh, which keeps the header. */
  if (Array.isArray(post.old_paths)) for (const old of post.old_paths) if (typeof old === "string" && old.startsWith("/")) paths.add(old);

  for (const tag of tags) revalidateTag(tag, profile);
  for (const path of paths) revalidatePath(path);

  // Cloudflare is optional in local and preview environments. purgePaths is
  // deliberately best-effort, so a CDN outage never turns a successful WP
  // save into a failed admin request.
  await purgePaths(paths);
}
