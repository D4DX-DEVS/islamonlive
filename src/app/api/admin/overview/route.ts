import { NextResponse } from "next/server";
import { getAnalyticsSummary } from "@/lib/analytics";
import { POST_STATS_CACHE } from "@/lib/admin-posts";
import { adminTaxonomyCacheHeaders, getAdminTaxonomyCached } from "@/lib/admin-taxonomy-cache";
import { getContentStatus } from "@/lib/content-status";
import { getAdminSession } from "@/lib/wp-admin";

export const dynamic = "force-dynamic";

const WINDOWS = [7, 30, 90];
const reason = (result: PromiseRejectedResult) => (result.reason instanceof Error ? result.reason.message : "Could not load");

/**
 * Everything the Overview shows. Publishing activity comes from WordPress and
 * reader activity from the site's own event log; each can fail on its own, so
 * a problem with one still leaves the other on screen.
 */
export async function GET(request: Request) {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ error: "Admin authentication required" }, { status: 401 });
  const requested = Number(new URL(request.url).searchParams.get("days"));
  const days = WINDOWS.includes(requested) ? requested : 30;
  const [reader, content] = await Promise.allSettled([
    getAnalyticsSummary(days),
    getAdminTaxonomyCached(`${POST_STATS_CACHE}${session.username}:overview:${days}`, () => getContentStatus(days)),
  ]);
  if (reader.status === "rejected" && content.status === "rejected") return NextResponse.json({ error: reason(content) }, { status: 502 });
  return NextResponse.json({
    reader: reader.status === "fulfilled" ? reader.value : null,
    content: content.status === "fulfilled" ? content.value : null,
    errors: { reader: reader.status === "rejected" ? reason(reader) : null, content: content.status === "rejected" ? reason(content) : null },
  }, { headers: adminTaxonomyCacheHeaders() });
}
