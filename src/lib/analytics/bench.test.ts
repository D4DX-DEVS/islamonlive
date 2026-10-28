import { describe, expect, it, vi } from "vitest";
import { collection } from "@/lib/db/client";
import { articlesTable, summary } from "./report";
import { rollupsSettled } from "./aggregate";
import { addDays, istDay, istDayStart } from "./shared";
import type { AnalyticsViewDoc } from "@/lib/db/types";

/* How long the reports take on a busy site's worth of views. Opt-in, it takes a
   minute: ANALYTICS_BENCH=1 npx vitest run src/lib/analytics/bench.test.ts
   (VIEWS_PER_DAY=20000 to change the volume). Runs on the local throwaway mongod,
   which is quicker than the shared Atlas cluster, so read the timings as a floor. */

vi.mock("@/lib/wp-lookup", () => ({
  getArticleMeta: async (ids: number[]) => new Map(ids.map((id) => [id, { title: `Article ${id}`, path: `/x/a-${id}/`, date: null, categories: [id % 40], featuredMedia: 0 }])),
  getCategoryNames: async (ids: number[]) => new Map(ids.map((id) => [id, `Category ${id}`])),
  getThumbnails: async () => new Map(),
}));

const PER_DAY = Number(process.env.VIEWS_PER_DAY || 10_000);
const DAYS = 30;

describe.skipIf(!process.env.ANALYTICS_BENCH)("analytics report timings", () => {
  it(`summarises ${DAYS} days of ${PER_DAY} views a day`, async () => {
    const views = await collection("analytics_views");
    for (const name of ["analytics_views", "analytics_daily", "analytics_meta"] as const) await (await collection(name)).deleteMany({});
    const today = istDay(Date.now());
    const kinds = ["article", "article", "article", "home", "category"] as const;
    const sources = ["search", "social", "direct", "internal", "referral"] as const;
    for (let d = 0; d < DAYS; d++) {
      const day = addDays(today, -d);
      const start = istDayStart(day);
      const docs: AnalyticsViewDoc[] = Array.from({ length: PER_DAY }, (_, i) => {
        const k = kinds[i % kinds.length];
        const article = 1 + ((i * 7919) % 3_000);
        const t = new Date(start + (i * 86_400_000) / PER_DAY);
        return { _id: `${day}-${i}`, v: `v-${(i * 31 + d * 17) % (PER_DAY * 3)}`, s: `${day}-s-${Math.floor(i / 3)}`, t, ls: new Date(t.getTime() + 120_000), day, k, p: k === "article" ? `/x/a-${article}/` : k === "home" ? "/" : `/category/c-${i % 40}/`, ...(k === "article" ? { a: article, c: [article % 40] } : {}), dev: i % 3 ? "mobile" : "desktop", src: sources[i % sources.length], nv: i % 4 === 0, en: i % 3 === 0, e: i % 120, sd: i % 101 };
      });
      await views.insertMany(docs, { ordered: false });
    }

    const time = async (label: string, run: () => Promise<unknown>) => {
      const started = performance.now();
      await run();
      const ms = Math.round(performance.now() - started);
      console.info(`[bench] ${label}: ${ms} ms`);
      return ms;
    };
    const month = { preset: "30" as const, from: addDays(today, -(DAYS - 1)), to: today };
    // the first report reads every day from the raw views and queues the rollups in the background
    process.env.ANALYTICS_ROLLUP_PAUSE_MS = "0";
    await time("summary, 30 days, first run (raw views)", () => summary(month));
    await time("rollups for 29 closed days, unpaced", () => rollupsSettled());
    // a different filter so the in-memory cache does not answer
    const warm = await time("summary, 30 days, rollups built", () => summary({ ...month, device: "mobile" }));
    await time("article table, 30 days", () => articlesTable({ ...month, source: "search" }, { q: "", sort: "avgSeconds", order: "desc", page: 1, pageSize: 20 }));
    expect(warm).toBeLessThan(15_000);
  }, 600_000);
});
