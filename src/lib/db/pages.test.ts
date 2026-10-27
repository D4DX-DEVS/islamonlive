import { beforeAll, describe, expect, it } from "vitest";
import { getPageBySlug } from "@/lib/db/pages";
import { seedFixtures, loadFixture } from "@/test/fixtures";

const fixturePages = loadFixture("pages");
const published = fixturePages.filter((p) => p.status === "publish");

describe("db/pages", () => {
  beforeAll(async () => {
    await seedFixtures();
  });

  describe("getPageBySlug", () => {
    it("returns a published page by its slug", async () => {
      if (!published.length) {
        expect(published).toHaveLength(0);
        return;
      }
      const page = await getPageBySlug(published[0].slug);
      expect(page).toBeTruthy();
      expect(page?.id).toBe(published[0]._id);
      expect(page?.slug).toBe(published[0].slug);
      expect(page?.title.rendered).toBe(published[0].title);
    });

    it("returns the page body and Yoast head", async () => {
      if (!published.length) return;
      const page = await getPageBySlug(published[0].slug);
      expect(page?.content.rendered).toBe(published[0].content);
      if (published[0].seo) {
        expect(page?.yoast_head_json).toBeTruthy();
        expect(page?.yoast_head_json?.canonical ?? page?.yoast_head_json?.title).toBeTruthy();
      }
    });

    it("returns null for unpublished pages", async () => {
      const draft = fixturePages.find((p) => p.status !== "publish");
      if (!draft) return;
      expect(await getPageBySlug(draft.slug)).toBeNull();
    });

    it("returns null when the page does not exist", async () => {
      expect(await getPageBySlug("page-that-does-not-exist-anywhere")).toBeNull();
    });

    it("includes link and modified fields", async () => {
      if (!published.length) return;
      const page = await getPageBySlug(published[0].slug);
      expect(page?.link).toBe(published[0].link);
      expect(page?.modified).toBe(published[0].modified);
    });
  });
});
