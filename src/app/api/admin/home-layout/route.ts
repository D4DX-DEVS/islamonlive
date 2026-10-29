import { NextResponse } from "next/server";
import { requireAdministrator, privateNoStore } from "@/lib/auth/actor";
import { recordActivity } from "@/lib/activity";
import { collection } from "@/lib/db/client";
import { escapeRegex } from "@/lib/admin-rest/http";
import { getLayoutState, restoreHomeLayout, saveHomeLayout } from "@/lib/home-layout/store";

export const dynamic = "force-dynamic";

function failed(what: string, error: unknown): Response {
  const message = error instanceof Error ? error.message : "";
  // validation messages are ours and safe to show; anything else stays in the log
  if (/layout|section|version/i.test(message)) return NextResponse.json({ error: message }, { status: 400, headers: privateNoStore });
  console.error(`[home-layout] ${what} failed:`, message);
  return NextResponse.json({ error: `Could not ${what}. Try again in a moment.` }, { status: 502, headers: privateNoStore });
}

/** The current layout and its history; `?tags=word` instead searches tags for the section editor. */
export async function GET(request: Request) {
  const actor = await requireAdministrator();
  if (actor instanceof Response) return actor;
  try {
    const url = new URL(request.url);
    const tagQuery = url.searchParams.get("tags");
    const tagIds = url.searchParams.get("tagIds");
    if (tagQuery !== null || tagIds !== null) {
      const tags = await collection("tags");
      const ids = (tagIds ?? "").split(",").map(Number).filter((n) => Number.isInteger(n) && n > 0).slice(0, 50);
      const filter = ids.length ? { _id: { $in: ids } } : { name: { $regex: escapeRegex(tagQuery!.trim().slice(0, 60)), $options: "i" } };
      const items = await tags.find(filter, { projection: { name: 1, slug: 1, count: 1 } }).sort({ count: -1 }).limit(20).toArray();
      return NextResponse.json({ items: items.map((t) => ({ id: t._id, name: t.name, slug: t.slug, count: t.count })) }, { headers: privateNoStore });
    }
    return NextResponse.json(await getLayoutState(), { headers: privateNoStore });
  } catch (error) {
    return failed("load the homepage layout", error);
  }
}

/** Publish a new arrangement: { sections }. */
export async function PUT(request: Request) {
  const actor = await requireAdministrator();
  if (actor instanceof Response) return actor;
  const body = await request.json().catch(() => null) as { sections?: unknown } | null;
  if (!body || !Array.isArray(body.sections)) return NextResponse.json({ error: "Send the layout as { sections: [...] }." }, { status: 400 });
  try {
    await saveHomeLayout(body.sections, actor);
    await recordActivity(actor, "layout.update", { type: "layout", id: "home", title: "Homepage", link: "/" });
    return NextResponse.json(await getLayoutState(), { headers: privateNoStore });
  } catch (error) {
    return failed("save the homepage layout", error);
  }
}

/** Restore an earlier version: { restore: index }. */
export async function POST(request: Request) {
  const actor = await requireAdministrator();
  if (actor instanceof Response) return actor;
  const body = await request.json().catch(() => null) as { restore?: unknown } | null;
  const index = Number(body?.restore);
  if (!Number.isInteger(index) || index < 0) return NextResponse.json({ error: "Choose a version to restore." }, { status: 400 });
  try {
    await restoreHomeLayout(index, actor);
    await recordActivity(actor, "layout.restore", { type: "layout", id: "home", title: "Homepage", link: "/" });
    return NextResponse.json(await getLayoutState(), { headers: privateNoStore });
  } catch (error) {
    return failed("restore that version", error);
  }
}
