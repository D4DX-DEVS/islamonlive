import { NextResponse } from "next/server";
import { revokeAdminSessions, sessionCookieName } from "@/lib/wp-admin";
import { recordActivity } from "@/lib/activity";

export const dynamic = "force-dynamic";

export async function POST() {
  /* Clearing the cookie only helps the browser that asked. Bumping the account's
     session_version also ends a copy of the cookie taken elsewhere (another
     device, a shared machine, a stolen value), since every request re-checks it. */
  try {
    const user = await revokeAdminSessions();
    if (user) await recordActivity({ id: user._id, name: user.name || user.username || "", role: user.role }, "auth.logout", { type: "user", id: user._id, title: user.name || user.username || "", link: null });
  } catch (error) {
    console.error("[admin] logout could not revoke the session:", error instanceof Error ? error.message : error);
  }
  const response = NextResponse.json({ ok: true });
  const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
  const expired = `${sessionCookieName()}=; Expires=Thu, 01 Jan 1970 00:00:00 GMT; Max-Age=0; HttpOnly; SameSite=Lax${secure}`;
  response.headers.append("Set-Cookie", `${expired}; Path=/`);
  response.headers.append("Set-Cookie", `${expired}; Path=/admin`);
  return response;
}
