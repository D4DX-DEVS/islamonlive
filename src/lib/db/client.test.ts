import { afterEach, beforeAll, describe, expect, inject, it } from "vitest";
import { closeMongo, collection, db, DB_NAME } from "@/lib/db/client";
import { seedFixtures } from "@/test/fixtures";

const uri = inject("mongoUri");

describe("lib/db client", () => {
  beforeAll(async () => {
    await seedFixtures();
  });

  afterEach(async () => {
    process.env.MONGODB_URI = uri;
  });

  it("always uses the islamonlive database, never the URI's default", async () => {
    // the shared cluster's URI names another app's database
    await closeMongo();
    process.env.MONGODB_URI = `${uri.replace(/\/?(\?.*)?$/, "")}/bahraincampus`;
    expect((await db()).databaseName).toBe(DB_NAME);
    expect(DB_NAME).toBe("islamonlive");
    await closeMongo();
  });

  it("throws a clear error when MONGODB_URI is missing, then recovers once set", async () => {
    await closeMongo();
    delete process.env.MONGODB_URI;
    await expect(db()).rejects.toThrow("MONGODB_URI is not set");
    process.env.MONGODB_URI = uri;
    expect((await db()).databaseName).toBe(DB_NAME);
  });

  it("reuses one client across calls", async () => {
    const [a, b] = await Promise.all([db(), db()]);
    expect(a.client).toBe(b.client);
  });

  it("loads the fixture slice with real Dates and every post status", async () => {
    const posts = await collection("posts");
    const statuses = await posts.distinct("status");
    // fixtures deliberately mix published posts with hidden ones (drafts, trash, …)
    expect(statuses).toContain("publish");
    expect(statuses.length).toBeGreaterThan(1);
    const newest = await posts.find({ status: "publish" }).sort({ published_at: -1 }).limit(1).next();
    expect(newest?.published_at).toBeInstanceOf(Date);
    expect(await (await collection("categories")).countDocuments()).toBe(81);
  });
});
