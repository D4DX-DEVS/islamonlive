import { NextResponse } from "next/server";
import { getAdminActor } from "@/lib/auth/actor";
import { recordActivity } from "@/lib/activity";
import { analyticsAccessDenied, noStore } from "@/lib/analytics/admin-access";
import { deleteAllReaderData } from "@/lib/analytics/aggregate";
import { forgetReports } from "@/lib/analytics/report";

export const dynamic = "force-dynamic";

/** Deletes every reader view and daily rollup kept so far. Administrators only; recorded in the activity log. */
export async function DELETE(): Promise<Response> {
  const denied = await analyticsAccessDenied();
  if (denied) return denied;
  try {
    const deleted = await deleteAllReaderData();
    forgetReports();
    const actor = await getAdminActor().catch(() => null);
    if (actor) await recordActivity(actor, "analytics.delete", { type: "analytics", id: null, title: `${deleted.views.toLocaleString("en")} page ${deleted.views === 1 ? "view" : "views"}`, link: null });
    return NextResponse.json({ deleted }, { headers: noStore });
  } catch (error) {
    console.error("[analytics] delete failed:", error instanceof Error ? error.message : error);
    return NextResponse.json({ error: "Could not delete the reader data. Try again in a moment." }, { status: 502, headers: noStore });
  }
}
