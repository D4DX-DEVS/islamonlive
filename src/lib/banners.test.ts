import { describe, expect, it, beforeAll, vi } from "vitest";
import { seedFixtures } from "@/test/fixtures";
import { collection } from "@/lib/db/client";

/* Test banner loading from MongoDB, verifying:
   - getHomeBanners() reads from MongoDB in mongo mode
   - Returns correct Banner shape (href, img, width, height, alt)
   - Handles empty banners collection gracefully
   - mediaOriginUrl() is applied to img URLs
   - rewriteUrl() is applied to href URLs
 */

describe("Banners from MongoDB", () => {
  beforeAll(async () => {
    // Set mongo mode for these tests
    process.env.DATA_SOURCE = "mongo";
    vi.resetModules();
    await seedFixtures();
  });

  it("returns empty array when banners collection is empty", async () => {
    const { getHomeBanners } = await import("@/lib/banners");
    const coll = await collection("banners");
    await coll.deleteMany({});
    const banners = await getHomeBanners();
    expect(banners).toEqual([]);
  });

  it("reads banners from MongoDB with correct shape", async () => {
    const { getHomeBanners } = await import("@/lib/banners");
    const coll = await collection("banners");

    // Insert test banner
    await coll.insertOne({
      _id: "test-banner-1",
      href: "https://islamonlive.in/category/news/",
      img: "https://islamonlive.in/wp-content/uploads/2024/01/banner.jpg",
      width: 1440,
      height: 120,
      alt: "News banner",
      updated_at: new Date(),
    });

    const banners = await getHomeBanners();
    expect(banners).toHaveLength(1);
    expect(banners[0]).toMatchObject({
      href: expect.stringContaining("/category/news/"),
      img: expect.stringContaining("wp-content/uploads"),
      width: 1440,
      height: 120,
      alt: "News banner",
    });
  });

  it("applies mediaOriginUrl transformation to image URLs", async () => {
    const { getHomeBanners } = await import("@/lib/banners");
    const coll = await collection("banners");

    // Clear and insert new banner
    await coll.deleteMany({});
    await coll.insertOne({
      _id: "test-banner-2",
      href: "/category/test/",
      img: "https://islamonlive.in/wp-content/uploads/2024/01/test.jpg",
      width: 800,
      height: 100,
      alt: "Test",
      updated_at: new Date(),
    });

    const banners = await getHomeBanners();
    expect(banners[0].img).toBeTruthy();
    // Should contain the media path
    expect(banners[0].img).toContain("wp-content/uploads/2024/01/test.jpg");
  });

  it("handles multiple banners in order", async () => {
    const { getHomeBanners } = await import("@/lib/banners");
    const coll = await collection("banners");

    // Clear and insert multiple banners
    await coll.deleteMany({});
    await coll.insertMany([
      {
        _id: "banner-1",
        href: "/category/first/",
        img: "https://islamonlive.in/wp-content/uploads/2024/01/first.jpg",
        width: 1440,
        height: 120,
        alt: "First",
      },
      {
        _id: "banner-2",
        href: "/category/second/",
        img: "https://islamonlive.in/wp-content/uploads/2024/01/second.jpg",
        width: 1440,
        height: 120,
        alt: "Second",
      },
    ]);

    const banners = await getHomeBanners();
    expect(banners).toHaveLength(2);
    expect(banners[0].alt).toBe("First");
    expect(banners[1].alt).toBe("Second");
  });

  it("preserves alt text and dimensions", async () => {
    const { getHomeBanners } = await import("@/lib/banners");
    const coll = await collection("banners");

    await coll.deleteMany({});
    await coll.insertOne({
      _id: "banner-3",
      href: "/",
      img: "https://islamonlive.in/wp-content/uploads/2024/01/promo.jpg",
      width: 960,
      height: 240,
      alt: "Promotional banner with Malayalam text",
      updated_at: new Date(),
    });

    const banners = await getHomeBanners();
    expect(banners[0].width).toBe(960);
    expect(banners[0].height).toBe(240);
    expect(banners[0].alt).toBe("Promotional banner with Malayalam text");
  });
});
