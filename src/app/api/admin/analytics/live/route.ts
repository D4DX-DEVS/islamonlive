import { NextResponse } from "next/server";
import { analyticsAccessDenied, noStore, reportFailed } from "@/lib/analytics/admin-access";
import { liveReport } from "@/lib/analytics/report";

export const dynamic = "force-dynamic";

/** Readers seen in the last two minutes, as counts per page. Administrators only. */
export async function GET(): Promise<Response> {
  const denied = await analyticsAccessDenied();
  if (denied) return denied;
  try {
    return NextResponse.json(await liveReport(), { headers: noStore });
  } catch (error) {
    return reportFailed("live readers", error);
  }
}
