import { beforeEach, describe, expect, it } from "vitest";
import { collection } from "@/lib/db/client";
import { deleteAllReaderData, liveNow, pruneExpired, rollUpYesterday, rollupsSettled, totalsBy, uniqueVisitors, visitorsPerArticle, type GroupBy } from "./aggregate";
import { istDayStart, type Device, type PageKind, type Source } from "./shared";
import type { Filters } from "./filters";
import type { AnalyticsViewDoc } from "@/lib/db/types";

const DAY = "2026-10-20";
const T0 = istDayStart(DAY) + 10 * 3_600_000; // 10:00 IST
/** "now" while the day is still open (read from raw views), and long after (read from rollups) */
const DURING = T0 + 3_600_000;
const LATER = T0 + 10 * 86_400_000;

let n = 0;
function view(over: Partial<AnalyticsViewDoc> & { at?: number; secondsOpen?: number }): AnalyticsViewDoc {
  const { at = T0, secondsOpen = 600, ...rest } = over;
  n += 1;
  return {
    _id: `view-${String(n).padStart(12, "0")}`, v: "visitor-a", s: "session-a", t: new Date(at), ls: new Date(at + secondsOpen * 1000), day: DAY,
    k: "article" as PageKind, p: "/x/post-1/", a: 1, c: [10], dev: "mobile" as Device, src: "search" as Source, ref: "www.google.com", nv: false, en: false, e: 0, sd: 0,
    ...rest,
  };
}

/* Three visitors on one day:
   A: lands on article 1 from Google (60 s, 95 %), then article 2 internally (20 s, 40 %) -> engaged session, 2 views
   B: new, lands on the home page from Facebook (5 s) and leaves                         -> bounce
   C: lands on article 1 directly on desktop (12 s, 30 %)                                -> engaged by time */
const seed = () => [
  view({ v: "visitor-a", s: "session-a", en: true, e: 60, sd: 95 }),
  view({ v: "visitor-a", s: "session-a", a: 2, c: [10, 11], p: "/x/post-2/", src: "internal", ref: undefined, e: 20, sd: 40, at: T0 + 70_000 }),
  view({ v: "visitor-b", s: "session-b", en: true, nv: true, k: "home", p: "/", a: undefined, c: undefined, src: "social", ref: "l.facebook.com", e: 5, sd: 100 }),
  view({ v: "visitor-c", s: "session-c", en: true, dev: "desktop", src: "direct", ref: undefined, e: 12, sd: 30 }),
];

const f = (over: Partial<Filters> = {}): Filters => ({ preset: "custom", from: DAY, to: DAY, ...over });
const one = async (filters: Filters, now: number) => (await totalsBy(filters, "all", now))[0];

describe("analytics aggregation", () => {
  beforeEach(async () => {
    // a rollup queued by the last test must not land in this one
    await rollupsSettled();
    for (const name of ["analytics_views", "analytics_daily", "analytics_meta"] as const) await (await collection(name)).deleteMany({});
    await (await collection("analytics_views")).insertMany(seed());
  });

  it("adds up views, active time, scroll and sessions by GA4's rules", async () => {
    expect(await one(f(), DURING)).toMatchObject({
      views: 4, activeSeconds: 97, articleViews: 3, articleActiveSeconds: 92,
      scrollSum: 165, r25: 3, r50: 1, r75: 1, r90: 1,
      sessions: 3, engagedSessions: 2,
    });
  });

  it("prunes views, rollups and markers once they are older than the 30 days kept", async () => {
    await totalsBy(f(), "all", LATER); // queues the day's rollup
    await rollupsSettled();
    expect(await (await collection("analytics_daily")).countDocuments()).toBeGreaterThan(0);
    await pruneExpired(T0 + 29 * 86_400_000); // the day is the oldest of the 30 still kept
    expect(await (await collection("analytics_views")).countDocuments()).toBe(4);
    await pruneExpired(T0 + 30 * 86_400_000);
    for (const name of ["analytics_views", "analytics_daily", "analytics_meta"] as const) expect(await (await collection(name)).countDocuments(), name).toBe(0);
  });

  it("deletes all reader data on request, and a rollup already queued does not bring it back", async () => {
    const report = totalsBy(f(), "all", LATER);
    const deleted = await deleteAllReaderData();
    await report.catch(() => undefined);
    await rollupsSettled();
    expect(deleted.views).toBe(4);
    for (const name of ["analytics_views", "analytics_daily"] as const) expect(await (await collection(name)).countDocuments(), name).toBe(0);
    expect(await (await collection("analytics_meta")).findOne({ _id: `rolled:${DAY}` })).toBeNull();
  });

  it("never credits more active time than passed between a view's first and last beacon", async () => {
    await (await collection("analytics_views")).insertOne(view({ v: "visitor-d", s: "session-d", e: 3_000, secondsOpen: 60 }));
    const total = await one(f({ device: "mobile", source: "search" }), DURING);
    // 60 from visitor A, plus at most 60 + 30 from the forged one
    expect(total.activeSeconds).toBe(60 + 90);
  });

  it("gives the same numbers from rollups once the day has closed", async () => {
    await totalsBy(f(), "all", LATER);
    await rollupsSettled();
    for (const by of ["all", "day", "page", "category", "source", "referrer", "device", "visitor", "kind"] as GroupBy[]) {
      const sort = (rows: unknown[]) => [...rows].map((row) => JSON.stringify(row)).sort();
      expect(sort(await totalsBy(f(), by, LATER)), by).toEqual(sort(await totalsBy(f(), by, DURING)));
    }
    expect(await (await collection("analytics_daily")).countDocuments()).toBeGreaterThan(0);
  });

  it("builds a day's rollup in the background, and keeps answering from it after the raw views expire", async () => {
    // the first report after the day closes is answered from the raw views and queues the rollup
    expect((await one(f(), LATER)).views).toBe(4);
    await rollupsSettled();
    const built = await (await collection("analytics_meta")).findOne({ _id: `rolled:${DAY}` });
    expect(built).not.toBeNull();
    await (await collection("analytics_views")).deleteMany({});
    expect((await one(f(), LATER)).views).toBe(4);
  });

  it("applies every filter the same way to raw views and rollups", async () => {
    await totalsBy(f(), "all", LATER);
    await rollupsSettled();
    const cases: [Partial<Filters>, number][] = [
      [{ device: "desktop" }, 1], [{ source: "social" }, 1], [{ visitor: "new" }, 1], [{ visitor: "returning" }, 3],
      [{ article: 1 }, 2], [{ article: 2 }, 1], [{ category: 11 }, 1], [{ category: 10 }, 3],
    ];
    for (const [filter, views] of cases) {
      expect((await one(f(filter), DURING))?.views ?? 0, JSON.stringify(filter)).toBe(views);
      expect((await one(f(filter), LATER))?.views ?? 0, `${JSON.stringify(filter)} rolled up`).toBe(views);
    }
  });

  it("counts sessions where they started", async () => {
    const byPage = await totalsBy(f(), "page", DURING);
    const of = (k: string, key: unknown) => byPage.find((row) => JSON.stringify(row.id) === JSON.stringify({ k, key }));
    expect(of("article", 1)).toMatchObject({ sessions: 2, engagedSessions: 2 });
    expect(of("article", 2)).toMatchObject({ sessions: 0 });
    expect(of("home", "/")).toMatchObject({ sessions: 1, engagedSessions: 0 });
  });

  it("counts an article once under each of its categories, or only the filtered one", async () => {
    const byCategory = await totalsBy(f(), "category", DURING);
    expect(Object.fromEntries(byCategory.map((row) => [row.id, row.articleViews]))).toEqual({ 10: 3, 11: 1 });
    const filtered = await totalsBy(f({ category: 11 }), "category", LATER);
    expect(filtered.map((row) => row.id)).toEqual([11]);
  });

  it("counts distinct visitors exactly, new and returning", async () => {
    expect(await uniqueVisitors(f(), DURING)).toEqual({ total: 3, new: 1, returning: 2 });
    expect(await uniqueVisitors(f({ article: 1 }), DURING)).toEqual({ total: 2, new: 0, returning: 2 });
    expect(await visitorsPerArticle(f(), [1, 2, 3], DURING)).toEqual(new Map([[1, 2], [2, 1]]));
  });

  it("rolls up yesterday once it closes, from the first beacon after, with no report asked for", async () => {
    await rollUpYesterday(istDayStart(DAY) + 86_400_000 + 3_600_000); // 01:00 the next day: still open for late pings
    await rollupsSettled();
    expect(await (await collection("analytics_meta")).findOne({ _id: `rolled:${DAY}` })).toBeNull();
    await rollUpYesterday(istDayStart(DAY) + 86_400_000 + 3 * 3_600_000);
    await rollupsSettled();
    expect(await (await collection("analytics_meta")).findOne({ _id: `rolled:${DAY}` })).toMatchObject({ rows: expect.any(Number) });
  });

  it("says visitors are unknown rather than guessing when the range is past retention", async () => {
    expect(await uniqueVisitors(f({ from: "2024-01-01" }), DURING)).toBeNull();
  });

  it("shows who was seen in the last two minutes, by page, as counts", async () => {
    const now = T0 + 600_000;
    const live = await liveNow(now);
    // everyone's last beacon is at T0 + 600 s (or later); visitor A has two views but is one reader
    expect(live.visitors).toBe(3);
    expect(live.pages[0]).toMatchObject({ k: "article", key: 1, readers: 2 });
    // A read two articles in category 10 and is one reader there; the home page has no category
    expect(live.categories).toEqual([{ id: 10, readers: 2 }, { id: 11, readers: 1 }]);
    expect(live.perMinute.reduce((a, b) => a + b, 0)).toBe(4);
    expect((await liveNow(now + 5 * 60_000)).visitors).toBe(0);
  });
});
