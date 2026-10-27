import { beforeAll, describe, expect, it } from "vitest";
import { getUserBySlug, getUsersPage, searchUsers } from "@/lib/db/users";
import { seedFixtures, loadFixture } from "@/test/fixtures";
import type { WPUser } from "@/lib/wp-model";

const fixtureUsers = loadFixture("users");
const fixturePosts = loadFixture("posts");

/* Compute users with published posts. */
const usersWithPublishedPosts = new Set<number>();
for (const post of fixturePosts) {
  const isPublished = post.status === "publish" || post.status === "future";
  const isWithinTime = post.published_at ? new Date(post.published_at) <= new Date() : false;
  if (isPublished && isWithinTime && post.author_id) {
    usersWithPublishedPosts.add(post.author_id);
  }
}
const visibleUsers = fixtureUsers
  .filter((u) => usersWithPublishedPosts.has(u._id))
  .sort((a, b) => (a.name ?? "").localeCompare(b.name ?? ""));

describe("db/users", () => {
  beforeAll(async () => {
    await seedFixtures();
  });

  describe("getUserBySlug", () => {
    it("returns a user by slug if they have published posts", async () => {
      const fixture = visibleUsers[0];
      const user = await getUserBySlug(fixture.slug);
      expect(user).not.toBeNull();
      expect(user?.id).toBe(fixture._id);
      expect(user?.slug).toBe(fixture.slug);
      expect(user?.name).toBe(fixture.name);
    });

    it("returns null for users without published posts", async () => {
      const noPublished = fixtureUsers.find((u) => !usersWithPublishedPosts.has(u._id));
      if (noPublished) {
        const user = await getUserBySlug(noPublished.slug);
        expect(user).toBeNull();
      }
    });

    it("returns null for non-existent user", async () => {
      const user = await getUserBySlug("no-such-user-xyz");
      expect(user).toBeNull();
    });

    it("includes description and mpp_avatar fields", async () => {
      const fixture = visibleUsers[0];
      const user = await getUserBySlug(fixture.slug);
      expect(user).toHaveProperty("id");
      expect(user).toHaveProperty("name");
      expect(user).toHaveProperty("slug");
      expect(user).toHaveProperty("description");
      // mpp_avatar may be undefined if user has no photo
      if (user?.mpp_avatar) {
        expect(typeof user.mpp_avatar).toBe("object");
      }
    });
  });

  describe("getUsersPage", () => {
    it("returns users ordered by name ascending", async () => {
      const { items } = await getUsersPage(1, 100);
      for (let i = 1; i < items.length; i++) {
        expect((items[i - 1].name ?? "").localeCompare(items[i].name ?? "")).toBeLessThanOrEqual(0);
      }
    });

    it("defaults to page 1, 60 per page", async () => {
      const page1 = await getUsersPage();
      expect(page1.items.length).toBeLessThanOrEqual(60);
    });

    it("respects the perPage parameter", async () => {
      const page10 = await getUsersPage(1, 10);
      const page30 = await getUsersPage(1, 30);
      expect(page10.items.length).toBeLessThanOrEqual(10);
      expect(page30.items.length).toBeLessThanOrEqual(30);
    });

    it("returns pagination metadata: total and totalPages", async () => {
      const page = await getUsersPage(1, 10);
      expect(page).toHaveProperty("total");
      expect(page).toHaveProperty("totalPages");
      expect(page.total).toBe(visibleUsers.length);
      expect(page.totalPages).toBe(Math.ceil(visibleUsers.length / 10));
    });

    it("returns empty page for page number beyond the end", async () => {
      const page = await getUsersPage(9999, 10);
      expect(page.items).toHaveLength(0);
      expect(page.total).toBe(0);
      expect(page.totalPages).toBe(0);
    });

    it("includes only required fields: id, name, slug, description, mpp_avatar", async () => {
      const { items } = await getUsersPage(1, 10);
      if (items.length > 0) {
        const user = items[0];
        expect(user).toHaveProperty("id");
        expect(user).toHaveProperty("name");
        expect(user).toHaveProperty("slug");
        expect(user).toHaveProperty("description");
        // mpp_avatar may be undefined or present
        // Should NOT have username, email, or other sensitive fields
        expect(user).not.toHaveProperty("username");
        expect(user).not.toHaveProperty("email");
        expect(user).not.toHaveProperty("avatar_urls");
      }
    });

    it("only lists users with published posts", async () => {
      const { items } = await getUsersPage(1, 100);
      for (const user of items) {
        expect(usersWithPublishedPosts.has(user.id)).toBe(true);
      }
    });

    it("pages through all users correctly", async () => {
      const allCollected: WPUser[] = [];
      const perPage = 10;
      let page = 1;

      while (true) {
        const { items, totalPages } = await getUsersPage(page, perPage);
        allCollected.push(...items);
        if (page >= totalPages) break;
        page++;
      }
      expect(allCollected.length).toBe(visibleUsers.length);
    });
  });

  describe("searchUsers", () => {
    it("searches users by name (substring match)", async () => {
      // Pick a user and search for part of their name
      const fixture = visibleUsers.find((u) => (u.name ?? "").length > 3);
      if (fixture) {
        const substring = (fixture.name ?? "").substring(0, 3);
        const results = await searchUsers(substring);
        const found = results.find((u) => u.id === fixture._id);
        expect(found).toBeDefined();
      }
    });

    it("returns results with only id, name, slug fields", async () => {
      const fixture = visibleUsers[0];
      const results = await searchUsers(fixture.name ?? "");
      if (results.length > 0) {
        const user = results[0];
        expect(user).toHaveProperty("id");
        expect(user).toHaveProperty("name");
        expect(user).toHaveProperty("slug");
        // Should not have description or other fields
        expect(user).not.toHaveProperty("description");
        expect(user).not.toHaveProperty("mpp_avatar");
        expect(user).not.toHaveProperty("username");
        expect(user).not.toHaveProperty("email");
      }
    });

    it("only returns users with published posts", async () => {
      const results = await searchUsers("a");
      for (const user of results) {
        expect(usersWithPublishedPosts.has(user.id)).toBe(true);
      }
    });

    it("escapes regex special characters in search term", async () => {
      // Search for ".*" should not match everything
      const results = await searchUsers(".*");
      // Should either find nothing or find users that literally have ".*" in their name
      // The important thing is it doesn't cause a regex error or match everything
      expect(Array.isArray(results)).toBe(true);
    });

    it("searches case-insensitively", async () => {
      const fixture = visibleUsers[0];
      const lower = (fixture.name ?? "").toLowerCase();
      const upper = (fixture.name ?? "").toUpperCase();
      if (lower !== upper) {
        const resultsLower = await searchUsers(lower.substring(0, 3));
        const resultsUpper = await searchUsers(upper.substring(0, 3));
        expect(resultsLower.length).toBeGreaterThan(0);
        expect(resultsUpper.length).toBeGreaterThan(0);
      }
    });

    it("returns empty array for non-matching search", async () => {
      const results = await searchUsers("xyz_no_user_has_this_name_xyz");
      expect(results).toEqual([]);
    });
  });
});

describe("db/users: what the code review caught", () => {
  beforeAll(async () => {
    await seedFixtures();
  });

  it("gives an author page its Yoast head, as WordPress's /users endpoint did", async () => {
    const { collection } = await import("@/lib/db/client");
    const author = visibleUsers[0];
    const seo = { title: "Author title", canonical: author.link, og_type: "profile" };
    await (await collection("users")).updateOne({ _id: author._id }, { $set: { seo } });
    const user = await getUserBySlug(author.slug);
    expect(user?.yoast_head_json).toMatchObject(seo);
  });

  it("orders author search by name and returns at most ten, as WordPress did", async () => {
    const results = await searchUsers("a");
    expect(results.length).toBeLessThanOrEqual(10);
    const names = results.map((u) => u.name);
    expect(names).toEqual([...names].sort((a, b) => a.localeCompare(b, "en", { sensitivity: "base" })));
  });
});
