import { NextResponse } from "next/server";
import { collection } from "@/lib/db/client";
import { getAdminSession } from "@/lib/wp-admin";

/* Reader analytics are for administrators only (docs/analytics-plan.md).
   The role is read from the users collection, not the session cookie: a
   session made before a demotion must not keep the access, and WordPress-mode
   sessions carry no role at all. Remembered for a minute per user. */

const roles = new Map<string, { administrator: boolean; at: number }>();
const ROLE_TTL_MS = 60_000;

async function isAdministrator(session: { userId: number; username: string }): Promise<boolean> {
  const key = `${session.userId}:${session.username}`;
  const hit = roles.get(key);
  if (hit && Date.now() - hit.at < ROLE_TTL_MS) return hit.administrator;
  const users = await collection("users");
  const user = session.userId ? await users.findOne({ _id: session.userId }) : await users.findOne({ username: session.username });
  const administrator = Boolean(user && user.is_active && (user.role === "administrator" || user.roles?.includes("administrator")));
  if (roles.size > 100) roles.clear();
  roles.set(key, { administrator, at: Date.now() });
  return administrator;
}

/** Null when the request may see analytics, otherwise the response to send instead. */
export async function analyticsAccessDenied(): Promise<Response | null> {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ error: "Admin authentication required" }, { status: 401 });
  try {
    if (!(await isAdministrator(session))) return NextResponse.json({ error: "Reader analytics are available to administrators only." }, { status: 403 });
  } catch {
    return NextResponse.json({ error: "Analytics are unavailable: the database could not be reached." }, { status: 503 });
  }
  return null;
}

/** For the Overview, which editors also open: whether to include reader numbers. */
export async function canSeeAnalytics(): Promise<boolean> {
  return (await analyticsAccessDenied()) === null;
}

export const noStore = { "Cache-Control": "private, no-store" };

/** A failed report: logged here, a plain message for the browser (never a driver error). */
export function reportFailed(what: string, error: unknown): Response {
  console.error(`[analytics] ${what} failed:`, error instanceof Error ? error.message : error);
  return NextResponse.json({ error: `Could not load ${what}. Try again in a moment.` }, { status: 502, headers: noStore });
}
