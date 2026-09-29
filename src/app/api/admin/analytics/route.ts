import { NextResponse } from "next/server";
import { getAnalyticsSummary } from "@/lib/analytics";
import { getAdminSession } from "@/lib/wp-admin";

export const dynamic = "force-dynamic";

export async function GET() {
  if (!(await getAdminSession())) return NextResponse.json({ error: "Admin authentication required" }, { status: 401 });
  try { return NextResponse.json(await getAnalyticsSummary(30)); } catch (error: unknown) { return NextResponse.json({ error: error instanceof Error ? error.message : "Could not load analytics" }, { status: 500 }); }
}
