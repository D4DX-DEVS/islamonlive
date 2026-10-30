import { beforeEach, describe, expect, it, vi } from "vitest";
import { collection } from "@/lib/db/client";
import type { UserDoc } from "@/lib/db/types";

const session = vi.hoisted(() => ({ current: null as null | { username: string; userId: number; role: string; expiresAt: number } }));
vi.mock("@/lib/wp-admin", () => ({
  getAdminSession: async () => session.current,
  // the real one also checks is_active/role/session_version; staffRole in actor.ts re-checks the first two
  getAdminSessionUser: async () => session.current && { session: session.current, user: await (await collection("users")).findOne({ _id: session.current.userId }) },
}));
vi.mock("@/lib/wp-lookup", () => ({
  getArticleMeta: async (ids: number[]) => new Map(ids.map((id) => [id, { title: `Article ${id}`, path: `/x/a-${id}/`, date: null, categories: [], featuredMedia: 0 }])),
  getCategoryNames: async () => new Map(),
  getThumbnails: async () => new Map(),
}));

const { GET: summaryGET } = await import("./summary/route");
const { GET: articlesGET } = await import("./articles/route");
const { GET: articleGET } = await import("./articles/[id]/route");
const { GET: listGET } = await import("./list/route");
const { GET: liveGET } = await import("./live/route");
const { POST: collect } = await import("../../analytics/collect/route");
const { DELETE: dataDELETE } = await import("./data/route");

const as = (userId: number, username: string) => { session.current = { userId, username, role: "unknown", expiresAt: Date.now() + 3_600_000 }; };
const get = (path: string) => new Request(`http://localhost${path}`);
const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36";

describe("admin analytics routes", () => {
  beforeEach(async () => {
    session.current = null;
    const users = await collection("users");
    await users.deleteMany({ _id: { $in: [9001, 9002, 9003] } });
     
    await users.insertMany([
      { _id: 9001, username: "boss", role: "administrator", roles: ["administrator"], is_active: true },
      { _id: 9002, username: "writer", role: "editor", roles: ["editor"], is_active: true },
      { _id: 9003, username: "gone", role: "administrator", roles: ["administrator"], is_active: false },
    ] as unknown as UserDoc[]);
  });

  it("refuses signed-out visitors, editors and disabled accounts", async () => {
    expect((await summaryGET(get("/api/admin/analytics/summary"))).status).toBe(401);
    as(9002, "writer");
    expect((await summaryGET(get("/api/admin/analytics/summary"))).status).toBe(403);
    expect((await liveGET()).status).toBe(403);
    as(9003, "gone");
    expect((await articlesGET(get("/api/admin/analytics/articles"))).status).toBe(403);
    expect((await listGET(get("/api/admin/analytics/list?list=byTime"))).status).toBe(403);
  });

  it("lets only administrators delete all reader data", async () => {
    const views = await collection("analytics_views");
    await views.insertOne({ _id: "view-to-delete-000001", v: "v", s: "s", t: new Date(), ls: new Date(), day: "2026-10-29", k: "home", p: "/", dev: "mobile", src: "direct", nv: true, en: true, e: 1, sd: 0 });
    expect((await dataDELETE()).status).toBe(401);
    as(9002, "writer");
    expect((await dataDELETE()).status).toBe(403);
    expect(await views.countDocuments({ _id: "view-to-delete-000001" })).toBe(1);
    as(9001, "boss");
    const res = await dataDELETE();
    expect(res.status).toBe(200);
    expect((await res.json()).deleted.views).toBeGreaterThanOrEqual(1);
    expect(await views.countDocuments()).toBe(0);
    expect(await (await collection("admin_activity")).findOne({ action: "analytics.delete", "actor.id": 9001 })).not.toBeNull();
  });

  it("looks a WordPress-mode session (no user id) up by username", async () => {
    as(0, "boss");
    expect((await liveGET()).status).toBe(200);
  });

  it("answers administrators, privately", async () => {
    as(9001, "boss");
    const res = await summaryGET(get("/api/admin/analytics/summary?range=7"));
    expect(res.status).toBe(200);
    expect(res.headers.get("cache-control")).toContain("no-store");
    const body = await res.json();
    expect(body).toHaveProperty("totals.views");
    expect(body.series).toHaveLength(7);
  });

  it("refuses filters, sorts and sizes it does not know", async () => {
    as(9001, "boss");
    expect((await summaryGET(get("/api/admin/analytics/summary?range=forever"))).status).toBe(400);
    expect((await summaryGET(get("/api/admin/analytics/summary?device=fridge"))).status).toBe(400);
    expect((await articlesGET(get("/api/admin/analytics/articles?sort=password"))).status).toBe(400);
    expect((await articlesGET(get("/api/admin/analytics/articles?pageSize=5000"))).status).toBe(400);
    expect((await articleGET(get("/api/admin/analytics/articles/abc"), { params: Promise.resolve({ id: "abc" }) })).status).toBe(400);
    expect((await articlesGET(get("/api/admin/analytics/articles?sort=avgSeconds&order=asc&pageSize=50"))).status).toBe(200);
    expect((await listGET(get("/api/admin/analytics/list?list=passwords"))).status).toBe(400);
    expect((await listGET(get("/api/admin/analytics/list?list=byTime&page=0"))).status).toBe(400);
    const page = await listGET(get("/api/admin/analytics/list?list=byTime&page=2&range=7"));
    expect(page.status).toBe(200);
    expect(await page.json()).toMatchObject({ pageSize: 5, data: expect.any(Array) });
  });
});

describe("POST /api/analytics/collect", () => {
  const beacon = { id: "view-route-000001", v: "visitor-route-01", s: "session-route-1", ev: "start", k: "article", p: "/x/a-1/", a: 1, c: [], e: 0, sd: 0 };
  const post = (body: unknown, headers: Record<string, string> = {}) => collect(new Request("http://localhost/api/analytics/collect", { method: "POST", body: typeof body === "string" ? body : JSON.stringify(body), headers: { "user-agent": UA, "content-type": "text/plain", "x-forwarded-for": `10.0.0.${Math.floor(Math.random() * 250)}`, ...headers } }));
  const stored = async () => (await collection("analytics_views")).findOne({ _id: beacon.id });

  beforeEach(async () => {
    await (await collection("analytics_views")).deleteMany({});
  });

  it("stores a reader's view and answers 204", async () => {
    expect((await post(beacon)).status).toBe(204);
    expect(await stored()).toMatchObject({ k: "article", a: 1, dev: "desktop", src: "direct" });
  });

  it("drops bots, automated browsers and signed-in staff quietly", async () => {
    expect((await post(beacon, { "user-agent": "Googlebot/2.1 (+http://www.google.com/bot.html)" })).status).toBe(204);
    expect((await post({ ...beacon, wd: true })).status).toBe(204);
    expect((await post(beacon, { cookie: "theme=dark; iol_admin_session_v2=abc" })).status).toBe(204);
    expect(await stored()).toBeNull();
  });

  it("refuses malformed and oversized beacons", async () => {
    expect((await post("not json")).status).toBe(400);
    expect((await post({ ...beacon, k: "admin" })).status).toBe(400);
    expect((await post("x".repeat(5_000))).status).toBe(413);
  });
});
