import { beforeEach, describe, expect, it, vi } from "vitest";
import { collection } from "@/lib/db/client";
import { verifyPassword } from "@/lib/auth/password";
import type { UserDoc } from "@/lib/db/types";

const session = vi.hoisted(() => ({ current: null as null | { username: string; userId: number; role: string; expiresAt: number } }));
vi.mock("@/lib/wp-admin", () => ({
  getAdminSession: async () => session.current,
  // the real one also checks is_active/role/session_version; staffRole in actor.ts re-checks the first two
  getAdminSessionUser: async () => session.current && { session: session.current, user: await (await collection("users")).findOne({ _id: session.current.userId }) },
}));
vi.mock("@/lib/env", async (original) => ({ ...(await original<typeof import("@/lib/env")>()), DATA_SOURCE: "mongo" }));
vi.mock("next/cache", () => ({ revalidateTag: () => undefined, revalidatePath: () => undefined, unstable_cache: (fn: unknown) => fn }));
vi.mock("@/lib/cloudflare", () => ({ purgePaths: async () => ({ ok: true }) }));

const team = await import("./route");
const layout = await import("../home-layout/route");

const as = (userId: number, username: string) => { session.current = { userId, username, role: "unknown", expiresAt: Date.now() + 3_600_000 }; };
const send = (method: string, body: unknown, path = "/api/admin/team") => new Request(`http://localhost${path}`, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });

describe("team and homepage routes", () => {
  beforeEach(async () => {
    session.current = null;
    const users = await collection("users");
    await users.deleteMany({ $or: [{ _id: { $in: [9101, 9102, 9103] } }, { username: { $in: ["new.editor"] } }] });
    await users.insertMany([
      { _id: 9101, name: "Boss", username: "boss2", email: "boss2@x.in", role: "administrator", roles: ["administrator"], is_active: true },
      { _id: 9102, name: "Writer", username: "writer2", email: "writer2@x.in", role: "editor", roles: ["editor"], is_active: true },
      { _id: 9103, name: "Old Desk", username: null, email: "desk@x.in", role: "editor", roles: ["editor"], is_active: true, password_hash: "x" },
    ] as unknown as UserDoc[]);
    await (await collection("posts")).deleteMany({ _id: 9201 });
    await (await collection("home_layout")).deleteMany({});
  });

  it("keeps editors and visitors out", async () => {
    expect((await team.GET()).status).toBe(401);
    as(9102, "writer2");
    expect((await team.GET()).status).toBe(403);
    expect((await team.POST(send("POST", {}))).status).toBe(403);
    expect((await layout.PUT(send("PUT", { sections: [] }, "/api/admin/home-layout"))).status).toBe(403);
  });

  it("lets an administrator add an editor who can then sign in", async () => {
    as(9101, "boss2");
    const response = await team.POST(send("POST", { name: "New Editor", username: "new.editor", email: "NEW@x.in", password: "long-enough-pass1", role: "editor" }));
    expect(response.status).toBe(201);
    const user = await (await collection("users")).findOne({ username: "new.editor" });
    expect(user).toMatchObject({ role: "editor", roles: ["editor"], email: "new@x.in", is_active: true });
    expect(await verifyPassword("long-enough-pass1", user!.password_hash!)).toBe(true);
    expect((await team.POST(send("POST", { name: "Dup", username: "NEW.EDITOR", email: "z@x.in", password: "long-enough-pass1", role: "editor" }))).status).toBe(409);
    expect((await team.POST(send("POST", { name: "Short", username: "short1", email: "s@x.in", password: "123", role: "editor" }))).status).toBe(400);
  });

  it("will not let an administrator lock themselves out", async () => {
    as(9101, "boss2");
    expect((await team.PATCH(send("PATCH", { id: 9101, role: "editor" }))).status).toBe(400);
    expect((await team.PATCH(send("PATCH", { id: 9101, active: false }))).status).toBe(400);
    const demote = await team.PATCH(send("PATCH", { id: 9102, active: false }));
    expect(demote.status).toBe(200);
    expect((await (await collection("users")).findOne({ _id: 9102 }))?.is_active).toBe(false);
  });

  it("lets an administrator give a username to an account that had none, without clashing with any sign-in name", async () => {
    as(9101, "boss2");
    // another account's email or username is a sign-in name too
    expect((await team.PATCH(send("PATCH", { id: 9103, username: "writer2@x.in" }))).status).toBe(409);
    expect((await team.PATCH(send("PATCH", { id: 9103, username: "WRITER2" }))).status).toBe(409);
    expect((await team.PATCH(send("PATCH", { id: 9103, username: "a b" }))).status).toBe(400);
    const added = await team.PATCH(send("PATCH", { id: 9103, username: "desk.ed" }));
    expect(await added.json()).toMatchObject({ changed: ["username added"] });
    expect((await (await collection("users")).findOne({ _id: 9103 }))?.username).toBe("desk.ed");
    expect((await team.POST(send("POST", { name: "Dup", username: "desk@x.in", email: "other@x.in", password: "long-enough-pass1", role: "editor" }))).status).toBe(409);
    expect(await (await team.PATCH(send("PATCH", { id: 9102, username: "writer2", name: "Writer" }))).json()).toMatchObject({ changed: [] });
  });

  it("deletes an account with no articles, but keeps an author's profile and only takes the sign-in away", async () => {
    as(9101, "boss2");
    expect((await team.DELETE(send("DELETE", { id: 9101 }))).status).toBe(400);
    await (await collection("posts")).insertOne({ _id: 9201, author_id: 9102, title: "x" } as never);
    const removed = await team.DELETE(send("DELETE", { id: 9102 }));
    expect(await removed.json()).toMatchObject({ outcome: "removed" });
    expect(await (await collection("users")).findOne({ _id: 9102 })).toMatchObject({ role: "author", roles: ["author"], password_hash: null });
    // no longer staff: the list drops it and a second delete is refused
    expect((await (await team.GET()).json()).items.map((m: { id: number }) => m.id)).not.toContain(9102);
    expect((await team.DELETE(send("DELETE", { id: 9102 }))).status).toBe(404);
    const deleted = await team.DELETE(send("DELETE", { id: 9103 }));
    expect(await deleted.json()).toMatchObject({ outcome: "deleted" });
    expect(await (await collection("users")).findOne({ _id: 9103 })).toBeNull();
    // editors cannot delete anyone
    await (await collection("users")).insertOne({ _id: 9103, name: "Old Desk", username: null, email: "desk@x.in", role: "editor", roles: ["editor"], is_active: true } as unknown as UserDoc);
    as(9103, "");
    expect((await team.DELETE(send("DELETE", { id: 9101 }))).status).toBe(403);
  });

  it("publishes a sanitized layout and keeps the previous one in history", async () => {
    as(9101, "boss2");
    const first = await layout.PUT(send("PUT", { sections: [{ kind: "banners", id: "b1" }, { kind: "evil" }] }, "/api/admin/home-layout"));
    expect(first.status).toBe(200);
    const state = await first.json();
    expect(state.sections).toEqual([{ id: "b1", kind: "banners", enabled: true, placement: "full", visibility: "all", look: { background: "", bgColor: "", accent: "", hide: [] }, showFrom: "", showUntil: "", items: [] }]);
    expect(state.updatedBy).toMatchObject({ id: 9101, name: "Boss" });
    expect(state.history).toHaveLength(1);
    const restored = await layout.POST(send("POST", { restore: 0 }, "/api/admin/home-layout"));
    const after = await restored.json();
    expect(after.sections.length).toBeGreaterThan(5);
    expect(after.history).toHaveLength(2);
  });
});
