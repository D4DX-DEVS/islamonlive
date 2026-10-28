import type { Document } from "mongodb";
import { collection } from "@/lib/db/client";
import { ensureAnalyticsIndexes, VIEW_RETENTION_DAYS } from "@/lib/analytics/store";
import { eachDay, type Filters, type Range } from "@/lib/analytics/filters";
import { ENGAGED_SESSION_SECONDS, LIVE_WINDOW_MS, addDays, istDay, istDayStart, type Device, type PageKind, type Source } from "@/lib/analytics/shared";
import type { AnalyticsDailyDoc, AnalyticsMeasures } from "@/lib/db/types";

/* The numbers behind every report, from MongoDB.

   Closed days are read from analytics_daily, one document per day and
   combination of dimensions. Those are built in the background, paced, once a
   day closes (the first beacon after it, or the first report asking for it; no
   cron needed). Open days (today, and yesterday until 02:00 IST, so late pings
   land first), and closed days whose rollup isn't written yet, are read from the
   raw views with the same arithmetic, so the two sources add up as one. Unique visitors can't be added across days, so
   they always come from the raw views, and while those are kept only.

   Raw views are normalised first: `key` is the article id or the page path,
   and active time is capped at the time between the view's first and last
   beacon (+30 s), so a forged or buggy beacon can't claim more time than passed. */

export type GroupBy = "all" | "day" | "page" | "category" | "source" | "referrer" | "device" | "visitor" | "kind";
export type Row = AnalyticsMeasures & { id: unknown };

const GROUP: Record<GroupBy, unknown> = {
  all: null,
  day: "$day",
  page: { k: "$k", key: "$key" },
  category: "$c",
  source: "$src",
  referrer: "$ref",
  device: "$dev",
  visitor: "$nv",
  kind: "$k",
};
/** Every dimension a rollup document is split by. */
const FULL = { dev: "$dev", src: "$src", nv: "$nv", k: "$k", key: "$key", ref: "$ref" };
const ROLLUP_GRACE_MS = 2 * 3_600_000;
export const EMPTY: AnalyticsMeasures = { views: 0, activeSeconds: 0, articleViews: 0, articleActiveSeconds: 0, scrollSum: 0, r25: 0, r50: 0, r75: 0, r90: 0, sessions: 0, engagedSessions: 0 };
const MEASURES = Object.keys(EMPTY) as (keyof AnalyticsMeasures)[];

const normalise: Document = {
  $set: {
    key: { $ifNull: ["$a", "$p"] },
    ref: { $ifNull: ["$ref", null] },
    c: { $ifNull: ["$c", null] },
    ea: { $floor: { $min: ["$e", { $add: [{ $divide: [{ $subtract: ["$ls", "$t"] }, 1000] }, 30] }] } },
  },
};

/** Filters on the normalised fields both collections share. */
function dimsMatch(f: Partial<Filters>): Document {
  return {
    ...(f.device ? { dev: f.device } : {}),
    ...(f.source ? { src: f.source } : {}),
    ...(f.visitor ? { nv: f.visitor === "new" } : {}),
    ...(f.article ? { k: "article", key: f.article } : {}),
    ...(f.category ? { c: f.category } : {}),
  };
}

/** The same filters on the raw fields, so the first stage can use an index. */
function rawMatch(f: Partial<Filters> & Range): Document {
  return {
    day: { $gte: f.from, $lte: f.to },
    ...(f.device ? { dev: f.device } : {}),
    ...(f.source ? { src: f.source } : {}),
    ...(f.visitor ? { nv: f.visitor === "new" } : {}),
    ...(f.article ? { a: f.article } : {}),
    ...(f.category ? { c: f.category } : {}),
  };
}

/** Grouping by category counts an article under each of its categories (only the filtered one, if any). */
function unwindCategories(by: unknown, f: Partial<Filters>): Document[] {
  return by === GROUP.category ? [{ $unwind: "$c" }, ...(f.category ? [{ $match: { c: f.category } }] : [])] : [];
}

const isArticle = { $eq: ["$k", "article"] };
const reached = (pct: number) => ({ $sum: { $cond: [{ $and: [isArticle, { $gte: ["$sd", pct] }] }, 1, 0] } });

function rawViewsPipeline(f: Partial<Filters> & Range, by: unknown, extra: Document = {}): Document[] {
  return [
    { $match: rawMatch(f) },
    normalise,
    ...unwindCategories(by, f),
    {
      $group: {
        _id: by,
        views: { $sum: 1 },
        activeSeconds: { $sum: "$ea" },
        articleViews: { $sum: { $cond: [isArticle, 1, 0] } },
        articleActiveSeconds: { $sum: { $cond: [isArticle, "$ea", 0] } },
        scrollSum: { $sum: { $cond: [isArticle, "$sd", 0] } },
        r25: reached(25), r50: reached(50), r75: reached(75), r90: reached(90),
        ...extra,
      },
    },
  ];
}

/** Sessions are counted where they started (their entry view) and engaged per GA4: 10 s active or 2+ views. */
function rawSessionsPipeline(f: Partial<Filters> & Range, by: unknown): Document[] {
  return [
    { $match: { day: { $gte: f.from, $lte: f.to } } },
    normalise,
    { $group: { _id: "$s", n: { $sum: 1 }, e: { $sum: "$ea" }, entry: { $max: { $cond: ["$en", { day: "$day", dev: "$dev", src: "$src", nv: "$nv", k: "$k", key: "$key", ref: "$ref", c: "$c" }, null] } } } },
    { $match: { entry: { $ne: null } } },
    { $replaceWith: { $mergeObjects: ["$entry", { engaged: { $or: [{ $gte: ["$n", 2] }, { $gte: ["$e", ENGAGED_SESSION_SECONDS] }] } }] } },
    { $match: dimsMatch(f) },
    ...unwindCategories(by, f),
    { $group: { _id: by, sessions: { $sum: 1 }, engagedSessions: { $sum: { $cond: ["$engaged", 1, 0] } } } },
  ];
}

function rollupPipeline(f: Partial<Filters> & Range, by: unknown): Document[] {
  return [
    { $match: { day: { $gte: f.from, $lte: f.to }, ...dimsMatch(f) } },
    ...unwindCategories(by, f),
    { $group: { _id: by, ...Object.fromEntries(MEASURES.map((m) => [m, { $sum: `$${m}` }])) } },
  ];
}

function merge(into: Map<string, Row>, rows: Document[]): void {
  for (const row of rows) {
    const k = JSON.stringify(row._id ?? null);
    const current = into.get(k) ?? { ...EMPTY, id: row._id ?? null };
    for (const m of MEASURES) if (typeof row[m] === "number") current[m] += row[m];
    into.set(k, current);
  }
}

export function isClosed(day: string, now = Date.now()): boolean {
  return istDayStart(day) + 86_400_000 + ROLLUP_GRACE_MS <= now;
}

/* ---------- rollups ---------- */

const building = new Map<string, Promise<void>>();
let rollupQueue: Promise<void> = Promise.resolve();
/** documents written per batch, then a pause: the cluster is shared with the site and caps operations per second */
const ROLLUP_BATCH = 50;
const rollupPauseMs = () => Number(process.env.ANALYTICS_ROLLUP_PAUSE_MS ?? 1000);
const pause = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

async function buildRollup(day: string): Promise<void> {
  const views = await collection("analytics_views");
  const range = { from: day, to: day };
  const [viewRows, sessionRows] = await Promise.all([
    views.aggregate(rawViewsPipeline(range, FULL, { c: { $first: "$c" } })).toArray(),
    views.aggregate(rawSessionsPipeline(range, FULL)).toArray(),
  ]);
  const rows = new Map<string, Row>();
  merge(rows, viewRows);
  merge(rows, sessionRows);
  const categories = new Map(viewRows.map((row) => [JSON.stringify(row._id), row.c as number[] | null]));
  const docs: AnalyticsDailyDoc[] = [...rows.entries()].map(([k, { id, ...measures }]) => {
    const dims = id as { dev: Device; src: Source; nv: boolean; k: PageKind; key: number | string; ref: string | null };
    return { _id: [day, dims.dev, dims.src, dims.nv ? "new" : "ret", dims.k, dims.key, dims.ref ?? ""].join("|"), day, ...dims, ref: dims.ref ?? null, c: categories.get(k) ?? null, ...measures };
  });
  const daily = await collection("analytics_daily");
  // deterministic ids make a rebuild, or two processes building at once, harmless; until the
  // marker below is written the day is read from its raw views, so a half-written rollup is never counted
  for (let i = 0; i < docs.length; i += ROLLUP_BATCH) {
    if (i > 0) await pause(rollupPauseMs());
    await daily.bulkWrite(docs.slice(i, i + ROLLUP_BATCH).map((doc) => ({ replaceOne: { filter: { _id: doc._id }, replacement: doc, upsert: true } })), { ordered: false });
  }
  await (await collection("analytics_meta")).updateOne({ _id: `rolled:${day}` }, { $set: { at: new Date(), rows: docs.length } }, { upsert: true });
}

/** The first day anything was collected (rollups outlive the raw views), or null. */
export async function collectingSince(): Promise<string | null> {
  const [firstView] = await (await collection("analytics_views")).find({}, { projection: { day: 1 } }).sort({ t: 1 }).limit(1).toArray();
  const [firstRollup] = await (await collection("analytics_daily")).find({}, { projection: { day: 1 } }).sort({ day: 1 }).limit(1).toArray();
  const days = [firstView?.day, firstRollup?.day].filter((d): d is string => Boolean(d)).sort();
  return days[0] ?? null;
}

/** Queues rollups, one day at a time and off the request: until a day's is written, its raw views answer for it. */
function scheduleRollups(days: string[]): void {
  for (const day of days) {
    if (building.has(day)) continue;
    const job = rollupQueue
      .then(() => buildRollup(day))
      .catch((error: unknown) => console.warn(`[analytics] could not roll up ${day}:`, error instanceof Error ? error.message : error))
      .finally(() => building.delete(day));
    building.set(day, job);
    rollupQueue = job;
  }
}

/** Which of these closed days are rolled up. The others that can be are queued for it. */
async function rolledUp(days: string[], now: number): Promise<Set<string>> {
  if (!days.length) return new Set();
  const done = new Set((await (await collection("analytics_meta")).find({ _id: { $in: days.map((d) => `rolled:${d}`) } }, { projection: { _id: 1 } }).toArray()).map((doc) => String(doc._id).slice(7)));
  const missing = days.filter((day) => !done.has(day) && !building.has(day));
  if (missing.length) {
    const [firstView] = await (await collection("analytics_views")).find({}, { projection: { day: 1 } }).sort({ t: 1 }).limit(1).toArray();
    // only days whose raw views are all still kept: the oldest one is already partly expired
    const oldestWhole = addDays(retainedFrom(now), 1);
    scheduleRollups(firstView ? missing.filter((day) => day >= firstView.day && day >= oldestWhole) : []);
  }
  return done;
}

let checkedDay = "";

/**
 * Rolls up yesterday once it closes, whether or not anyone opens a report, so no day is left to
 * expire unrolled. Cheap to call on every beacon; callers need not wait (it resolves once queued).
 */
export function rollUpYesterday(now = Date.now()): Promise<void> {
  const yesterday = addDays(istDay(now), -1);
  if (checkedDay === yesterday || !isClosed(yesterday, now)) return Promise.resolve();
  checkedDay = yesterday;
  return rolledUp([yesterday], now).then(() => undefined, () => { checkedDay = ""; });
}

/** Wait for queued rollups; for tests and the benchmark. */
export function rollupsSettled(): Promise<void> {
  return rollupQueue;
}

/** Consecutive runs of days, so each is one indexed range query. */
function runs(days: string[]): Range[] {
  const out: Range[] = [];
  for (const day of days) {
    const last = out.at(-1);
    if (last && addDays(last.to, 1) === day) last.to = day;
    else out.push({ from: day, to: day });
  }
  return out;
}

/* ---------- queries ---------- */

/** Sums for a range, grouped one way: rolled-up days from analytics_daily, every other day from the raw views. */
export async function totalsBy(f: Filters, by: GroupBy, now = Date.now()): Promise<Row[]> {
  await ensureAnalyticsIndexes();
  const days = eachDay(f);
  const rolled = await rolledUp(days.filter((day) => isClosed(day, now)), now);
  const group = GROUP[by];
  const rows = new Map<string, Row>();
  const jobs: Promise<void>[] = [];
  const daily = await collection("analytics_daily");
  const views = await collection("analytics_views");
  for (const run of runs(days.filter((day) => rolled.has(day)))) {
    jobs.push((async () => merge(rows, await daily.aggregate(rollupPipeline({ ...f, ...run }, group)).toArray()))());
  }
  for (const run of runs(days.filter((day) => !rolled.has(day)))) {
    jobs.push((async () => merge(rows, await views.aggregate(rawViewsPipeline({ ...f, ...run }, group)).toArray()))());
    jobs.push((async () => merge(rows, await views.aggregate(rawSessionsPipeline({ ...f, ...run }, group)).toArray()))());
  }
  await Promise.all(jobs);
  return [...rows.values()];
}

/** The oldest day raw views are still kept for. */
export function retainedFrom(now = Date.now()): string {
  return addDays(istDay(now), -(VIEW_RETENTION_DAYS - 1));
}

export type VisitorCounts = { total: number; new: number; returning: number };

/** Exact distinct visitors for the range, split new/returning; null when part of the range is past retention. */
export async function uniqueVisitors(f: Filters, now = Date.now()): Promise<VisitorCounts | null> {
  if (f.from < retainedFrom(now)) return null;
  const [row] = await (await collection("analytics_views")).aggregate([
    { $match: rawMatch(f) },
    { $group: { _id: "$v", nv: { $max: "$nv" } } },
    { $group: { _id: null, total: { $sum: 1 }, isNew: { $sum: { $cond: ["$nv", 1, 0] } } } },
  ]).toArray();
  const total = row?.total ?? 0;
  const fresh = row?.isNew ?? 0;
  return { total, new: fresh, returning: total - fresh };
}

/** Distinct visitors per article, for a page of the article table; null when past retention. */
export async function visitorsPerArticle(f: Filters, ids: number[], now = Date.now()): Promise<Map<number, number> | null> {
  if (f.from < retainedFrom(now)) return null;
  if (!ids.length) return new Map();
  const rows = await (await collection("analytics_views")).aggregate([
    { $match: { ...rawMatch({ ...f, article: undefined }), a: { $in: ids } } },
    { $group: { _id: { a: "$a", v: "$v" } } },
    { $group: { _id: "$_id.a", n: { $sum: 1 } } },
  ]).toArray();
  return new Map(rows.map((row) => [row._id as number, row.n as number]));
}

export type Live = {
  visitors: number;
  pages: { k: PageKind; key: number | string; readers: number }[];
  /** readers on articles in each category; an article in two categories counts in both */
  categories: { id: number; readers: number }[];
  devices: { id: Device; readers: number }[];
  sources: { id: Source; readers: number }[];
  /** views started in each of the last 30 minutes, oldest first */
  perMinute: number[];
};

/** Who is on the site now: seen in the last LIVE_WINDOW_MS. Counts only, never who. */
export async function liveNow(now = Date.now()): Promise<Live> {
  await ensureAnalyticsIndexes();
  const views = await collection("analytics_views");
  const distinctBy = (field: unknown) => [{ $group: { _id: field, v: { $addToSet: "$v" } } }, { $project: { readers: { $size: "$v" } } }, { $sort: { readers: -1 } }];
  const [[facets], minutes] = await Promise.all([
    views.aggregate([
      { $match: { ls: { $gte: new Date(now - LIVE_WINDOW_MS) } } },
      { $facet: {
        visitors: [{ $group: { _id: "$v" } }, { $count: "n" }],
        pages: [...distinctBy({ k: "$k", key: { $ifNull: ["$a", "$p"] } }), { $limit: 15 }],
        categories: [{ $match: { k: "article" } }, { $unwind: "$c" }, ...distinctBy("$c"), { $limit: 10 }],
        devices: distinctBy("$dev"),
        sources: distinctBy("$src"),
      } },
    ]).toArray(),
    views.aggregate([
      { $match: { t: { $gte: new Date(now - 30 * 60_000) } } },
      { $group: { _id: { $floor: { $divide: [{ $subtract: [new Date(now), "$t"] }, 60_000] } }, n: { $sum: 1 } } },
    ]).toArray(),
  ]);
  const perMinute = Array.from({ length: 30 }, () => 0);
  for (const m of minutes) { const ago = Number(m._id); if (ago >= 0 && ago < 30) perMinute[29 - ago] = m.n; }
  return {
    visitors: facets?.visitors?.[0]?.n ?? 0,
    pages: (facets?.pages ?? []).map((p: Document) => ({ k: p._id.k, key: p._id.key, readers: p.readers })),
    categories: (facets?.categories ?? []).map((c: Document) => ({ id: Number(c._id), readers: c.readers })),
    devices: (facets?.devices ?? []).map((d: Document) => ({ id: d._id, readers: d.readers })),
    sources: (facets?.sources ?? []).map((d: Document) => ({ id: d._id, readers: d.readers })),
    perMinute,
  };
}
