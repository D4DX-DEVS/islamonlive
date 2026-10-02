import { NextResponse } from "next/server";
import { getAdminSession, wpAdminFetch } from "@/lib/wp-admin";
import { adminTaxonomyCacheHeaders, getAdminTaxonomyCached } from "@/lib/admin-taxonomy-cache";
import { POST_STATS_CACHE } from "@/lib/admin-posts";

export const dynamic = "force-dynamic";

/** An author is "active" when they have published an article in this many days. */
const WINDOW_DAYS = 90;
/** Posts are read 100 at a time; ten pages is far more than a window holds. */
const MAX_PAGES = 10;

export async function GET() {
  try {
    const session = await getAdminSession();
    if (!session) throw new Error("Admin authentication required");
    const result = await getAdminTaxonomyCached(`${POST_STATS_CACHE}${session.username}:authors-active`, async () => {
      const after = new Date(Date.now() - WINDOW_DAYS * 86_400_000).toISOString();
      const query = (page: number) => `/posts?${new URLSearchParams({ status: "publish", after, per_page: "100", page: String(page), _fields: "author" })}`;
      const first = await wpAdminFetch(query(1));
      const firstRows = await first.json();
      if (!first.ok) throw new Error(firstRows?.message || "Could not load recent articles");
      const pages = Math.min(Number(first.headers.get("X-WP-TotalPages") || 1), MAX_PAGES);
      const rest = await Promise.all(Array.from({ length: Math.max(0, pages - 1) }, (_, index) => wpAdminFetch(query(index + 2)).then((response) => (response.ok ? response.json() : []))));
      const ids = new Set((([firstRows, ...rest] as { author?: number }[][]).flat()).flatMap((post) => (Number.isInteger(post.author) ? [Number(post.author)] : [])));
      return { days: WINDOW_DAYS, activeIds: [...ids] };
    });
    return NextResponse.json(result, { headers: adminTaxonomyCacheHeaders() });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Could not load author activity";
    return NextResponse.json({ error: message }, { status: message.includes("authentication") ? 401 : 502 });
  }
}
