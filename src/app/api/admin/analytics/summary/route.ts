import { NextResponse } from "next/server";
import { analyticsAccessDenied, noStore, reportFailed } from "@/lib/analytics/admin-access";
import { parseFilters } from "@/lib/analytics/filters";
import { summary } from "@/lib/analytics/report";

export const dynamic = "force-dynamic";

/** Cards, trend, breakdowns, top lists and insights for the Analytics page. Administrators only. */
export async function GET(request: Request): Promise<Response> {
  const denied = await analyticsAccessDenied();
  if (denied) return denied;
  const filters = parseFilters(new URL(request.url).searchParams);
  if ("error" in filters) return NextResponse.json({ error: filters.error }, { status: 400, headers: noStore });
  try {
    return NextResponse.json(await summary(filters), { headers: noStore });
  } catch (error) {
    return reportFailed("the analytics summary", error);
  }
}
