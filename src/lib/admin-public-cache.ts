import { revalidatePath, revalidateTag } from "next/cache";
import { purgePaths } from "@/lib/cloudflare";
import { toSitePath } from "@/lib/urls";

type SavedPost = {
  link?: unknown;
  status?: unknown;
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

  for (const tag of tags) revalidateTag(tag, profile);
  for (const path of paths) revalidatePath(path);

  // Cloudflare is optional in local and preview environments. purgePaths is
  // deliberately best-effort, so a CDN outage never turns a successful WP
  // save into a failed admin request.
  await purgePaths(paths);
}
