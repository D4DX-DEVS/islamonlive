import { NextResponse } from "next/server";
import { renewAdminSession } from "@/lib/wp-admin";

export const dynamic = "force-dynamic";

const noStore = { "Cache-Control": "private, no-store" };

/* The workspace asks this when it opens and whenever it comes back into view:
   a tab left open overnight learns its session ended before the editor clicks
   anything, and a remembered session is slid forward while it is in use. */
export async function GET() {
  try {
    const expiresAt = await renewAdminSession();
    if (!expiresAt) return NextResponse.json({ signedIn: false }, { status: 401, headers: noStore });
    return NextResponse.json({ signedIn: true, expiresAt }, { headers: noStore });
  } catch {
    return NextResponse.json({ error: "The session could not be checked right now." }, { status: 503, headers: noStore });
  }
}
