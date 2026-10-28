import { NextResponse } from "next/server";
import { analyticsAccessDenied, noStore, reportFailed } from "@/lib/analytics/admin-access";
import { parseFilters } from "@/lib/analytics/filters";
import { articleDetail } from "@/lib/analytics/report";

export const dynamic = "force-dynamic";

/** One article's numbers for the period, against the site average. Administrators only. */
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }): Promise<Response> {
  const denied = await analyticsAccessDenied();
  if (denied) return denied;
  const id = Number((await params).id);
  if (!Number.isInteger(id) || id < 1) return NextResponse.json({ error: "Unknown article." }, { status: 400, headers: noStore });
  const filters = parseFilters(new URL(request.url).searchParams);
  if ("error" in filters) return NextResponse.json({ error: filters.error }, { status: 400, headers: noStore });
  try {
    return NextResponse.json(await articleDetail(id, filters), { headers: noStore });
  } catch (error) {
    return reportFailed("this article's numbers", error);
  }
}
