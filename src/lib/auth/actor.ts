import { NextResponse } from "next/server";
import { DATA_SOURCE } from "@/lib/env";
import { collection } from "@/lib/db/client";
import { getAdminSession } from "@/lib/wp-admin";
import type { StaffRef, UserDoc } from "@/lib/db/types";

/* Who is signed in to the admin, read from the users collection on every call
   rather than from the session cookie, so a demotion or deactivation takes
   effect on the next request instead of when the cookie expires. */

export type StaffRole = "administrator" | "editor";

export interface AdminActor extends StaffRef {
  username: string;
  role: StaffRole;
}

/** The staff role a user document grants, or null for authors and inactive accounts. */
export function staffRole(user: Pick<UserDoc, "role" | "roles" | "is_active"> | null | undefined): StaffRole | null {
  if (!user || !user.is_active) return null;
  if (user.role === "administrator" || user.roles?.includes("administrator")) return "administrator";
  if (user.role === "editor" || user.roles?.includes("editor")) return "editor";
  return null;
}

export async function getAdminActor(): Promise<AdminActor | null> {
  const session = await getAdminSession();
  if (!session) return null;
  if (DATA_SOURCE !== "mongo") {
    // WordPress decides permissions there; the session carries no role
    return { id: session.userId, name: session.username, username: session.username, role: "editor" };
  }
  const user = await (await collection("users")).findOne({ _id: session.userId });
  const role = staffRole(user);
  if (!user || !role) return null;
  return { id: user._id, name: user.name || user.username || "", username: user.username ?? "", role };
}

/** The signed-in administrator, or the 401/403/501 response to send instead. */
export async function requireAdministrator(): Promise<AdminActor | Response> {
  if (DATA_SOURCE !== "mongo") return NextResponse.json({ error: "This screen needs the MongoDB backend." }, { status: 501 });
  let actor: AdminActor | null;
  try {
    actor = await getAdminActor();
  } catch {
    return NextResponse.json({ error: "The database could not be reached. Try again shortly." }, { status: 503 });
  }
  if (!actor) return NextResponse.json({ error: "Admin authentication required" }, { status: 401 });
  if (actor.role !== "administrator") return NextResponse.json({ error: "Only administrators can do this." }, { status: 403 });
  return actor;
}

export const privateNoStore = { "Cache-Control": "private, no-store" };
