import { timingSafeEqual } from "node:crypto";
import { revalidatePath, revalidateTag } from "next/cache";
import { REVALIDATION_SECRET } from "@/lib/env";
import { toSitePath, withTrailingSlash } from "@/lib/urls";

/* The endpoint WordPress calls when an editor changes something.

   Without it the site is only ever as fresh as lib/cache.ts's TTLs — a 60s wait
   on a breaking story, an hour on a renamed category — and with 22,000 articles
   a full rebuild per edit is not on the table. So WP posts here on save,
   publish, unpublish, delete and restore, and only the routes that actually
   changed are dropped from the cache.

   Two invalidations happen per call, because they cover different things:
     - revalidateTag drops the WP *fetches* (every wpFetch carries "wp" plus a
       per-endpoint tag), which is what makes a listing notice a new post.
     - revalidatePath drops the *rendered* routes, which is what makes the
       article page itself re-render.

   Next 16 note: the one-argument revalidateTag(tag) is deprecated. The second
   argument picks the semantics — "max" marks the entry stale and serves it
   while refreshing behind the reader, which is what a news site wants; expiring
   it outright would make the first visitor after every edit wait on WordPress.

   Deletions are the exception. A deleted article must stop being served at
   once, not after one more stale hit, so those expire immediately. */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface RevalidatePayload {
  secret?: string;
  /** publish | update | delete | trash | draft | restore | schedule */
  event?: string;
  post?: {
    id?: number;
    slug?: string;
    /** the permalink WP computed — the most reliable source of the path */
    link?: string;
    type?: "post" | "page";
    status?: string;
    /** term slugs, not ids: the frontend routes by slug */
    categories?: string[];
    tags?: string[];
    author?: string;
    /** the permalink *before* this edit, when the slug or category changed */
    previous_link?: string;
  };
  /** escape hatch: explicit paths to drop, for a hand-run curl */
  paths?: string[];
}

/** Constant-time compare so a wrong secret cannot be guessed a byte at a time. */
function secretMatches(provided: string | null | undefined): boolean {
  if (!REVALIDATION_SECRET || !provided) return false;
  const a = Buffer.from(provided);
  const b = Buffer.from(REVALIDATION_SECRET);
  // timingSafeEqual throws on a length mismatch, which is itself a leak-free
  // answer — different lengths cannot be the same secret
  return a.length === b.length && timingSafeEqual(a, b);
}

function pathFor(link: string | undefined): string | null {
  if (!link) return null;
  try {
    return toSitePath(link);
  } catch {
    return null;
  }
}

export async function POST(request: Request): Promise<Response> {
  if (!REVALIDATION_SECRET) {
    // an unset secret must fail closed — never "no secret configured, allow all"
    return Response.json({ ok: false, error: "REVALIDATION_SECRET is not configured" }, { status: 503 });
  }

  let payload: RevalidatePayload;
  try {
    payload = (await request.json()) as RevalidatePayload;
  } catch {
    return Response.json({ ok: false, error: "Invalid JSON body" }, { status: 400 });
  }

  // header preferred; the body field is there for WP installs whose host strips
  // custom headers on outbound requests
  const provided = request.headers.get("x-revalidate-secret") ?? payload.secret;
  if (!secretMatches(provided)) {
    return Response.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const { event = "update", post, paths: explicit } = payload;
  const removed = event === "delete" || event === "trash" || post?.status === "draft" || post?.status === "trash";
  const profile = removed ? { expire: 0 } : "max";

  const paths = new Set<string>();

  // the article itself, and wherever it used to live if the slug moved
  for (const link of [post?.link, post?.previous_link]) {
    const p = pathFor(link);
    if (p) paths.add(p);
  }
  for (const p of explicit ?? []) paths.add(withTrailingSlash(p));

  // the lists it appears in
  paths.add("/");
  for (const slug of post?.categories ?? []) paths.add(`/category/${slug}/`);
  for (const slug of post?.tags ?? []) paths.add(`/tag/${slug}/`);
  if (post?.author) paths.add(`/author/${post.author}/`);

  const tags = [
    "wp",
    post?.type === "page" ? "wp:pages" : "wp:posts",
    "wp:categories",
    "wp:tags",
    // the sitemaps read WP directly and carry their own tag
    "sitemap",
  ];

  for (const tag of tags) revalidateTag(tag, profile);
  for (const path of paths) revalidatePath(path);

  /* Search results are rendered per query and cannot be enumerated, so they are
     not in `paths`; they ride on the wp:posts tag above, which every search
     fetch is tagged with. Same for the related-articles rail. */

  return Response.json({
    ok: true,
    event,
    revalidated: { paths: [...paths], tags },
    now: new Date().toISOString(),
  });
}

/** GET is a health check for the WP settings screen — it never invalidates. */
export function GET(): Response {
  return Response.json({ ok: true, configured: Boolean(REVALIDATION_SECRET) });
}
