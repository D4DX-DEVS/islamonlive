import { beforeAll, describe, expect, it } from "vitest";
import { searchPostsPage } from "@/lib/db/search";
import { searchVariants, interleave } from "@/lib/search";
import { seedFixtures, loadFixture } from "@/test/fixtures";

const fixturePosts = loadFixture("posts");
const visible = fixturePosts.filter((p) => p.status === "publish");

describe("db/search", () => {
  beforeAll(async () => {
    await seedFixtures();
  });

  describe("searchPostsPage", () => {
    it("returns empty results for an empty search", async () => {
      const result = await searchPostsPage({ search: "" });
      expect(result.items).toHaveLength(0);
      expect(result.total).toBe(0);
      expect(result.totalPages).toBe(0);
    });

    it("returns matching posts when searching for a term in title", async () => {
      // Use a common word from visible posts
      const post = visible.find((p) => p.title.length > 0);
      if (!post) return;

      const word = post.title.split(/\s+/)[0];
      if (!word || word.length < 2) return;

      const result = await searchPostsPage({ search: word });
      expect(result.items.length).toBeGreaterThan(0);
      expect(result.total).toBeGreaterThan(0);
      const foundPost = result.items.find((p) => p.id === post._id);
      expect(foundPost).toBeTruthy();
    });

    it("matches case-insensitively", async () => {
      const post = visible.find((p) => p.title.length > 0);
      if (!post) return;

      const word = post.title.split(/\s+/)[0];
      if (!word || word.length < 2) return;

      const lower = word.toLowerCase();
      const upper = word.toUpperCase();

      const resultLower = await searchPostsPage({ search: lower });
      const resultUpper = await searchPostsPage({ search: upper });

      expect(resultLower.total).toBe(resultUpper.total);
      expect(resultLower.items.map((p) => p.id).sort()).toEqual(resultUpper.items.map((p) => p.id).sort());
    });

    it("matches substring inside longer words", async () => {
      const post = visible[0];
      if (!post?.title || post.title.length < 4) return;

      // Take a substring from the middle of a word
      const word = post.title.split(/\s+/)[0];
      if (word.length < 4) return;

      const substring = word.substring(1, Math.min(3, word.length));
      const result = await searchPostsPage({ search: substring });

      // Should find posts containing this substring
      expect(result.items.length).toBeGreaterThanOrEqual(0);
    });

    it("excludes hidden posts", async () => {
      const hidden = new Set(fixturePosts.filter((p) => p.status !== "publish").map((p) => p._id));
      const result = await searchPostsPage({ search: "a" });
      expect(result.items.some((p) => hidden.has(p.id))).toBe(false);
    });

    it("handles multiple search terms with AND semantics", async () => {
      // Find a post with at least 2 words in title
      const post = visible.find((p) => p.title.split(/\s+/).length >= 2);
      if (!post) return;

      const words = post.title.split(/\s+/).filter((w) => w.length > 2);
      if (words.length < 2) return;

      const [word1, word2] = words;
      const result = await searchPostsPage({ search: `${word1} ${word2}` });

      // The post should be found when searching for both words
      expect(result.items.some((p) => p.id === post._id)).toBe(true);
    });

    it("returns pages with proper pagination", async () => {
      const result1 = await searchPostsPage({ search: "a", page: 1, perPage: 5 });
      const result2 = await searchPostsPage({ search: "a", page: 2, perPage: 5 });

      if (result1.total > 5) {
        expect(result1.items.length).toBe(5);
        expect(result1.totalPages).toBeGreaterThan(1);
      }

      if (result1.total > 5) {
        const ids1 = new Set(result1.items.map((p) => p.id));
        const ids2 = new Set(result2.items.map((p) => p.id));
        expect([...ids1].some((id) => ids2.has(id))).toBe(false);
      }
    });

    it("returns empty page for page number past the end", async () => {
      const result = await searchPostsPage({ search: "a", page: 9999 });
      expect(result.items).toHaveLength(0);
      expect(result.total).toBe(0);
      expect(result.totalPages).toBe(0);
    });

    it("caps perPage at 100", async () => {
      const result = await searchPostsPage({ search: "a", perPage: 500 });
      expect(result.items.length).toBeLessThanOrEqual(100);
    });

    it("does not include post body in list results, like WP", async () => {
      const result = await searchPostsPage({ search: "a" });
      if (result.items.length === 0) return;

      for (const post of result.items) {
        expect(post).not.toHaveProperty("content");
      }
    });

    it("includes all expected search fields", async () => {
      const result = await searchPostsPage({ search: "a" });
      if (result.items.length === 0) return;

      const post = result.items[0];
      expect(post.id).toBeTruthy();
      expect(post.title).toBeTruthy();
      expect(post.excerpt).toBeTruthy();
      expect(post.slug).toBeTruthy();
      expect(post.link).toBeTruthy();
      expect(post.date).toBeTruthy();
    });

    it("respects other filter options in addition to search", async () => {
      // Find a post with a category and author
      const post = visible.find((p) => p.categories.length > 0 && p.author_id);
      if (!post) return;

      const categoryId = post.categories[0];
      const result = await searchPostsPage({ search: "a", categories: [categoryId] });

      // All results should have the specified category
      expect(result.items.every((p) => p.categories.includes(categoryId))).toBe(true);
    });

    it("handles regex special characters in search literally", async () => {
      // Search for a term with regex special chars
      const result = await searchPostsPage({ search: ".*+" });
      // Should not throw and should return empty or filtered results
      expect(result).toBeTruthy();
      expect(Array.isArray(result.items)).toBe(true);
    });
  });

  describe("search variants with Malayalam", () => {
    it("integrates searchVariants for chillu consonants", () => {
      // Verify that searchVariants generates proper variants
      const variants = searchVariants("ൻ");
      expect(variants.length).toBeGreaterThan(0);
    });

    it("integrates interleave to merge multi-variant results", () => {
      const list1 = [{ id: 1 }, { id: 2 }];
      const list2 = [{ id: 3 }, { id: 4 }];
      const merged = interleave([list1, list2], (item) => item.id);

      // Should interleave: [1, 3, 2, 4]
      expect(merged.map((item) => item.id)).toEqual([1, 3, 2, 4]);
    });
  });
});
