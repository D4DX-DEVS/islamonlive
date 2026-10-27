import { beforeAll, describe, expect, it } from "vitest";
import { getCategories, getAllCategories, getCategoryBySlug, getTagBySlug } from "@/lib/db/taxonomy";
import { seedFixtures, loadFixture } from "@/test/fixtures";

const fixtureCategories = loadFixture("categories");
const fixtureTags = loadFixture("tags");
const fixturePosts = loadFixture("posts");

/* Compute posts visible to readers (published and within time window). */
const visiblePosts = fixturePosts.filter((post) => {
  const isPublished = post.status === "publish" || post.status === "future";
  const isWithinTime = post.published_at ? new Date(post.published_at) <= new Date() : false;
  return isPublished && isWithinTime;
});

describe("db/taxonomy", () => {
  beforeAll(async () => {
    await seedFixtures();
  });

  describe("getCategories", () => {
    it("returns categories ordered by count descending, ties broken by name ascending", async () => {
      const cats = await getCategories(100);
      expect(cats.length).toBeGreaterThan(0);

      // Check that counts are in descending order (or tied and then name ascending)
      for (let i = 1; i < cats.length; i++) {
        const prev = cats[i - 1];
        const curr = cats[i];
        if (prev.count === curr.count) {
          // If counts are equal, name should be in ascending order
          expect((prev.name ?? "").localeCompare(curr.name ?? "") <= 0).toBe(true);
        } else {
          // Otherwise count should be descending
          expect(prev.count).toBeGreaterThanOrEqual(curr.count);
        }
      }
    });

    it("defaults to 50 per page", async () => {
      const cats = await getCategories();
      expect(cats.length).toBeLessThanOrEqual(50);
    });

    it("respects the perPage parameter", async () => {
      const cats10 = await getCategories(10);
      const cats30 = await getCategories(30);
      expect(cats10.length).toBeLessThanOrEqual(10);
      expect(cats30.length).toBeLessThanOrEqual(30);
    });

    it("includes only the required fields: id, name, slug, count, parent, link", async () => {
      const cats = await getCategories(10);
      if (cats.length > 0) {
        const cat = cats[0];
        expect(cat).toHaveProperty("id");
        expect(cat).toHaveProperty("name");
        expect(cat).toHaveProperty("slug");
        expect(cat).toHaveProperty("count");
        expect(cat).toHaveProperty("parent");
        expect(cat).toHaveProperty("link");
        // Should not have description or yoast_head_json in list view
        expect(cat).not.toHaveProperty("description");
        expect(cat).not.toHaveProperty("yoast_head_json");
      }
    });

    it("returns parent as a number or undefined (never present as null)", async () => {
      const cats = await getCategories(100);
      for (const cat of cats) {
        if (cat.parent !== undefined) {
          expect(typeof cat.parent).toBe("number");
        }
      }
    });
  });

  describe("getAllCategories", () => {
    it("returns all categories", async () => {
      const cats = await getAllCategories();
      expect(cats.length).toBe(fixtureCategories.length);
    });

    it("orders categories by name ascending (WP default order)", async () => {
      const cats = await getAllCategories();
      for (let i = 1; i < cats.length; i++) {
        expect((cats[i - 1].name ?? "").localeCompare(cats[i].name ?? "")).toBeLessThanOrEqual(0);
      }
    });

    it("includes the same fields as getCategories", async () => {
      const cats = await getAllCategories();
      if (cats.length > 0) {
        const cat = cats[0];
        expect(cat).toHaveProperty("id");
        expect(cat).toHaveProperty("name");
        expect(cat).toHaveProperty("slug");
        expect(cat).toHaveProperty("count");
        expect(cat).toHaveProperty("parent");
        expect(cat).toHaveProperty("link");
        expect(cat).not.toHaveProperty("description");
        expect(cat).not.toHaveProperty("yoast_head_json");
      }
    });
  });

  describe("getCategoryBySlug", () => {
    it("returns a category by its slug", async () => {
      const fixture = fixtureCategories[0];
      const cat = await getCategoryBySlug(fixture.slug);
      expect(cat).not.toBeNull();
      expect(cat?.id).toBe(fixture._id);
      expect(cat?.slug).toBe(fixture.slug);
      expect(cat?.name).toBe(fixture.name);
    });

    it("finds categories by decoded slug", async () => {
      const encoded = fixtureCategories.find((c) => /%[0-9a-f]{2}/.test(c.slug));
      if (encoded) {
        const decoded = decodeURIComponent(encoded.slug);
        const cat = await getCategoryBySlug(decoded);
        expect(cat?.id).toBe(encoded._id);
      }
    });

    it("finds categories by encoded slug", async () => {
      const encoded = fixtureCategories.find((c) => /%[0-9a-f]{2}/.test(c.slug));
      if (encoded) {
        const cat = await getCategoryBySlug(encoded.slug);
        expect(cat?.id).toBe(encoded._id);
      }
    });

    it("finds categories by uppercase-reencoded slug", async () => {
      const encoded = fixtureCategories.find((c) => /%[0-9a-f]{2}/.test(c.slug));
      if (encoded) {
        const uppercase = encoded.slug.toUpperCase().replace(/%([0-9A-F]{2})/g, "%$1");
        const cat = await getCategoryBySlug(uppercase);
        expect(cat?.id).toBe(encoded._id);
      }
    });

    it("includes description and yoast_head_json for single category view", async () => {
      const fixture = fixtureCategories[0];
      const cat = await getCategoryBySlug(fixture.slug);
      expect(cat).toHaveProperty("description");
      expect(cat).toHaveProperty("yoast_head_json");
    });

    it("returns null for non-existent category", async () => {
      const cat = await getCategoryBySlug("no-such-category-xyz");
      expect(cat).toBeNull();
    });

    it("includes required fields: id, name, slug, count, description, parent, link, yoast_head_json", async () => {
      const fixture = fixtureCategories[0];
      const cat = await getCategoryBySlug(fixture.slug);
      if (cat) {
        expect(cat).toHaveProperty("id");
        expect(cat).toHaveProperty("name");
        expect(cat).toHaveProperty("slug");
        expect(cat).toHaveProperty("count");
        expect(cat).toHaveProperty("description");
        expect(cat).toHaveProperty("parent");
        expect(cat).toHaveProperty("link");
      }
    });
  });

  describe("getTagBySlug", () => {
    it("returns a tag by its slug", async () => {
      const fixture = fixtureTags[0];
      const tag = await getTagBySlug(fixture.slug);
      expect(tag).not.toBeNull();
      expect(tag?.id).toBe(fixture._id);
      expect(tag?.slug).toBe(fixture.slug);
      expect(tag?.name).toBe(fixture.name);
    });

    it("finds tags by decoded slug", async () => {
      const encoded = fixtureTags.find((t) => /%[0-9a-f]{2}/.test(t.slug));
      if (encoded) {
        const decoded = decodeURIComponent(encoded.slug);
        const tag = await getTagBySlug(decoded);
        expect(tag?.id).toBe(encoded._id);
      }
    });

    it("finds tags by encoded slug", async () => {
      const encoded = fixtureTags.find((t) => /%[0-9a-f]{2}/.test(t.slug));
      if (encoded) {
        const tag = await getTagBySlug(encoded.slug);
        expect(tag?.id).toBe(encoded._id);
      }
    });

    it("includes description and yoast_head_json for single tag view", async () => {
      const fixture = fixtureTags[0];
      const tag = await getTagBySlug(fixture.slug);
      expect(tag).toHaveProperty("description");
      expect(tag).toHaveProperty("yoast_head_json");
    });

    it("does not include parent field for tags", async () => {
      const fixture = fixtureTags[0];
      const tag = await getTagBySlug(fixture.slug);
      expect(tag?.parent).toBeUndefined();
    });

    it("returns null for non-existent tag", async () => {
      const tag = await getTagBySlug("no-such-tag-xyz");
      expect(tag).toBeNull();
    });

    it("includes required fields: id, name, slug, count, description, link, yoast_head_json", async () => {
      const fixture = fixtureTags[0];
      const tag = await getTagBySlug(fixture.slug);
      if (tag) {
        expect(tag).toHaveProperty("id");
        expect(tag).toHaveProperty("name");
        expect(tag).toHaveProperty("slug");
        expect(tag).toHaveProperty("count");
        expect(tag).toHaveProperty("description");
        expect(tag).toHaveProperty("link");
      }
    });
  });

  describe("term counts", () => {
    it("computes category counts from published posts", async () => {
      const cats = await getAllCategories();
      expect(cats.length).toBeGreaterThan(0);

      // Verify at least one category has a reasonable count
      const withCount = cats.filter((c) => c.count > 0);
      expect(withCount.length).toBeGreaterThan(0);

      // Spot-check a category's computed count
      const cat = withCount[0];
      const assignedCount = visiblePosts.filter(
        (p) => p.categories.includes(cat.id)
      ).length;
      expect(cat.count).toBe(assignedCount);
    });

    it("computes tag counts from published posts", async () => {
      const testTag = fixtureTags.find((t) => t.slug && t._id > 0);
      if (testTag) {
        const tag = await getTagBySlug(testTag.slug);
        const assignedCount = visiblePosts.filter(
          (p) => p.tags.includes(tag!.id)
        ).length;
        expect(tag?.count).toBe(assignedCount);
      }
    });
  });
});

describe("db/taxonomy: live counts", () => {
  beforeAll(async () => {
    await seedFixtures();
  });

  it("counts a category with no published posts as 0, not its migration-time count", async () => {
    const live = new Set(visiblePosts.flatMap((p) => p.categories));
    const empty = fixtureCategories.find((c) => !live.has(c._id) && c.count > 0);
    if (!empty) return;
    const all = await getAllCategories();
    expect(all.find((c) => c.id === empty._id)?.count ?? 0).toBe(0);
  });
});
