import { TTL } from "@/lib/cache";
import { WP_API } from "@/lib/env";
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

const COLLECTIONS = { post: "posts", page: "pages", category: "categories", tag: "tags", author: "users" } as const;

type Kind = keyof typeof COLLECTIONS;

export async function GET(_request: Request, ctx: { params: Promise<{ type: string; id: string }> }): Promise<Response> {
  const { type, id } = await ctx.params;

  if (!(type in COLLECTIONS) || !/^\d+$/.test(id)) {
    return new Response("Not found", { status: 404 });
  }

  const collection = COLLECTIONS[type as Kind];
  const res = await fetch(`${WP_API}/${collection}/${id}?_fields=link`, {
    next: { revalidate: TTL.taxonomy, tags: ["wp", `wp:${collection}`] },
  });

  if (!res.ok) return new Response("Not found", { status: 404 });

  const { link } = (await res.json()) as { link?: string };
  if (!link) return new Response("Not found", { status: 404 });

  return Response.redirect(toSiteUrl(link), 301);
}
