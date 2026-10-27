import { TTL } from "@/lib/cache";
import { DATA_SOURCE, WP_API } from "@/lib/env";
import { collection } from "@/lib/db/client";
import { publicFilter } from "@/lib/db/posts";
import { authorsWithPublishedPosts } from "@/lib/db/users";
import { toSiteUrl } from "@/lib/urls";

/* Resolver for WordPress's pre-permalink URLs.

   Before pretty permalinks the site addressed everything by id —
   /?p=136123, /?page_id=7712, /?cat=60 — and links in that form are still out
   there in old forum posts, emails and scrapes. next.config turns each of them
   into /go/{type}/{id}/, and this handler asks WordPress what that id's
   permalink is today and 301s to it.

   One hop, always permanent: the point is to hand Google the modern URL and
   have it forget the query-string one. An id that no longer exists gets a 404
   rather than a redirect to the home page — a soft-404 chain is worse than an
   honest miss. */

export const revalidate = 86400;

const COLLECTIONS: Record<string, "posts" | "pages" | "categories" | "tags" | "users"> = {
  post: "posts",
  page: "pages",
  category: "categories",
  tag: "tags",
  author: "users",
} as const;

export async function GET(_request: Request, ctx: { params: Promise<{ type: string; id: string }> }): Promise<Response> {
  const { type, id } = await ctx.params;

  // own keys only: `in` would also accept "constructor" and friends
  if (!Object.hasOwn(COLLECTIONS, type) || !/^\d+$/.test(id)) {
    return new Response("Not found", { status: 404 });
  }

  const collectionName = COLLECTIONS[type];
  const numId = Number(id);

  if (DATA_SOURCE === "mongo") {
    /* Only what WordPress would show an anonymous visitor: the collections
       also hold drafts, private and trashed posts and every user account. A
       draft's link is /?p=ID, which the proxy sends back here — answering it
       would loop as well as leak its headline. */
    const visible =
      collectionName === "posts" ? publicFilter() : collectionName === "pages" ? { status: "publish" } : collectionName === "users" ? { _id: { $in: await authorsWithPublishedPosts() } } : {};
    const col = await collection(collectionName);
    // $and, not a spread: `visible` may constrain _id too, and a spread would replace the id asked for
    const doc = (await col.findOne({ $and: [{ _id: numId }, visible] } as Record<string, unknown>, { projection: { link: 1 } })) as { _id?: number; link?: string } | null;

    if (!doc?.link) return new Response("Not found", { status: 404 });

    return Response.redirect(toSiteUrl(doc.link), 301);
  }

  const res = await fetch(`${WP_API}/${collectionName}/${id}?_fields=link`, {
    next: { revalidate: TTL.taxonomy, tags: ["wp", `wp:${collectionName}`] },
  });

  if (!res.ok) return new Response("Not found", { status: 404 });

  const { link } = (await res.json()) as { link?: string };
  if (!link) return new Response("Not found", { status: 404 });

  return Response.redirect(toSiteUrl(link), 301);
}
