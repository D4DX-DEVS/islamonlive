import { NextResponse } from "next/server";
import { requireAdministrator, privateNoStore } from "@/lib/auth/actor";
import { listActivity } from "@/lib/activity";

export const dynamic = "force-dynamic";

const PAGE_SIZES = [10, 20, 50, 100];

/** The admin activity log, newest first: ?page&pageSize&actor&action. Administrators only. */
export async function GET(request: Request) {
  const actor = await requireAdministrator();
  if (actor instanceof Response) return actor;
  const query = new URL(request.url).searchParams;
  const page = Number(query.get("page") || 1);
  const pageSize = Number(query.get("pageSize") || 20);
  const actorId = Number(query.get("actor") || 0);
  const action = query.get("action") || "";
  if (!Number.isInteger(page) || page < 1 || page > 10_000) return NextResponse.json({ error: "Invalid page" }, { status: 400 });
  if (!PAGE_SIZES.includes(pageSize)) return NextResponse.json({ error: "Invalid page size" }, { status: 400 });
  if (!Number.isInteger(actorId) || actorId < 0) return NextResponse.json({ error: "Invalid account" }, { status: 400 });
  if (action && !/^[a-z]+(\.[a-z]+)?$/.test(action)) return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  try {
    const { items, total } = await listActivity({ actorId: actorId || undefined, action: action || undefined, page, perPage: pageSize });
    return NextResponse.json({ data: items, page, pageSize, total, totalPages: Math.ceil(total / pageSize) }, { headers: privateNoStore });
  } catch (error) {
    console.error("[activity] list failed:", error instanceof Error ? error.message : error);
    return NextResponse.json({ error: "Could not load the activity log. Try again in a moment." }, { status: 502, headers: privateNoStore });
  }
}
