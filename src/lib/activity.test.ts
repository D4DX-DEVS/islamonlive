import { describe, beforeAll, it, expect } from "vitest";
import { seedFixtures } from "@/test/fixtures";
import { adminRest } from "@/lib/admin-rest";
import { collection } from "@/lib/db/client";
import { listActivity } from "@/lib/activity";

const EDITOR = { id: 2, username: "editor", role: "editor", name: "Desk Editor" };
const ADMIN = { id: 1, username: "admin", role: "administrator", name: "Chief" };

describe("who did what", () => {
  beforeAll(async () => {
    await seedFixtures();
  });

  it("stamps the creating and saving staff account on a post and logs each step", async () => {
    const created = await adminRest("/wp/v2/posts", { method: "POST", body: JSON.stringify({ title: "Audit me", content: "<p>x</p>", status: "draft" }) }, EDITOR);
    expect(created.status).toBe(201);
    const post = (await created.json()) as { id: number; created_by: number; updated_by: number };
    expect(post.created_by).toBe(2);
    expect(post.updated_by).toBe(2);

    const published = await adminRest(`/wp/v2/posts/${post.id}`, { method: "POST", body: JSON.stringify({ status: "publish" }) }, ADMIN);
    expect(published.status).toBe(200);
    const doc = await (await collection("posts")).findOne({ _id: post.id });
    expect(doc?.created_by).toBe(2);
    expect(doc?.updated_by).toBe(1);

    await adminRest(`/wp/v2/posts/${post.id}`, { method: "DELETE" }, ADMIN);
    const { items } = await listActivity({ page: 1, perPage: 10 });
    const mine = items.filter((entry) => entry.target.id === post.id).map((entry) => [entry.action, entry.actor.name]);
    expect(mine).toEqual([["post.trash", "Chief"], ["post.publish", "Chief"], ["post.create", "Desk Editor"]]);
  });

  it("filters the log by person and by kind", async () => {
    const byEditor = await listActivity({ actorId: 2, page: 1, perPage: 50 });
    expect(byEditor.items.every((entry) => entry.actor.id === 2)).toBe(true);
    const posts = await listActivity({ action: "post", page: 1, perPage: 50 });
    expect(posts.items.length).toBeGreaterThan(0);
    expect(posts.items.every((entry) => entry.action.startsWith("post."))).toBe(true);
  });
});
