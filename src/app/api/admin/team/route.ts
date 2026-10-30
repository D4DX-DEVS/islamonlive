import { NextResponse } from "next/server";
import { requireAdministrator, staffRole, privateNoStore } from "@/lib/auth/actor";
import { recordActivity } from "@/lib/activity";
import { hashPassword } from "@/lib/auth/password";
import { passwordProblem } from "@/lib/auth/password-policy";
import { reissueAdminSession } from "@/lib/wp-admin";
import { collection } from "@/lib/db/client";
import { nextId } from "@/lib/admin-rest/ids";
import { escapeRegex } from "@/lib/admin-rest/http";
import { sanitizeTitle, uniqueSlug } from "@/lib/admin-rest/slug";
import { invalidateAdminTaxonomyCache } from "@/lib/admin-taxonomy-cache";
import { SITE_URL } from "@/lib/env";
import type { UserDoc } from "@/lib/db/types";

export const dynamic = "force-dynamic";

/* Staff accounts: the administrators and editors who can sign in to the admin.
   Administrators only. Authors (bylines) stay on the Authors screen. */

const ROLES = ["editor", "administrator"] as const;
type Role = (typeof ROLES)[number];
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const USERNAME = /^[A-Za-z0-9._@-]{3,60}$/;
const STAFF_FILTER = { $or: [{ role: { $in: [...ROLES] } }, { roles: { $in: [...ROLES] } }] };

interface StaffMember {
  id: number;
  name: string;
  username: string;
  email: string | null;
  role: Role;
  active: boolean;
  registered: string | null;
  posts: number;
  lastActive: string | null;
}

function bad(error: string, status = 400): Response {
  return NextResponse.json({ error }, { status, headers: privateNoStore });
}

function roleOf(user: UserDoc): Role {
  return user.role === "administrator" || user.roles?.includes("administrator") ? "administrator" : "editor";
}

async function activeAdministrators(exceptId: number): Promise<number> {
  return (await collection("users")).countDocuments({ _id: { $ne: exceptId }, is_active: true, $or: [{ role: "administrator" }, { roles: "administrator" }] });
}

const exactly = (value: string) => ({ $regex: `^${escapeRegex(value)}$`, $options: "i" });

/** Sign-in accepts a username or an email address, so neither may equal another account's username or email. */
async function signInClash({ username, email }: { username?: string; email?: string }, exceptId?: number): Promise<string | null> {
  const names = [username, email].filter((n): n is string => Boolean(n));
  if (!names.length) return null;
  const clash = await (await collection("users")).findOne(
    { ...(exceptId ? { _id: { $ne: exceptId } } : {}), $or: names.flatMap((n) => [{ username: exactly(n) }, { email: exactly(n) }]) },
    { projection: { username: 1, email: 1 } },
  );
  if (!clash) return null;
  const taken = [clash.username, clash.email].map((v) => v?.toLowerCase());
  return username && taken.includes(username.toLowerCase()) ? "That username is already taken." : "That email address already has an account.";
}

export async function GET() {
  const actor = await requireAdministrator();
  if (actor instanceof Response) return actor;
  try {
    const users = await (await collection("users")).find(STAFF_FILTER, { projection: { password_hash: 0, seo: 0 } }).sort({ is_active: -1, name: 1 }).limit(500).toArray();
    const ids = users.map((u) => u._id);
    const [posts, last] = await Promise.all([
      // bylines (every migrated article) plus articles the account entered for someone else; a post counts once per account
      (await collection("posts")).aggregate<{ _id: number; n: number }>([
        { $match: { $or: [{ author_id: { $in: ids } }, { created_by: { $in: ids } }] } },
        { $project: { who: { $setUnion: [["$author_id"], [{ $ifNull: ["$created_by", "$author_id"] }]] } } },
        { $unwind: "$who" },
        { $match: { who: { $in: ids } } },
        { $group: { _id: "$who", n: { $sum: 1 } } },
      ]).toArray(),
      (await collection("admin_activity")).aggregate<{ _id: number; at: Date }>([{ $match: { "actor.id": { $in: ids } } }, { $group: { _id: "$actor.id", at: { $max: "$at" } } }]).toArray(),
    ]);
    const postCount = new Map(posts.map((p) => [p._id, p.n]));
    const lastSeen = new Map(last.map((l) => [l._id, l.at]));
    const items: StaffMember[] = users.map((u) => ({
      id: u._id,
      name: u.name,
      username: u.username ?? "",
      email: u.email,
      role: roleOf(u as UserDoc),
      active: u.is_active,
      registered: u.registered_at ? new Date(u.registered_at).toISOString() : null,
      posts: postCount.get(u._id) ?? 0,
      lastActive: lastSeen.get(u._id)?.toISOString() ?? null,
    }));
    return NextResponse.json({ items, me: actor.id }, { headers: privateNoStore });
  } catch (error) {
    console.error("[team] list failed:", error instanceof Error ? error.message : error);
    return bad("Could not load the team. Try again in a moment.", 502);
  }
}

type Body = Record<string, unknown>;
const str = (body: Body, key: string, max = 200) => (typeof body[key] === "string" ? (body[key] as string).trim().slice(0, max) : "");

/** Add a staff account: { name, username, email, password, role }. */
export async function POST(request: Request) {
  const actor = await requireAdministrator();
  if (actor instanceof Response) return actor;
  const body = (await request.json().catch(() => null)) as Body | null;
  if (!body) return bad("Send the account details as JSON.");
  const name = str(body, "name", 120);
  const username = str(body, "username", 60);
  const email = str(body, "email").toLowerCase();
  const password = typeof body.password === "string" ? body.password : "";
  const role = (ROLES as readonly string[]).includes(String(body.role)) ? (body.role as Role) : null;
  if (!name) return bad("Enter the person's name.");
  if (!USERNAME.test(username)) return bad("The username must be 3–60 letters, numbers, dots, dashes or underscores.");
  if (!EMAIL.test(email)) return bad("Enter a valid email address.");
  const weak = passwordProblem(password, { username, email });
  if (weak) return bad(weak);
  if (!role) return bad("Choose Editor or Administrator.");
  try {
    const users = await collection("users");
    const clash = await signInClash({ username, email });
    if (clash) return bad(clash, 409);
    const id = await nextId("user");
    const slug = await uniqueSlug(sanitizeTitle(username), async (candidate) => (await users.countDocuments({ slug: candidate }, { limit: 1 })) > 0);
    const doc: UserDoc = {
      _id: id, name, slug, description: "", link: `${SITE_URL}/author/${slug}/`, path: `/author/${slug}/`,
      avatar_url: null, avatars: {}, username, email, first_name: null, last_name: null, nickname: username, locale: "en_US",
      roles: [role], role, registered_at: new Date(), password_hash: await hashPassword(password), is_active: true, seo: null,
    };
    await users.insertOne(doc);
    invalidateAdminTaxonomyCache(`admin-taxonomy:${actor.username}:authors`);
    await recordActivity(actor, "user.create", { type: "user", id, title: `${name} (${role})`, link: null });
    return NextResponse.json({ id }, { status: 201, headers: privateNoStore });
  } catch (error) {
    console.error("[team] create failed:", error instanceof Error ? error.message : error);
    return bad("The account could not be created. Try again in a moment.", 502);
  }
}

/** Change an account: { id, name?, username?, email?, role?, active?, password? }. */
export async function PATCH(request: Request) {
  const actor = await requireAdministrator();
  if (actor instanceof Response) return actor;
  const body = (await request.json().catch(() => null)) as Body | null;
  const id = Number(body?.id);
  if (!body || !Number.isInteger(id) || id < 1) return bad("Choose an account to change.");
  try {
    const users = await collection("users");
    const user = await users.findOne({ _id: id });
    if (!user || !(staffRole({ ...user, is_active: true }))) return bad("That account is not a staff account.", 404);
    const update: Partial<UserDoc> = {};
    const changes: string[] = [];
    if ("name" in body) {
      const name = str(body, "name", 120);
      if (!name) return bad("Enter the person's name.");
      if (name !== user.name) { update.name = name; changes.push("name"); }
    }
    // the session is keyed by account id, so a new username takes effect without signing anyone out;
    // an unchanged legacy username (WordPress allowed spaces) is left alone
    if ("username" in body) {
      const username = str(body, "username", 60);
      if (username !== (user.username ?? "")) {
        if (!USERNAME.test(username)) return bad("The username must be 3–60 letters, numbers, dots, dashes or underscores.");
        const clash = await signInClash({ username }, id);
        if (clash) return bad(clash, 409);
        update.username = username; changes.push(user.username ? "username" : "username added");
      }
    }
    if ("email" in body) {
      const email = str(body, "email").toLowerCase();
      if (!EMAIL.test(email)) return bad("Enter a valid email address.");
      if (email !== user.email) {
        const clash = await signInClash({ email }, id);
        if (clash) return bad(clash, 409);
        update.email = email; changes.push("email");
      }
    }
    const currentRole = roleOf(user);
    const nextRole = "role" in body ? ((ROLES as readonly string[]).includes(String(body.role)) ? (body.role as Role) : null) : currentRole;
    if (!nextRole) return bad("Choose Editor or Administrator.");
    const nextActive = "active" in body ? body.active === true : user.is_active;
    // nobody locks themselves out, and the site always keeps one active administrator
    if (id === actor.id && (nextRole !== "administrator" || !nextActive)) return bad("You cannot remove your own administrator access. Ask another administrator.");
    if (currentRole === "administrator" && user.is_active && (nextRole !== "administrator" || !nextActive) && (await activeAdministrators(id)) === 0) return bad("This is the last active administrator. Make someone else an administrator first.");
    if (nextRole !== currentRole) { update.role = nextRole; update.roles = [nextRole]; changes.push(`role → ${nextRole}`); }
    if (nextActive !== user.is_active) { update.is_active = nextActive; changes.push(nextActive ? "reactivated" : "deactivated"); }
    if (typeof body.password === "string" && body.password) {
      const weak = passwordProblem(body.password, { username: update.username ?? user.username ?? "", email: update.email ?? user.email ?? "" });
      if (weak) return bad(weak);
      update.password_hash = await hashPassword(body.password);
      changes.push("password reset");
    }
    if (!changes.length) return NextResponse.json({ ok: true, changed: [] }, { headers: privateNoStore });
    const reset = Boolean(update.password_hash);
    // a reset also ends every session the old password opened ($inc, so a concurrent logout's bump is not lost)
    await users.updateOne({ _id: id }, reset ? { $set: update, $inc: { session_version: 1 } } : { $set: update });
    // ...except the one making the change, when it is your own password
    if (reset && id === actor.id) await reissueAdminSession();
    invalidateAdminTaxonomyCache(`admin-taxonomy:${actor.username}:authors`);
    await recordActivity(actor, "user.update", { type: "user", id, title: `${update.name ?? user.name}: ${changes.join(", ")}`, link: null });
    return NextResponse.json({ ok: true, changed: changes }, { headers: privateNoStore });
  } catch (error) {
    console.error("[team] update failed:", error instanceof Error ? error.message : error);
    return bad("The account could not be changed. Try again in a moment.", 502);
  }
}

/** Take an account off the team: { id }. An account that never wrote, entered,
    edited or uploaded anything is deleted outright. One that did is also a public
    author (bylines, the /author/ page, "last edited by"), so it stays as a plain
    author and only loses its staff role and password, which signs it out at once. */
export async function DELETE(request: Request) {
  const actor = await requireAdministrator();
  if (actor instanceof Response) return actor;
  const body = (await request.json().catch(() => null)) as Body | null;
  const id = Number(body?.id);
  if (!body || !Number.isInteger(id) || id < 1) return bad("Choose an account to delete.");
  if (id === actor.id) return bad("You cannot delete your own account. Ask another administrator.");
  try {
    const users = await collection("users");
    const user = await users.findOne({ _id: id });
    if (!user || !staffRole({ ...user, is_active: true })) return bad("That account is not a staff account.", 404);
    const role = roleOf(user);
    if (role === "administrator" && user.is_active && (await activeAdministrators(id)) === 0) return bad("This is the last active administrator. Make someone else an administrator first.");
    const [posts, pages, media] = await Promise.all([
      (await collection("posts")).countDocuments({ $or: [{ author_id: id }, { created_by: id }, { updated_by: id }] }, { limit: 1 }),
      (await collection("pages")).countDocuments({ author_id: id }, { limit: 1 }),
      (await collection("media")).countDocuments({ author_id: id }, { limit: 1 }),
    ]);
    const target = { type: "user" as const, id, title: `${user.name} (${role})`, link: null };
    let outcome: "deleted" | "removed";
    if (posts + pages + media === 0) {
      await users.deleteOne({ _id: id });
      outcome = "deleted";
      await recordActivity(actor, "user.delete", target);
    } else {
      await users.updateOne({ _id: id }, { $set: { role: "author", roles: ["author"], password_hash: null } });
      outcome = "removed";
      await recordActivity(actor, "user.remove", target);
    }
    invalidateAdminTaxonomyCache(`admin-taxonomy:${actor.username}:authors`);
    return NextResponse.json({ ok: true, outcome }, { headers: privateNoStore });
  } catch (error) {
    console.error("[team] delete failed:", error instanceof Error ? error.message : error);
    return bad("The account could not be deleted. Try again in a moment.", 502);
  }
}
