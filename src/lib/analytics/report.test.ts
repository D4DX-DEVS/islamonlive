import { beforeEach, describe, expect, it, vi } from "vitest";
import { collection } from "@/lib/db/client";
import { articleDetail, articlesTable, listPage, liveReport, summary, MIN_VIEWS } from "./report";
import { rollupsSettled } from "./aggregate";
import { addDays, istDay, istDayStart } from "./shared";
import type { Filters } from "./filters";
import type { AnalyticsViewDoc } from "@/lib/db/types";

// titles and names come from the content source; the reports must not wait on WordPress in tests
vi.mock("@/lib/wp-lookup", () => ({
  getArticleMeta: async (ids: number[]) => new Map(ids.map((id) => [id, { title: `Article ${id}`, path: `/x/a-${id}/`, date: "2026-01-01T10:00:00", categories: [10], featuredMedia: 0 }])),
  getCategoryNames: async (ids: number[]) => new Map(ids.map((id) => [id, `Category ${id}`])),
  getThumbnails: async () => new Map(),
}));

const today = istDay(Date.now());
const yesterday = addDays(today, -1);
let n = 0;

/** `count` views of an article on a day, each `seconds` active and scrolled `scroll` %, one visitor and session each. */
function reads(article: number, day: string, count: number, seconds: number, scroll: number): AnalyticsViewDoc[] {
  const t = istDayStart(day) + 3_600_000;
  return Array.from({ length: count }, () => {
    n += 1;
    const id = String(n).padStart(12, "0");
    return { _id: `view-${id}`, v: `visitor-${id}`, s: `session-${id}`, t: new Date(t), ls: new Date(t + 3_600_000), day, k: "article", p: `/x/a-${article}/`, a: article, c: [10], dev: "mobile", src: "search", nv: true, en: true, e: seconds, sd: scroll };
  });
}

const week: Filters = { preset: "custom", from: addDays(today, -6), to: today };

describe("analytics reports", () => {
  beforeEach(async () => {
    // a rollup queued by the last test must not land in this one
    await rollupsSettled();
    for (const name of ["analytics_views", "analytics_daily", "analytics_meta"] as const) await (await collection(name)).deleteMany({});
  });

  it("says when nothing has been collected yet, with no comparison and empty lists", async () => {
    const report = await summary({ ...week, from: addDays(today, -5) });
    expect(report.collectingSince).toBeNull();
    expect(report.previous).toBeNull();
    expect(report.totals).toMatchObject({ views: 0, visitors: 0, avgArticleSeconds: null, completionRate: null, engagementRate: null });
    expect(report.series).toHaveLength(6);
  });

  it("ranks articles and finds the skimmed ones and the hidden gems", async () => {
    await (await collection("analytics_views")).insertMany([
      ...reads(1, today, 60, 10, 30), // popular but skimmed
      ...reads(2, today, 30, 90, 95),
      ...reads(3, today, 25, 80, 92),
      ...reads(4, today, 20, 70, 80),
      ...reads(5, today, 12, 300, 100), // few readers, read in full: a gem
      ...reads(6, today, 3, 999, 100), // too few views to judge
    ]);
    const report = await summary({ ...week, from: addDays(today, -1) });
    expect(report.topViewed.data.map((a) => a.id)).toEqual([1, 2, 3, 4, 5]);
    expect(report.topEngaging.data[0].id).toBe(5);
    expect(report.topEngaging.data.map((a) => a.id)).not.toContain(6);
    expect(report.insights.skimmed.data.map((a) => a.id)).toEqual([1]);
    expect(report.insights.gems.data.map((a) => a.id)).toEqual([5]);
    expect(report.insights.minViews).toBe(MIN_VIEWS);
    expect(report.topViewed.data[0]).toMatchObject({ title: "Article 1", category: "Category 10", avgSeconds: 10, completionRate: 0 });
    expect(report.categories.data[0]).toMatchObject({ id: 10, name: "Category 10", views: 150 });
    // where the reading time went: 12 × 300 s, 3 × 999 s, 30 × 90 s, 25 × 80 s, 20 × 70 s, 60 × 10 s
    // (a total, so it needs no minimum number of views)
    expect(report.topByTime.data.map((a) => a.id)).toEqual([5, 6, 2, 3, 4]);
    expect(report.topByTime).toMatchObject({ page: 1, pageSize: 5, total: 6, totalPages: 2 });
    // the rest pages on the server, from the same figures, numbered on from the first page
    const second = await listPage({ ...week, from: addDays(today, -1) }, "byTime", 2);
    expect(second).toMatchObject({ page: 2, total: 6, totalPages: 2 });
    expect(second.data.map((a) => [a.id, a.title])).toEqual([[1, "Article 1"]]);
    expect((await listPage({ ...week, from: addDays(today, -1) }, "byTime", 9)).page).toBe(2);
    expect((await listPage({ ...week, from: addDays(today, -1) }, "categories", 1)).data[0]).toMatchObject({ id: 10, name: "Category 10" });
    expect(report.topByTime.data[0]).toMatchObject({ title: "Article 5", category: "Category 10", activeSeconds: 3600 });
    expect(report.categories.data[0]).toMatchObject({ activeSeconds: 13_297, timeShare: 100 });
  });

  it("compares with the previous period and shows what is gaining and losing readers", async () => {
    await (await collection("analytics_views")).insertMany([
      ...reads(1, yesterday, 40, 30, 50), ...reads(1, today, 5, 30, 50),
      ...reads(2, yesterday, 2, 30, 50), ...reads(2, today, 30, 30, 50),
    ]);
    const report = await summary({ preset: "today", from: today, to: today });
    expect(report.previous?.views).toBe(42);
    expect(report.totals.views).toBe(35);
    expect(report.insights.trending.data.map((a) => a.id)).toEqual([2]);
    expect(report.insights.declining.data.map((a) => a.id)).toEqual([1]);
    expect(report.insights.trending.data[0]).toMatchObject({ previousViews: 2, change: 1400 });
  });

  it("serves the article table sorted, searched and paged, with exact visitors per row", async () => {
    await (await collection("analytics_views")).insertMany([...reads(1, today, 5, 20, 50), ...reads(2, today, 3, 200, 90), ...reads(3, today, 8, 5, 10)]);
    const byViews = await articlesTable(week, { q: "", sort: "views", order: "desc", page: 1, pageSize: 2 });
    expect(byViews).toMatchObject({ total: 3, totalPages: 2, page: 1 });
    expect(byViews.data.map((row) => [row.id, row.visitors])).toEqual([[3, 8], [1, 5]]);
    const byTime = await articlesTable(week, { q: "", sort: "avgSeconds", order: "desc", page: 1, pageSize: 10 });
    expect(byTime.data.map((row) => row.id)).toEqual([2, 1, 3]);
    expect((await articlesTable(week, { q: "article 2", sort: "views", order: "desc", page: 1, pageSize: 10 })).data.map((row) => row.id)).toEqual([2]);
    expect((await articlesTable(week, { q: "", sort: "views", order: "desc", page: 9, pageSize: 10 })).page).toBe(1);
  });

  it("breaks one article down, against the site average", async () => {
    await (await collection("analytics_views")).insertMany([...reads(1, today, 4, 40, 100), ...reads(2, today, 4, 20, 0)]);
    const detail = await articleDetail(1, week);
    expect(detail.article.title).toBe("Article 1");
    expect(detail.totals).toMatchObject({ views: 4, visitors: 4, avgArticleSeconds: 40, completionRate: 100, reached: { 25: 4, 50: 4, 75: 4, 90: 4 } });
    expect(detail.siteAverage).toEqual({ avgArticleSeconds: 30, avgScroll: 50, completionRate: 50 });
    expect(detail.sources).toEqual([{ id: "search", views: 4, activeSeconds: 160, sessions: 4, share: 100 }]);
  });

  it("makes no comparison with a previous period collection only partly covers", async () => {
    await (await collection("analytics_views")).insertMany([...reads(1, addDays(today, -3), 5, 30, 50), ...reads(1, today, 5, 30, 50)]);
    // the two days before collection began would read as no readers, and everything as growth
    expect((await summary({ preset: "custom", from: addDays(today, -2), to: today })).previous).toBeNull();
    // (a device filter keeps this clear of an earlier test's cached report for the same dates)
    expect((await summary({ preset: "custom", from: addDays(today, -1), to: today, device: "mobile" })).previous?.views).toBe(5);
  });

  it("names the articles being read right now", async () => {
    const live = reads(7, today, 2, 10, 10).map((doc) => ({ ...doc, ls: new Date() }));
    await (await collection("analytics_views")).insertMany(live);
    const report = await liveReport();
    expect(report.visitors).toBe(2);
    expect(report.pages[0]).toMatchObject({ kind: "article", title: "Article 7", category: "Category 10", readers: 2 });
    expect(report.categories).toEqual([{ id: 10, name: "Category 10", readers: 2 }]);
  });
});
