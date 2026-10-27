import { beforeAll, describe, expect, it } from "vitest";
import { generatePermalink, permalinkCategory } from "@/lib/admin-rest/posts-permalink";
import type { PostDoc } from "@/lib/db/types";
import { loadFixture, seedFixtures } from "@/test/fixtures";

const posts = loadFixture("posts").filter((p) => p.status === "publish") as PostDoc[];
const categories = loadFixture("categories");

describe("permalinks", () => {
  beforeAll(async () => {
    await seedFixtures();
  });

  it("rebuilds WordPress's path from the categories alone for posts with no picked primary", async () => {
    // Yoast names the primary category in the description only when an editor picked one
    const unpicked = posts.filter((p) => p.seo?.description?.endsWith(" |"));
    let hits = 0;
    for (const p of unpicked) if ((await generatePermalink(p._id, p.slug, p.categories)).path === p.path) hits++;
    expect(unpicked.length).toBeGreaterThan(20);
    expect(hits / unpicked.length).toBeGreaterThanOrEqual(0.95);
  });

  it("uses the lowest term_id, with its parents in front", async () => {
    const child = categories.find((c) => c.parent_id > 0 && categories.some((p) => p._id === c.parent_id && p.parent_id === 0))!;
    const parent = categories.find((c) => c._id === child.parent_id)!;
    const higher = Math.max(...categories.map((c) => c._id)) + 1;
    const { path, primaryCategoryId } = await generatePermalink(1, "new-post", [higher, child._id]);
    expect(path).toBe(`/${parent.slug}/${child.slug}/new-post/`);
    expect(primaryCategoryId).toBe(child._id);
  });

  it("follows a primary category an editor picked, but only one the post is in", () => {
    expect(permalinkCategory([30, 7], 30)).toBe(30);
    expect(permalinkCategory([30, 7], 99)).toBe(7);
    expect(permalinkCategory([], null)).toBeNull();
  });

  it("never moves a published URL when categories change", async () => {
    const p = posts.find((x) => x.path.split("/").filter(Boolean).length >= 3)!;
    const other = categories.find((c) => !p.path.includes(`/${c.slug}/`))!;
    const { path } = await generatePermalink(p._id, p.slug, [other._id], p.path);
    expect(path).toBe(p.path);
  });

  it("swaps only the last segment when the slug changes", async () => {
    const p = posts.find((x) => x.path.split("/").filter(Boolean).length >= 3)!;
    const { path, link } = await generatePermalink(p._id, "renamed", p.categories, p.path);
    expect(path).toBe(p.path.replace(/[^/]+\/$/, "renamed/"));
    expect(link.endsWith(path)).toBe(true);
  });

  it("builds a fresh path for a draft WordPress only knew as ?p=", async () => {
    const cat = categories.find((c) => c.parent_id === 0)!;
    expect((await generatePermalink(5, "draft-post", [cat._id], "/")).path).toBe(`/${cat.slug}/draft-post/`);
    expect((await generatePermalink(5, "", [cat._id])).path).toBe("/?p=5");
  });
});
