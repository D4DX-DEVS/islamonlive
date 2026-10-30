import { NextResponse } from "next/server";
import { requireAdministrator, privateNoStore } from "@/lib/auth/actor";
import { discardDraft, saveDraft } from "@/lib/home-layout/store";

export const dynamic = "force-dynamic";

/* The homepage builder's autosave: { sections, theme } as the administrator works.
   Only the admin preview shows a draft; publishing goes through ../route.ts. */

export async function PUT(request: Request) {
  const actor = await requireAdministrator();
  if (actor instanceof Response) return actor;
  const body = await request.json().catch(() => null) as { sections?: unknown; theme?: unknown } | null;
  if (!body || !Array.isArray(body.sections)) return NextResponse.json({ error: "Send the draft as { sections: [...] }." }, { status: 400 });
  try {
    return NextResponse.json(await saveDraft(body.sections, actor, body.theme), { headers: privateNoStore });
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (/layout|section/i.test(message)) return NextResponse.json({ error: message }, { status: 400, headers: privateNoStore });
    console.error("[home-layout] draft save failed:", message);
    return NextResponse.json({ error: "The draft could not be saved. Your changes are still on screen." }, { status: 502, headers: privateNoStore });
  }
}

export async function DELETE() {
  const actor = await requireAdministrator();
  if (actor instanceof Response) return actor;
  try {
    await discardDraft();
    return NextResponse.json({ ok: true }, { headers: privateNoStore });
  } catch (error) {
    console.error("[home-layout] draft discard failed:", error instanceof Error ? error.message : error);
    return NextResponse.json({ error: "The draft could not be discarded. Try again." }, { status: 502, headers: privateNoStore });
  }
}
