import { NextResponse } from "next/server";
import { getAdminSession } from "@/lib/wp-admin";
import { adminTaxonomyCacheHeaders, getAdminTaxonomyCached } from "@/lib/admin-taxonomy-cache";
import { countPosts as count, POST_STATS_CACHE } from "@/lib/admin-posts";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const session = await getAdminSession();
    if (!session) return NextResponse.json({ error: "Admin authentication required" }, { status: 401 });
    const stats = await getAdminTaxonomyCached(`${POST_STATS_CACHE}${session.username}:posts`, async () => {
      const since = new Date(Date.now() - 30 * 86_400_000).toISOString();
      const [total, publish, draft, trash, recentTotal, recentPublish, recentDraft] = await Promise.all([
        count({ status: "any" }), count({ status: "publish" }), count({ status: "draft" }), count({ status: "trash" }),
        count({ status: "any", after: since }), count({ status: "publish", after: since }), count({ status: "draft", after: since }),
      ]);
      return { total, publish, draft, trash, recent: { total: recentTotal, publish: recentPublish, draft: recentDraft } };
    });
    return NextResponse.json(stats, { headers: adminTaxonomyCacheHeaders() });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Could not load article counts";
    return NextResponse.json({ error: message }, { status: message.includes("authentication") ? 401 : 502 });
  }
}
