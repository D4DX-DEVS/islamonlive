import { NextResponse } from "next/server";
import { analyticsAccessDenied, noStore, reportFailed } from "@/lib/analytics/admin-access";
import { parseFilters } from "@/lib/analytics/filters";
import { listPage } from "@/lib/analytics/report";
import { LISTS, type ListName } from "@/lib/analytics/report-types";

export const dynamic = "force-dynamic";

/** Any page of one of the summary's ranked lists: `list` (allow-listed) and `page`, with the summary's filters. The page size is fixed. Administrators only. */
export async function GET(request: Request): Promise<Response> {
  const denied = await analyticsAccessDenied();
  if (denied) return denied;
  const params = new URL(request.url).searchParams;
  const filters = parseFilters(params);
  if ("error" in filters) return NextResponse.json({ error: filters.error }, { status: 400, headers: noStore });
  const list = params.get("list") as ListName;
  const page = Number(params.get("page") ?? 1);
  if (!LISTS.includes(list) || !Number.isInteger(page) || page < 1) {
    return NextResponse.json({ error: "Unknown list or page." }, { status: 400, headers: noStore });
  }
  try {
    return NextResponse.json(await listPage(filters, list, page), { headers: noStore });
  } catch (error) {
    return reportFailed("the analytics list", error);
  }
}
