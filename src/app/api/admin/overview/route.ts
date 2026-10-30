import { NextResponse } from "next/server";
import { canSeeAnalytics } from "@/lib/analytics/admin-access";
import { parseFilters } from "@/lib/analytics/filters";
import { summary } from "@/lib/analytics/report";
import { POST_STATS_CACHE } from "@/lib/admin-posts";
import { adminTaxonomyCacheHeaders, getAdminTaxonomyCached } from "@/lib/admin-taxonomy-cache";
import { getContentStatus } from "@/lib/content-status";
import { getAdminSession } from "@/lib/wp-admin";

export const dynamic = "force-dynamic";

const WINDOWS = [7, 30, 90];
const reason = (result: PromiseRejectedResult) => (result.reason instanceof Error ? result.reason.message : "Could not load");

/**
 * Everything the Overview shows. Publishing activity comes from the content
 * source and reader activity from the site's own analytics (administrators
 * only; editors get `reader: null`). Each can fail on its own, so a problem
 * with one still leaves the other on screen.
 */
export async function GET(request: Request) {
  let session: Awaited<ReturnType<typeof getAdminSession>>;
  try {
    session = await getAdminSession();
  } catch {
    return NextResponse.json({ error: "The database could not be reached. Try again shortly." }, { status: 503 });
  }
  if (!session) return NextResponse.json({ error: "Admin authentication required" }, { status: 401 });
  const requested = Number(new URL(request.url).searchParams.get("days"));
  const days = WINDOWS.includes(requested) ? requested : 30;
  const readerFilters = parseFilters(new URLSearchParams({ range: String(days) }));
  const [reader, content] = await Promise.allSettled([
    (await canSeeAnalytics()) && !("error" in readerFilters) ? summary(readerFilters) : Promise.resolve(null),
    getAdminTaxonomyCached(`${POST_STATS_CACHE}${session.username}:overview:${days}`, () => getContentStatus(days)),
  ]);
  // the database's own message stays in the server log
  if (reader.status === "rejected") console.error("[analytics] overview reader numbers failed:", reason(reader));
  if (reader.status === "rejected" && content.status === "rejected") return NextResponse.json({ error: reason(content) }, { status: 502 });
  return NextResponse.json({
    reader: reader.status === "fulfilled" ? reader.value : null,
    content: content.status === "fulfilled" ? content.value : null,
    errors: { reader: reader.status === "rejected" ? "Reader numbers are unavailable right now. Try again in a moment." : null, content: content.status === "rejected" ? reason(content) : null },
  }, { headers: adminTaxonomyCacheHeaders() });
}
