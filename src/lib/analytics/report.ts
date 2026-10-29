import { getArticleMeta, getCategoryNames, getThumbnails, type ArticleMeta } from "@/lib/wp-lookup";
import { EMPTY, collectingSince, liveNow, totalsBy, uniqueVisitors, visitorsPerArticle, type Row, type VisitorCounts } from "@/lib/analytics/aggregate";
import { eachDay, previousRange, type Filters } from "@/lib/analytics/filters";
import { LIVE_WINDOW_MS, istDay, type Device, type PageKind, type Source } from "@/lib/analytics/shared";
import { ARTICLE_LISTS, LIST_PAGE_SIZE, type ArticleDetail, type ArticleList, type ArticleRow, type ArticleSort, type ArticlesPage, type BreakdownRow, type CategoryRow, type Insights, type ListName, type ListPage, type ListRow, type LiveReport, type Metric, type SeriesPoint, type Summary, type Totals } from "@/lib/analytics/report-types";
import type { AnalyticsMeasures } from "@/lib/db/types";

/* Turns the sums from aggregate.ts into the reports the admin dashboard shows.
   Results are kept in memory briefly (a minute when the range includes today,
   ten otherwise), so several admins refreshing don't multiply database load. */

/** An article needs this many views in the period before it is ranked by engagement or picked for an insight. */
export const MIN_VIEWS = 10;
/** Skimmed and hidden gems compare articles with each other, so they need at least this many eligible ones. */
const MIN_POOL = 5;

const cache = new Map<string, { at: number; ttl: number; value: Promise<unknown> }>();

function memo<T>(key: string, ttl: number, load: () => Promise<T>): Promise<T> {
  const now = Date.now();
  const hit = cache.get(key);
  if (hit && now - hit.at < hit.ttl) return hit.value as Promise<T>;
  if (cache.size > 500) for (const [k, v] of cache) if (now - v.at >= v.ttl) cache.delete(k);
  const value = load();
  cache.set(key, { at: now, ttl, value });
  // a failure is not remembered
  value.catch(() => cache.delete(key));
  return value;
}

const ttlFor = (f: Filters) => (f.to >= istDay(Date.now()) ? 60_000 : 600_000);
const pct = (part: number, whole: number): Metric => (whole > 0 ? Math.round((part / whole) * 1000) / 10 : null);
const avg = (sum: number, count: number): Metric => (count > 0 ? Math.round(sum / count) : null);

function sum(rows: Row[]): AnalyticsMeasures {
  return rows.reduce<AnalyticsMeasures>((acc, row) => {
    const out = { ...acc };
    for (const key of Object.keys(EMPTY) as (keyof AnalyticsMeasures)[]) out[key] += row[key];
    return out;
  }, { ...EMPTY });
}

function totalsOf(m: AnalyticsMeasures, visitors: VisitorCounts | null, split: Row[]): Totals {
  const newViews = split.find((row) => row.id === true)?.views ?? 0;
  return {
    views: m.views,
    visitors: visitors?.total ?? null,
    newVisitors: visitors?.new ?? null,
    returningVisitors: visitors?.returning ?? null,
    newViews,
    returningViews: m.views - newViews,
    activeSeconds: m.activeSeconds,
    articleViews: m.articleViews,
    articleActiveSeconds: m.articleActiveSeconds,
    avgArticleSeconds: avg(m.articleActiveSeconds, m.articleViews),
    avgScroll: avg(m.scrollSum, m.articleViews),
    completionRate: pct(m.r90, m.articleViews),
    reached: { 25: m.r25, 50: m.r50, 75: m.r75, 90: m.r90 },
    sessions: m.sessions,
    engagedSessions: m.engagedSessions,
    engagementRate: pct(m.engagedSessions, m.sessions),
    bounceRate: m.sessions > 0 ? Math.round((1 - m.engagedSessions / m.sessions) * 1000) / 10 : null,
    pagesPerSession: m.sessions > 0 ? Math.round((m.views / m.sessions) * 10) / 10 : null,
  };
}

function breakdown<T extends string>(rows: Row[], total: number): BreakdownRow<T>[] {
  return rows
    .filter((row) => row.id !== null && row.id !== undefined)
    .map((row) => ({ id: String(row.id) as T, views: row.views, activeSeconds: row.activeSeconds, sessions: row.sessions, share: pct(row.views, total) ?? 0 }))
    .sort((a, b) => b.views - a.views);
}

function series(f: Filters, rows: Row[]): SeriesPoint[] {
  const byDay = new Map(rows.map((row) => [String(row.id), row]));
  return eachDay(f).map((day) => {
    const row = byDay.get(day);
    return { day, views: row?.views ?? 0, articleViews: row?.articleViews ?? 0, activeSeconds: row?.activeSeconds ?? 0, articleActiveSeconds: row?.articleActiveSeconds ?? 0, completed: row?.r90 ?? 0 };
  });
}

/** Article rows from rows grouped by page, with the previous period's views for the change. */
function articleRows(current: Row[], previous: Row[]): Omit<ArticleRow, "title" | "path" | "category" | "publishedAt" | "image">[] {
  const isArticle = (row: Row) => (row.id as { k: PageKind }).k === "article";
  const before = new Map(previous.filter(isArticle).map((row) => [Number((row.id as { key: number }).key), row.articleViews]));
  return current.filter(isArticle).map((row) => {
    const id = Number((row.id as { key: number }).key);
    const previousViews = before.get(id) ?? 0;
    return {
      id,
      views: row.articleViews,
      activeSeconds: row.articleActiveSeconds,
      avgSeconds: avg(row.articleActiveSeconds, row.articleViews),
      avgScroll: avg(row.scrollSum, row.articleViews),
      completionRate: pct(row.r90, row.articleViews),
      previousViews,
      change: previousViews > 0 ? Math.round(((row.articleViews - previousViews) / previousViews) * 1000) / 10 : null,
    };
  });
}

async function describe<T extends { id: number }>(rows: T[]): Promise<(T & Pick<ArticleRow, "title" | "path" | "category" | "publishedAt" | "image">)[]> {
  const meta = await getArticleMeta(rows.map((row) => row.id));
  const [names, images] = await Promise.all([
    getCategoryNames([...new Set([...meta.values()].map((m) => m.categories[0]).filter(Boolean))]),
    getThumbnails([...meta.values()].map((m) => m.featuredMedia)),
  ]);
  return rows.map((row) => withMeta(row, meta.get(row.id), names, images));
}

function withMeta<T extends { id: number }>(row: T, meta: ArticleMeta | undefined, names: Map<number, string>, images: Map<number, string>) {
  return {
    ...row,
    title: meta?.title || `Article #${row.id}`,
    path: meta?.path ?? null,
    category: meta?.categories[0] ? names.get(meta.categories[0]) ?? null : null,
    publishedAt: meta?.date ?? null,
    image: meta?.featuredMedia ? images.get(meta.featuredMedia) ?? null : null,
  };
}

function median(values: number[]): number {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

function quantile(values: number[], q: number): number {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.floor(q * sorted.length))];
}

type Bare = ReturnType<typeof articleRows>[number];

/** Which articles stand out, each list ranked in full. Each only draws on articles with at least MIN_VIEWS views. */
function pickInsights(rows: Bare[]): { eligible: number; trending: Bare[]; declining: Bare[]; skimmed: Bare[]; gems: Bare[] } {
  const eligible = rows.filter((row) => row.views >= MIN_VIEWS && row.avgSeconds !== null);
  const times = eligible.map((row) => row.avgSeconds ?? 0);
  const views = eligible.map((row) => row.views);
  const typicalTime = median(times);
  return {
    eligible: eligible.length,
    trending: rows.filter((row) => row.views >= MIN_VIEWS && row.views - row.previousViews >= MIN_VIEWS / 2).sort((a, b) => (b.views - b.previousViews) - (a.views - a.previousViews)),
    declining: rows.filter((row) => row.previousViews >= MIN_VIEWS && row.previousViews - row.views >= MIN_VIEWS / 2).sort((a, b) => (b.previousViews - b.views) - (a.previousViews - a.views)),
    // read a lot, read little: well above typical views, under half the typical reading time
    skimmed: eligible.length >= MIN_POOL ? eligible.filter((row) => row.views >= quantile(views, 0.75) && (row.avgSeconds ?? 0) < typicalTime / 2).sort((a, b) => b.views - a.views) : [],
    // read little, read well: at most typical views, in the top quarter for reading time
    gems: eligible.length >= MIN_POOL ? eligible.filter((row) => row.views <= median(views) && (row.avgSeconds ?? 0) >= quantile(times, 0.75)).sort((a, b) => (b.avgSeconds ?? 0) - (a.avgSeconds ?? 0)) : [],
  };
}

/** The previous period, only when collection covers all of it: a part before collection began would read as no readers, and everything as growth. */
async function comparable(f: Filters, since: string | null): Promise<Filters | null> {
  const prev = previousRange(f);
  return since && prev.from >= since ? { ...f, ...prev } : null;
}

/** Everything the summary draws on, with every list ranked in full: one set of queries serves the summary and every page of its lists. */
function ranked(f: Filters) {
  return memo(`ranked:${JSON.stringify(f)}`, ttlFor(f), async () => {
    const since = await collectingSince();
    const pf = await comparable(f, since);
    const [all, byDay, byCategory, bySource, byReferrer, byDevice, byVisitor, byKind, pages, visitors, prevAll, prevVisitor, prevPages, prevVisitors] = await Promise.all([
      totalsBy(f, "all"), totalsBy(f, "day"), totalsBy(f, "category"), totalsBy(f, "source"), totalsBy(f, "referrer"),
      totalsBy(f, "device"), totalsBy(f, "visitor"), totalsBy(f, "kind"), totalsBy(f, "page"), uniqueVisitors(f),
      pf ? totalsBy(pf, "all") : null, pf ? totalsBy(pf, "visitor") : null, pf ? totalsBy(pf, "page") : [], pf ? uniqueVisitors(pf) : null,
    ]);
    const totals = totalsOf(sum(all), visitors, byVisitor);
    const categoryNames = await getCategoryNames(byCategory.map((row) => Number(row.id)).filter((id) => id > 0));
    const categories: CategoryRow[] = byCategory
      .filter((row) => Number(row.id) > 0)
      .map((row) => ({ id: Number(row.id), name: categoryNames.get(Number(row.id)) ?? `Category #${row.id}`, views: row.articleViews, activeSeconds: row.articleActiveSeconds, avgSeconds: avg(row.articleActiveSeconds, row.articleViews), completionRate: pct(row.r90, row.articleViews), share: pct(row.articleViews, totals.articleViews) ?? 0, timeShare: pct(row.articleActiveSeconds, totals.articleActiveSeconds) ?? 0 }))
      .sort((a, b) => b.activeSeconds - a.activeSeconds || b.views - a.views);

    const articles = articleRows(pages, prevPages);
    const insights = pickInsights(articles);
    const lists: Record<ArticleList, Bare[]> = {
      byTime: articles.filter((row) => row.activeSeconds > 0).sort((a, b) => b.activeSeconds - a.activeSeconds || b.views - a.views),
      viewed: [...articles].sort((a, b) => b.views - a.views),
      engaging: articles.filter((row) => row.views >= MIN_VIEWS).sort((a, b) => (b.avgSeconds ?? 0) - (a.avgSeconds ?? 0)),
      trending: insights.trending,
      declining: insights.declining,
      skimmed: insights.skimmed,
      gems: insights.gems,
    };
    return {
      since,
      totals,
      previous: pf && prevAll ? totalsOf(sum(prevAll), prevVisitors, prevVisitor ?? []) : null,
      series: series(f, byDay),
      categories,
      sources: breakdown<Source>(bySource, totals.views),
      referrers: breakdown(byReferrer, totals.views),
      devices: breakdown<Device>(byDevice, totals.views),
      kinds: breakdown<PageKind>(byKind, totals.views),
      lists,
      eligible: insights.eligible,
    };
  });
}

/** One page of a ranked list; a page past the end gives the last one. */
function pageOf<T>(rows: T[], page: number): ListPage<T> {
  const totalPages = Math.max(1, Math.ceil(rows.length / LIST_PAGE_SIZE));
  const current = Math.min(Math.max(1, page), totalPages);
  return { data: rows.slice((current - 1) * LIST_PAGE_SIZE, current * LIST_PAGE_SIZE), page: current, pageSize: LIST_PAGE_SIZE, total: rows.length, totalPages };
}

/** Titles, paths, categories and images for the articles on some pages, looked up together. */
async function describePages(pages: ListPage<Bare>[]): Promise<ListPage<ArticleRow>[]> {
  const rows = [...new Map(pages.flatMap((p) => p.data).map((row) => [row.id, row])).values()];
  const described = new Map((await describe(rows)).map((row) => [row.id, row]));
  return pages.map((p) => ({ ...p, data: p.data.map((row) => described.get(row.id)!) }));
}

/** The Analytics page: totals, trends and breakdowns, with the first page of each ranked list. */
export function summary(f: Filters): Promise<Summary> {
  return memo(`summary:${JSON.stringify(f)}`, ttlFor(f), async () => {
    const r = await ranked(f);
    const [byTime, viewed, engaging, trending, declining, skimmed, gems] = await describePages(ARTICLE_LISTS.map((list) => pageOf(r.lists[list], 1)));
    return {
      filters: f,
      previousRange: previousRange(f),
      collectingSince: r.since,
      generatedAt: new Date().toISOString(),
      totals: r.totals,
      previous: r.previous,
      series: r.series,
      categories: pageOf(r.categories, 1),
      sources: r.sources,
      referrers: pageOf(r.referrers, 1),
      devices: r.devices,
      kinds: r.kinds,
      topByTime: byTime,
      topViewed: viewed,
      topEngaging: engaging,
      insights: { minViews: MIN_VIEWS, eligible: r.eligible, trending, declining, skimmed, gems } satisfies Insights,
    };
  });
}

/** Any page of one of the summary's ranked lists, from the same figures as the summary. */
export function listPage<L extends ListName>(f: Filters, list: L, page: number): Promise<ListPage<ListRow[L]>> {
  return memo(`list:${list}:${page}:${JSON.stringify(f)}`, ttlFor(f), async () => {
    const r = await ranked(f);
    if (list === "categories") return pageOf(r.categories, page) as ListPage<ListRow[L]>;
    if (list === "referrers") return pageOf(r.referrers, page) as ListPage<ListRow[L]>;
    const [described] = await describePages([pageOf(r.lists[list as ArticleList], page)]);
    return described as ListPage<ListRow[L]>;
  });
}

export type TableOptions = { q: string; sort: ArticleSort; order: "asc" | "desc"; page: number; pageSize: number };

/** Every article read in the period, described, before search, sort and paging: one query for every page and sort of the table. */
function tableRows(f: Filters) {
  return memo(`table-rows:${JSON.stringify(f)}`, ttlFor(f), async () => {
    const pf = await comparable(f, await collectingSince());
    const [pages, prevPages] = await Promise.all([totalsBy(f, "page"), pf ? totalsBy(pf, "page") : []]);
    return describe(articleRows(pages, prevPages));
  });
}

export function articlesTable(f: Filters, opts: TableOptions): Promise<ArticlesPage> {
  return memo(`table:${JSON.stringify([f, opts])}`, ttlFor(f), async () => {
    const all = await tableRows(f);
    const q = opts.q.trim().toLowerCase();
    const matched = q ? all.filter((row) => row.title.toLowerCase().includes(q) || String(row.id) === q) : all;
    const value = (row: (typeof all)[number]): number | string => {
      if (opts.sort === "title") return row.title.toLowerCase();
      if (opts.sort === "publishedAt") return row.publishedAt ?? "";
      return row[opts.sort] ?? -1;
    };
    const sorted = [...matched].sort((a, b) => {
      const [x, y] = [value(a), value(b)];
      const order = x < y ? -1 : x > y ? 1 : b.views - a.views;
      return opts.order === "asc" ? order : -order;
    });
    const totalPages = Math.max(1, Math.ceil(sorted.length / opts.pageSize));
    const page = Math.min(opts.page, totalPages);
    const slice = sorted.slice((page - 1) * opts.pageSize, page * opts.pageSize);
    const visitors = await visitorsPerArticle(f, slice.map((row) => row.id));
    return { data: slice.map((row) => ({ ...row, visitors: visitors ? visitors.get(row.id) ?? 0 : null })), page, pageSize: opts.pageSize, total: sorted.length, totalPages, sort: opts.sort, order: opts.order };
  });
}

export function articleDetail(id: number, f: Filters): Promise<ArticleDetail> {
  return memo(`article:${id}:${JSON.stringify(f)}`, ttlFor(f), async () => {
    const af = { ...f, article: id };
    const pf = await comparable(af, await collectingSince());
    const site = { ...f, article: undefined };
    const [all, byDay, bySource, byReferrer, byDevice, byVisitor, visitors, siteAll, prevAll, prevVisitor, prevVisitors] = await Promise.all([
      totalsBy(af, "all"), totalsBy(af, "day"), totalsBy(af, "source"), totalsBy(af, "referrer"), totalsBy(af, "device"), totalsBy(af, "visitor"), uniqueVisitors(af), totalsBy(site, "all"),
      pf ? totalsBy(pf, "all") : null, pf ? totalsBy(pf, "visitor") : null, pf ? uniqueVisitors(pf) : null,
    ]);
    const totals = totalsOf(sum(all), visitors, byVisitor);
    const siteTotals = totalsOf(sum(siteAll), null, []);
    const [described] = await describe([{ id }]);
    return {
      article: { id, title: described.title, path: described.path, category: described.category, publishedAt: described.publishedAt, image: described.image },
      filters: af,
      totals,
      previous: pf && prevAll ? totalsOf(sum(prevAll), prevVisitors, prevVisitor ?? []) : null,
      series: series(f, byDay),
      sources: breakdown<Source>(bySource, totals.views),
      referrers: breakdown(byReferrer, totals.views).slice(0, 10),
      devices: breakdown<Device>(byDevice, totals.views),
      siteAverage: { avgArticleSeconds: siteTotals.avgArticleSeconds, avgScroll: siteTotals.avgScroll, completionRate: siteTotals.completionRate },
    };
  });
}

export function liveReport(): Promise<LiveReport> {
  return memo("live", 10_000, async () => {
    const live = await liveNow();
    const ids = live.pages.filter((p) => p.k === "article").map((p) => Number(p.key));
    const meta = await getArticleMeta(ids);
    const names = await getCategoryNames([...new Set([...live.categories.map((c) => c.id), ...[...meta.values()].map((m) => m.categories[0])])].filter((id) => id > 0));
    return {
      generatedAt: new Date().toISOString(),
      windowSeconds: LIVE_WINDOW_MS / 1000,
      visitors: live.visitors,
      pages: live.pages.map((p) => {
        const article = p.k === "article" ? meta.get(Number(p.key)) : undefined;
        const path = p.k === "article" ? article?.path ?? null : String(p.key);
        const category = article?.categories[0] ? names.get(article.categories[0]) ?? null : null;
        return { kind: p.k, key: p.key, title: article?.title || (p.k === "article" ? `Article #${p.key}` : decodeURIComponentSafe(String(p.key))), path, category, readers: p.readers };
      }),
      categories: live.categories.filter((c) => c.id > 0).map((c) => ({ id: c.id, name: names.get(c.id) ?? `Category #${c.id}`, readers: c.readers })),
      devices: live.devices,
      sources: live.sources,
      perMinute: live.perMinute,
    };
  });
}

function decodeURIComponentSafe(value: string): string {
  try { return decodeURIComponent(value); } catch { return value; }
}
