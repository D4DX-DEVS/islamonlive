import { sitemapIndex, sitemapUnavailable } from "@/lib/sitemap";

/* /sitemap_index.xml and /sitemap.xml are rewritten here (next.config).
   The child files live at ./[type]/[page] — see lib/sitemap.ts for why the
   whole set exists at Yoast's old addresses. */

export const revalidate = 3600;

export async function GET(): Promise<Response> {
  try {
    return await sitemapIndex();
  } catch {
    return sitemapUnavailable();
  }
}
