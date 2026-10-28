import { NextResponse } from "next/server";
import { analyticsAccessDenied, noStore, reportFailed } from "@/lib/analytics/admin-access";
import { parseFilters } from "@/lib/analytics/filters";
import { articlesTable } from "@/lib/analytics/report";
import { ARTICLE_SORTS, PAGE_SIZES, type ArticleSort } from "@/lib/analytics/report-types";

export const dynamic = "force-dynamic";

/** The article performance table: `q`, `sort` (allow-listed), `order`, `page`, `pageSize` (10/20/50/100). Administrators only. */
export async function GET(request: Request): Promise<Response> {
  const denied = await analyticsAccessDenied();
  if (denied) return denied;
  const params = new URL(request.url).searchParams;
  const filters = parseFilters(params);
  if ("error" in filters) return NextResponse.json({ error: filters.error }, { status: 400, headers: noStore });
  const sort = (params.get("sort") ?? "views") as ArticleSort;
  const order = params.get("order") ?? "desc";
  const page = Number(params.get("page") ?? 1);
  const pageSize = Number(params.get("pageSize") ?? 20);
  const q = (params.get("q") ?? "").slice(0, 200);
  if (!ARTICLE_SORTS.includes(sort) || (order !== "asc" && order !== "desc") || !Number.isInteger(page) || page < 1 || !(PAGE_SIZES as readonly number[]).includes(pageSize)) {
    return NextResponse.json({ error: "Unknown sort, order, page or page size." }, { status: 400, headers: noStore });
  }
  try {
    return NextResponse.json(await articlesTable(filters, { q, sort, order, page, pageSize }), { headers: noStore });
  } catch (error) {
    return reportFailed("the article table", error);
  }
}
