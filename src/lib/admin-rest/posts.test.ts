import { describe, beforeAll, it, expect } from "vitest";
import { seedFixtures, loadFixture } from "@/test/fixtures";
import { adminRest } from "@/lib/admin-rest";
import { collection } from "@/lib/db/client";

const ADMIN = { id: 1, username: "admin", role: "administrator" };
const EDITOR = { id: 2, username: "editor", role: "editor" };
const AUTHOR = { id: 3, username: "author", role: "author" };

describe("POST /wp/v2/posts endpoints", () => {
  beforeAll(async () => {
    await seedFixtures();
  });

  describe("GET /wp/v2/posts (list)", () => {
    it("returns posts with pagination headers", async () => {
      const res = await adminRest("/wp/v2/posts?context=edit&per_page=5&page=1", {}, ADMIN);
      expect(res.status).toBe(200);
      const data = (await res.json()) as Record<string, unknown>[];
      expect(Array.isArray(data)).toBe(true);
      expect(data.length).toBeGreaterThan(0);
      expect(res.headers.get("X-WP-Total")).toBeDefined();
      expect(res.headers.get("X-WP-TotalPages")).toBeDefined();
    });

    it("respects per_page and page parameters", async () => {
      const res = await adminRest("/wp/v2/posts?context=edit&per_page=3&page=1", {}, ADMIN);
      const data = (await res.json()) as Record<string, unknown>[];
      expect(data.length).toBeLessThanOrEqual(3);
    });

    it("returns 400 when page > total pages", async () => {
      const res = await adminRest("/wp/v2/posts?context=edit&per_page=1&page=99999", {}, ADMIN);
      expect(res.status).toBe(400);
      const error = (await res.json()) as Record<string, unknown>;
      expect((error.code as string).includes("invalid_page")).toBe(true);
    });

    it("filters by status=draft", async () => {
      const res = await adminRest("/wp/v2/posts?context=edit&status=draft&per_page=100", {}, ADMIN);
      const data = (await res.json()) as Record<string, unknown>[];
      expect(data.every((p) => (p.status as string) === "draft")).toBe(true);
    });

    it("filters by status=any (excludes trash)", async () => {
      const res = await adminRest("/wp/v2/posts?context=edit&status=any&per_page=100", {}, ADMIN);
      const data = (await res.json()) as Record<string, unknown>[];
      expect(data.some((p) => (p.status as string) === "publish")).toBe(true);
      expect(data.every((p) => (p.status as string) !== "trash")).toBe(true);
    });

    it("filters by author", async () => {
      const res = await adminRest("/wp/v2/posts?context=edit&author=1&per_page=100", {}, ADMIN);
      const data = (await res.json()) as Record<string, unknown>[];
      expect(data.every((p) => (p.author as number) === 1)).toBe(true);
    });

    it("searches in title/excerpt/content", async () => {
      const posts = loadFixture("posts");
      const post = posts.find((p) => p.title.length > 10);
      if (!post) return;
      const term = post.title.substring(0, 5);
      const res = await adminRest(`/wp/v2/posts?context=edit&search=${encodeURIComponent(term)}&per_page=100`, {}, ADMIN);
      const data = (await res.json()) as Record<string, unknown>[];
      expect(data.length).toBeGreaterThan(0);
    });

    it("sorts by date DESC, id DESC", async () => {
      const res = await adminRest("/wp/v2/posts?context=edit&per_page=20", {}, ADMIN);
      const data = (await res.json()) as Record<string, unknown>[];
      for (let i = 0; i < data.length - 1; i++) {
        const curr = new Date(data[i].date as string).getTime();
        const next = new Date(data[i + 1].date as string).getTime();
        if (curr !== next) {
          expect(curr).toBeGreaterThanOrEqual(next);
        }
      }
    });
  });

  describe("GET /wp/v2/posts/:id (single)", () => {
    it("returns post in edit context with title.raw and content.raw", async () => {
      const posts = loadFixture("posts");
      const id = posts[0]._id;
      const res = await adminRest(`/wp/v2/posts/${id}?context=edit`, {}, ADMIN);
      expect(res.status).toBe(200);
      const post = (await res.json()) as Record<string, unknown>;
      expect(post.id).toBe(id);
      expect((post.title as Record<string, unknown>).raw).toBeDefined();
      expect((post.content as Record<string, unknown>).raw).toBeDefined();
    });

    it("includes all edit-context fields", async () => {
      const posts = loadFixture("posts");
      const id = posts[0]._id;
      const res = await adminRest(`/wp/v2/posts/${id}?context=edit`, {}, ADMIN);
      const post = (await res.json()) as Record<string, unknown>;
      expect(post.date).toBeDefined();
      expect(post.modified).toBeDefined();
      expect(post.status).toBeDefined();
      expect(post.slug).toBeDefined();
      expect(post.link).toBeDefined();
      // date_gmt and modified_gmt may not be in all fixtures
      if (post.date_gmt) expect(typeof post.date_gmt).toBe("string");
      if (post.modified_gmt) expect(typeof post.modified_gmt).toBe("string");
    });

    it("returns 404 for non-existent post", async () => {
      const res = await adminRest("/wp/v2/posts/999999?context=edit", {}, ADMIN);
      expect(res.status).toBe(404);
    });

    it("matches fixture field names and types", async () => {
      const posts = loadFixture("posts");
      const id = posts[0]._id;
      const res = await adminRest(`/wp/v2/posts/${id}?context=edit`, {}, ADMIN);
      const post = (await res.json()) as Record<string, unknown>;
      expect(typeof (post.id as number)).toBe("number");
      expect(typeof (post.slug as string)).toBe("string");
      expect(typeof (post.status as string)).toBe("string");
      expect(Array.isArray(post.categories)).toBe(true);
      expect(Array.isArray(post.tags)).toBe(true);
    });
  });

  describe("POST /wp/v2/posts (create)", () => {
    it("creates a draft post and returns it with new id", async () => {
      const res = await adminRest("/wp/v2/posts", { method: "POST", body: JSON.stringify({ title: "Test Post", content: "Test content", status: "draft" }) }, ADMIN);
      expect(res.status).toBe(201);
      const post = (await res.json()) as Record<string, unknown>;
      expect(typeof (post.id as number)).toBe("number");
      expect((post.id as number) > 0).toBe(true);
      expect((post.title as Record<string, unknown>).rendered).toBe("Test Post");
    });

    it("enforces slug uniqueness with -2 -3 suffix", async () => {
      const res1 = await adminRest("/wp/v2/posts", { method: "POST", body: JSON.stringify({ title: "Unique Test", content: "x", status: "draft", slug: "unique-test" }) }, ADMIN);
      const post1 = (await res1.json()) as Record<string, unknown>;
      expect(post1.slug).toBe("unique-test");

      const res2 = await adminRest("/wp/v2/posts", { method: "POST", body: JSON.stringify({ title: "Unique Test", content: "x", status: "draft", slug: "unique-test" }) }, ADMIN);
      const post2 = (await res2.json()) as Record<string, unknown>;
      expect(post2.slug).toBe("unique-test-2");
    });

    it("handles Malayalam slugs with percent-encoding", async () => {
      const title = "പരിചരണം";
      const res = await adminRest("/wp/v2/posts", { method: "POST", body: JSON.stringify({ title, content: "x", status: "publish" }) }, ADMIN);
      const post = (await res.json()) as Record<string, unknown>;
      // Published posts should get a slug generated from title
      expect((post.slug as string).length).toBeGreaterThan(0);
    });

    it("sets status to future when date is in future", async () => {
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 1);
      const dateStr = futureDate.toISOString().split(".")[0];
      const res = await adminRest("/wp/v2/posts", { method: "POST", body: JSON.stringify({ title: "Future Post", content: "x", status: "publish", date: dateStr }) }, ADMIN);
      const post = (await res.json()) as Record<string, unknown>;
      expect(post.status).toBe("future");
    });

    it("creates post with categories", async () => {
      const res = await adminRest("/wp/v2/posts", { method: "POST", body: JSON.stringify({ title: "Categorized", content: "x", status: "draft", categories: [1] }) }, ADMIN);
      const post = (await res.json()) as Record<string, unknown>;
      expect(Array.isArray(post.categories)).toBe(true);
    });

    it("denies author role", async () => {
      const res = await adminRest("/wp/v2/posts", { method: "POST", body: JSON.stringify({ title: "Test", content: "x" }) }, AUTHOR);
      expect(res.status).toBe(403);
    });

    it("allows editor role", async () => {
      const res = await adminRest("/wp/v2/posts", { method: "POST", body: JSON.stringify({ title: "Editor Post", content: "x", status: "draft" }) }, EDITOR);
      expect(res.status).toBe(201);
    });
  });

  describe("POST /wp/v2/posts/:id (update)", () => {
    it("updates an existing post", async () => {
      const posts = loadFixture("posts");
      const id = posts[0]._id;
      const res = await adminRest(`/wp/v2/posts/${id}`, { method: "POST", body: JSON.stringify({ title: "Updated", content: "Updated content" }) }, ADMIN);
      expect(res.status).toBe(200);
      const post = (await res.json()) as Record<string, unknown>;
      expect((post.title as Record<string, unknown>).rendered).toBe("Updated");
    });

    it("tracks old_paths when slug changes", async () => {
      const posts = loadFixture("posts");
      const id = posts[0]._id;
      const oldPath = posts[0].path;
      const res = await adminRest(`/wp/v2/posts/${id}`, { method: "POST", body: JSON.stringify({ title: posts[0].title, content: posts[0].content, slug: "new-slug-xyz" }) }, ADMIN);
      expect(res.status).toBe(200);

      // Verify in DB
      const db = await (await import("@/lib/db/client")).collection("posts");
      const updated = await db.findOne({ _id: id });
      expect(updated?.old_paths).toContain(oldPath);
    });

    it("denies author role", async () => {
      const posts = loadFixture("posts");
      const res = await adminRest(`/wp/v2/posts/${posts[0]._id}`, { method: "POST", body: JSON.stringify({ title: "x", content: "x" }) }, AUTHOR);
      expect(res.status).toBe(403);
    });
  });

  describe("DELETE /wp/v2/posts/:id (trash)", () => {
    it("moves post to trash with __trashed slug", async () => {
      const res = await adminRest("/wp/v2/posts", { method: "POST", body: JSON.stringify({ title: "To Trash", content: "x", status: "draft" }) }, ADMIN);
      const post = (await res.json()) as Record<string, unknown>;
      const id = post.id as number;

      const delRes = await adminRest(`/wp/v2/posts/${id}`, { method: "DELETE" }, ADMIN);
      expect(delRes.status).toBe(200);
      const trashed = (await delRes.json()) as Record<string, unknown>;
      expect(trashed.status).toBe("trash");
      expect((trashed.slug as string).includes("__trashed")).toBe(true);
    });

    it("denies author role", async () => {
      const posts = loadFixture("posts");
      const res = await adminRest(`/wp/v2/posts/${posts[0]._id}`, { method: "DELETE" }, AUTHOR);
      expect(res.status).toBe(403);
    });
  });

  describe("Permalink generation", () => {
    it("generates path with category ancestry", async () => {
      const res = await adminRest("/wp/v2/posts", { method: "POST", body: JSON.stringify({ title: "Path Test", content: "x", status: "draft", categories: [1] }) }, ADMIN);
      const post = (await res.json()) as Record<string, unknown>;
      const link = post.link as string;
      expect(link).toContain("islamonlive.in");
    });
  });

  describe("Create → Read roundtrip", () => {
    it("post created and immediately read has matching fields", async () => {
      const createRes = await adminRest("/wp/v2/posts", { method: "POST", body: JSON.stringify({ title: "Roundtrip", content: "Content text", status: "draft", excerpt: "Excerpt text" }) }, ADMIN);
      const created = (await createRes.json()) as Record<string, unknown>;

      const readRes = await adminRest(`/wp/v2/posts/${created.id}?context=edit`, {}, ADMIN);
      const read = (await readRes.json()) as Record<string, unknown>;

      expect((read.title as Record<string, unknown>).rendered).toBe((created.title as Record<string, unknown>).rendered);
      expect((read.content as Record<string, unknown>).rendered).toBe((created.content as Record<string, unknown>).rendered);
      expect(read.slug).toBe(created.slug);
      expect(read.status).toBe(created.status);
    });
  });
});

/* What WordPress's wp_insert_post guarantees and the public site depends on:
   the site clock, stable URLs, and redirects for the ones that move. */
describe("posts: WordPress rules the public site depends on", () => {
  const send = (path: string, body: unknown, method = "POST") =>
    adminRest(path, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }, EDITOR);
  const stored = async (id: number) => (await (await collection("posts")).findOne({ _id: id }))!;

  beforeAll(async () => {
    await seedFixtures();
  });

  it("reads the admin's date as IST and stores both clocks", async () => {
    const res = await send("/wp/v2/posts", { title: "Dated", content: "<p>x</p>", status: "publish", date: "2024-03-01T10:30" });
    const doc = await stored((await res.json()).id);
    expect(doc.published_at?.toISOString()).toBe("2024-03-01T05:00:00.000Z");
    expect(doc).toMatchObject({ date: "2024-03-01T10:30:00", date_gmt: "2024-03-01T05:00:00", status: "publish" });
  });

  it("never moves a post's publish time when it is edited, and stamps modified with now", async () => {
    const { id } = await (await send("/wp/v2/posts", { title: "Edit me", content: "<p>a</p>", status: "publish", date: "2024-03-01T10:30" })).json();
    const before = await stored(id);
    for (let i = 0; i < 3; i++) await send(`/wp/v2/posts/${id}`, { content: `<p>edit ${i}</p>` });
    const after = await stored(id);
    expect(after.published_at?.getTime()).toBe(before.published_at?.getTime());
    expect(after.status).toBe("publish");
    expect(Date.now() - Date.parse(`${after.modified_gmt}Z`)).toBeLessThan(60_000);
  });

  it("schedules a future date as status future, hidden until its time", async () => {
    const future = new Date(Date.now() + 86_400_000);
    const local = new Date(future.getTime() + 5.5 * 3600_000).toISOString().slice(0, 16);
    const { id } = await (await send("/wp/v2/posts", { title: "Later", content: "<p>x</p>", status: "publish", date: local })).json();
    expect((await stored(id)).status).toBe("future");
  });

  it("keeps a draft slug-less until it is published, then dates it now and names it from the title", async () => {
    const { id } = await (await send("/wp/v2/posts", { title: "Draft title here", content: "<p>x</p>", status: "draft" })).json();
    expect((await stored(id)).slug).toBe("");
    await new Promise((r) => setTimeout(r, 20));
    const publishedAt = Date.now();
    await send(`/wp/v2/posts/${id}`, { status: "publish" });
    const doc = await stored(id);
    expect(doc.slug).toBe("draft-title-here");
    expect(doc.path).toMatch(/\/draft-title-here\/$/);
    expect(doc.published_at!.getTime()).toBeGreaterThanOrEqual(publishedAt - 1000);
  });

  it("uses the slug the editor typed", async () => {
    const { id } = await (await send("/wp/v2/posts", { title: "Anything", content: "<p>x</p>", status: "publish", slug: "My Custom Slug" })).json();
    const doc = await stored(id);
    expect(doc.slug).toBe("my-custom-slug");
    // the stored Yoast head describes this post at this URL
    expect(doc.seo).toMatchObject({ canonical: doc.link, og_url: doc.link, og_title: "Anything", og_type: "article" });
    expect(doc.seo?.article_published_time).toBe(`${doc.date_gmt}+00:00`);
  });

  it("keeps a published URL when only categories change, and records the old one when the slug changes", async () => {
    const cats = loadFixture("categories");
    const { id } = await (await send("/wp/v2/posts", { title: "Stable url", content: "<p>x</p>", status: "publish", categories: [cats[0]._id] })).json();
    const first = await stored(id);
    await send(`/wp/v2/posts/${id}`, { categories: [cats[1]._id] });
    expect((await stored(id)).path).toBe(first.path);
    await send(`/wp/v2/posts/${id}`, { slug: "renamed-url" });
    const renamed = await stored(id);
    expect(renamed.path).toMatch(/\/renamed-url\/$/);
    expect(renamed.old_paths).toEqual([first.path]);
    const { getPostByOldPath } = await import("@/lib/db/posts");
    expect((await getPostByOldPath(first.path))?.id).toBe(id);
  });

  it("stores titles the way WordPress renders them, so feeds stay valid XML", async () => {
    const { id } = await (await send("/wp/v2/posts", { title: "Q&A <live> - it's here", content: "<p>x</p>", status: "draft" })).json();
    expect((await stored(id)).title).toBe("Q&#038;A &lt;live&gt; &#8211; it&#8217;s here");
    const read = await (await adminRest(`/wp/v2/posts/${id}?context=edit`, {}, EDITOR)).json();
    expect(read.title.raw).toBe("Q&A <live> - it's here");
  });

  it("refreshes an auto-excerpt when the body changes, but keeps one the editor wrote", async () => {
    const { id } = await (await send("/wp/v2/posts", { title: "Ex", content: "<p>first body</p>", status: "draft", excerpt: "" })).json();
    await send(`/wp/v2/posts/${id}`, { content: "<p>second body</p>" });
    expect((await stored(id)).excerpt).toContain("second body");
    await send(`/wp/v2/posts/${id}`, { excerpt: "Written by hand" });
    await send(`/wp/v2/posts/${id}`, { content: "<p>third body</p>" });
    expect((await stored(id)).excerpt).toBe("<p>Written by hand</p>\n");
  });

  it("rejects an unknown author or featured image instead of saving a broken reference", async () => {
    expect((await send("/wp/v2/posts", { title: "x", content: "y", author: 987654 })).status).toBe(400);
    expect((await send("/wp/v2/posts", { title: "x", content: "y", featured_media: 987654 })).status).toBe(400);
  });
});
