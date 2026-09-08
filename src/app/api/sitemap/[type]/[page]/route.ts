import { childSitemap, isSitemapType, newsSitemap, sitemapUnavailable } from "@/lib/sitemap";

/* One child sitemap: /api/sitemap/post/12 is what /post-sitemap12.xml
   rewrites to, /api/sitemap/news/1 what /news-sitemap.xml does.

   The type and file number are path segments rather than a query string on
   purpose. A rewrite destination's query does not reach a route handler's
   request.url — with `/api/sitemap?type=post&page=12` every child file came
   back as the index — whereas the routed path's params always arrive. */

export const revalidate = 3600;

export async function GET(_request: Request, ctx: { params: Promise<{ type: string; page: string }> }): Promise<Response> {
  const { type, page } = await ctx.params;

  try {
    if (type === "news") return await newsSitemap();
    if (!isSitemapType(type)) return new Response("Not found", { status: 404 });

    const index = Number(page);
    if (!Number.isInteger(index) || index < 1 || index > 200) return new Response("Not found", { status: 404 });

    return await childSitemap(type, index);
  } catch {
    return sitemapUnavailable();
  }
}
