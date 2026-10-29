"use client";

import { useCallback, useEffect, useState } from "react";
import { Icon } from "../icons";
import { Skeleton, cardClass, type Category } from "../ui";
import { DailyChart } from "../charts";
import { fetchSummary, type FilterState } from "./api";
import { DEVICE_LABELS, KIND_LABELS, SOURCE_LABELS, compact, delta, duration, longDay, metric, percent, shortDuration, viewCount } from "./format";
import { ArticleList, BarList, EmptyNote, ErrorNote, ListSkeleton, Panel, SplitBar, Stat, TEAL, VIOLET, articleFigures } from "./parts";
import FilterBar from "./FilterBar";
import LivePanel from "./LivePanel";
import Paged from "./Paged";
import ArticleTable from "./ArticleTable";
import ArticleDrawer from "./ArticleDrawer";
import type { Summary } from "@/lib/analytics/report-types";

function SummarySkeleton() {
  return <div aria-busy="true" aria-label="Loading analytics" className="space-y-5">
    <div className="grid gap-5 xl:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">{[0, 1].map((i) => <div key={i} className={cardClass}><Skeleton className="h-6 w-56" /><Skeleton className="mt-2 h-4 w-72 max-w-full" /><ListSkeleton rows={6} /></div>)}</div>
    <div className={cardClass}><Skeleton className="h-6 w-32" /><div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">{Array.from({ length: 8 }, (_, i) => <Skeleton key={i} className="h-20 w-full rounded-xl" />)}</div></div>
  </div>;
}

/** The Analytics tab: what readers open, how long they actually read, how far they get and where they come from. */
export default function AnalyticsPage({ categories }: { categories: Category[] }) {
  const [filters, setFilters] = useState<FilterState>({ preset: "30" });
  const [attempt, setAttempt] = useState(0);
  const [data, setData] = useState<Summary | null>(null);
  const [settled, setSettled] = useState<{ key: string; error: string } | null>(null);
  const [article, setArticle] = useState<number | null>(null);
  const key = JSON.stringify([filters, attempt]);

  useEffect(() => {
    const controller = new AbortController();
    fetchSummary((JSON.parse(key) as [FilterState])[0], controller.signal)
      .then((summary) => { setData(summary); setSettled({ key, error: "" }); })
      .catch((reason) => { if (!controller.signal.aborted) setSettled({ key, error: reason instanceof Error ? reason.message : "Could not load analytics." }); });
    return () => controller.abort();
  }, [key]);

  const loading = settled?.key !== key;
  const error = loading ? "" : settled?.error ?? "";
  const update = useCallback((next: FilterState) => setFilters(next), []);
  const closeArticle = useCallback(() => setArticle(null), []);
  const toggle = (field: "category" | "device" | "source", value: string | number) => setFilters((current) => ({ ...current, [field]: current[field] === value ? undefined : value }));

  const t = data?.totals;
  const p = data?.previous ?? undefined;
  const compareNote = data?.previous ? "vs previous period" : "No earlier data to compare";
  const series = data?.series ?? [];
  const ARTICLES: [string, string] = ["article", "articles"];

  return <div className="space-y-5 sm:space-y-6">
    <div className="flex flex-wrap items-end justify-between gap-3">
      <div>
        <p className="text-sm font-semibold text-violet-700">Readers</p>
        <h1 className="text-2xl font-extrabold text-[#12093a] sm:text-3xl">Analytics</h1>
        <p className="mt-1 max-w-2xl text-sm text-slate-500">What readers open, how long they actively read, how far down they get and where they come from. Anonymous, from this site only.</p>
      </div>
      <div className="flex items-center gap-3 text-xs text-slate-500">
        {data && <span>{data.collectingSince ? `Collecting since ${longDay(data.collectingSince)}` : "Not collecting yet"} · updated {new Date(data.generatedAt).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}</span>}
        <button type="button" onClick={() => setAttempt((n) => n + 1)} disabled={loading} className="flex min-h-11 items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-800 transition hover:bg-slate-50 disabled:opacity-60"><Icon name="reset" className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />Refresh</button>
      </div>
    </div>

    <FilterBar filters={filters} categories={categories} onChange={update} />

    {error && <ErrorNote message={error} onRetry={() => setAttempt((n) => n + 1)} />}
    {!data && !error && <SummarySkeleton />}

    {data && t && <div className={`space-y-5 transition-opacity sm:space-y-6 ${loading ? "opacity-60" : ""}`} aria-busy={loading}>
      {!data.collectingSince && <div className={`${cardClass} text-sm text-slate-600`}><p className="font-semibold text-slate-900">No reader data yet.</p><p className="mt-1">Numbers appear here as soon as people read pages on the live site. Staff signed in to this admin, bots, and browsers that ask not to be tracked are never counted.</p></div>}
      {data.collectingSince && data.filters.from < data.collectingSince && <p className="rounded-xl bg-violet-50 px-4 py-3 text-sm text-violet-900">Collection began on {longDay(data.collectingSince)}, so days before that show no readers. That is a gap in the record, not a quiet spell.</p>}

      {/* the question this page exists for: which articles and categories get the reading time */}
      <div className="grid gap-5 xl:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
        <Panel title="Articles readers spend time on" subtitle="Total active reading time in this period. Select one for its full breakdown.">
          <Paged list="byTime" first={data.topByTime} filters={data.filters} label="Articles readers spend time on" noun={ARTICLES}>{(rows, start) =>
            <ArticleList rows={rows} start={start} onOpen={setArticle} empty="No article has been read in this period yet."
              value={(row) => <><span className="font-semibold">{duration(row.activeSeconds)}</span><span className="block text-xs text-slate-500">{viewCount(row.views)} · {metric(row.avgSeconds, duration)} avg</span></>} />}
          </Paged>
        </Panel>
        <Panel title="Categories readers spend time on" subtitle="Active reading time on each category's articles. Select one to filter. An article in two categories counts in both.">
          {data.categories.total ? <Paged list="categories" first={data.categories} filters={data.filters} label="Categories readers spend time on" noun={["category", "categories"]}>{(rows) =>
            <BarList label="Article reading time by category" scale={data.categories.data[0]?.activeSeconds} active={filters.category ? String(filters.category) : undefined} onPick={(id) => toggle("category", Number(id))}
              rows={rows.map((c) => ({ id: String(c.id), label: c.name, value: c.activeSeconds, display: duration(c.activeSeconds), detail: `${percent(c.timeShare)} of reading time · ${viewCount(c.views)} · ${metric(c.avgSeconds, duration)} avg` }))} />}
          </Paged> : <EmptyNote>No article has been read in this period yet.</EmptyNote>}
        </Panel>
      </div>

      <LivePanel onOpenArticle={setArticle} />

      <Panel title="Site totals" subtitle={`Every page in this period${data.previous ? ", against the period before" : ""}.`}>
        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Stat label="Page views" value={compact(t.views)} change={delta(t.views, p?.views)} note={compareNote} />
          <Stat label="Unique visitors" value={metric(t.visitors, compact)} change={t.visitors === null ? null : delta(t.visitors, p?.visitors)} note={t.visitors === null ? "Unavailable: part of this range is older than the 400 days raw views are kept" : compareNote} />
          <Stat label="Total reading time" value={duration(t.activeSeconds)} change={delta(t.activeSeconds, p?.activeSeconds)} note={compareNote} />
          <Stat label="Avg. time per article" value={metric(t.avgArticleSeconds, duration)} change={delta(t.avgArticleSeconds, p?.avgArticleSeconds)} note={t.avgArticleSeconds === null ? "No article views in this period" : compareNote} />
          <Stat label="Finished articles" value={metric(t.completionRate, percent)} change={delta(t.completionRate, p?.completionRate)} note={t.completionRate === null ? "No article views in this period" : "Views that scrolled to 90%"} />
          <Stat label="Avg. scroll depth" value={metric(t.avgScroll, percent)} change={delta(t.avgScroll, p?.avgScroll)} note={t.avgScroll === null ? "No article views in this period" : "How far down articles get read"} />
          <Stat label="Engagement rate" value={metric(t.engagementRate, percent)} change={delta(t.engagementRate, p?.engagementRate)} note={t.bounceRate === null ? "No sessions in this period" : `Bounce rate ${percent(t.bounceRate)} · ${metric(t.pagesPerSession)} pages per session`} />
          <Stat label="Returning visitors" value={metric(t.returningVisitors, compact)} change={t.returningVisitors === null ? null : delta(t.returningVisitors, p?.returningVisitors)} note={t.newVisitors === null ? "Unavailable for this range" : `${compact(t.newVisitors)} new visitors`} />
        </div>
      </Panel>

      <div className="grid gap-5 xl:grid-cols-2">
        <Panel title="Page views per day" subtitle="Every page, IST days.">
          <DailyChart key={`views-${key}`} points={series.map((s) => ({ date: s.day, value: s.views }))} unit={["view", "views"]} gradientId="analytics-views" emptyText="No page views in this period." />
        </Panel>
        <Panel title="Reading time per day" subtitle="Active time only: a hidden tab or an idle reader does not count.">
          <DailyChart key={`time-${key}`} points={series.map((s) => ({ date: s.day, value: s.activeSeconds }))} unit={["second", "seconds"]} gradientId="analytics-time" emptyText="No reading time in this period." format={duration} tick={shortDuration} />
        </Panel>
      </div>

      <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-4">
        <Panel title="What people open" subtitle="Page views by kind of page.">
          {data.kinds.length ? <BarList label="Page views by kind of page" rows={data.kinds.map((k) => ({ id: k.id, label: KIND_LABELS[k.id] ?? k.id, value: k.views, display: compact(k.views), detail: percent(k.share) }))} /> : <EmptyNote>No page views in this period.</EmptyNote>}
        </Panel>
        <Panel title="Traffic sources" subtitle="Where each view came from. Select one to filter.">
          {data.sources.length ? <BarList label="Page views by traffic source" active={filters.source} onPick={(id) => toggle("source", id)} rows={data.sources.map((s) => ({ id: s.id, label: SOURCE_LABELS[s.id] ?? s.id, value: s.views, display: compact(s.views), detail: percent(s.share) }))} /> : <EmptyNote>No page views in this period.</EmptyNote>}
        </Panel>
        <Panel title="Referring sites" subtitle="Search engines, social networks and other sites that sent readers.">
          {data.referrers.total ? <Paged list="referrers" first={data.referrers} filters={data.filters} label="Referring sites" noun={["site", "sites"]}>{(rows) =>
            <BarList label="Page views by referring site" scale={data.referrers.data[0]?.views} rows={rows.map((r) => ({ id: r.id, label: r.id, value: r.views, display: compact(r.views), detail: percent(r.share) }))} />}
          </Paged> : <EmptyNote>No visits from other sites in this period.</EmptyNote>}
        </Panel>
        <Panel title="Devices and visitors" subtitle="Select a device to filter.">
          {data.devices.length ? <BarList label="Page views by device" active={filters.device} onPick={(id) => toggle("device", id)} rows={data.devices.map((d) => ({ id: d.id, label: DEVICE_LABELS[d.id] ?? d.id, value: d.views, display: compact(d.views), detail: percent(d.share) }))} /> : <EmptyNote>No page views in this period.</EmptyNote>}
          <p className="mt-5 text-xs font-semibold uppercase tracking-wide text-slate-500">Page views by visitor</p>
          <SplitBar label="Page views by new and returning visitors" parts={[{ label: "New", value: t.newViews, color: TEAL }, { label: "Returning", value: t.returningViews, color: VIOLET }]} />
        </Panel>
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <Panel title="Most read" subtitle="Articles with the most views.">
          <Paged list="viewed" first={data.topViewed} filters={data.filters} label="Most read" noun={ARTICLES}>{(rows, start) => <ArticleList rows={rows} start={start} onOpen={setArticle} empty="No article views in this period." value={(row) => <><span className="font-semibold">{compact(row.views)}</span><span className="block text-xs text-slate-500">views</span></>} />}</Paged>
        </Panel>
        <Panel title="Most engaging" subtitle={`Longest average reading time, among articles with ${data.insights.minViews}+ views.`}>
          <Paged list="engaging" first={data.topEngaging} filters={data.filters} label="Most engaging" noun={ARTICLES}>{(rows, start) => <ArticleList rows={rows} start={start} onOpen={setArticle} empty={`No article has ${data.insights.minViews} views in this period yet.`} value={(row) => <><span className="font-semibold">{metric(row.avgSeconds, duration)}</span><span className="block text-xs text-slate-500">avg. read</span></>} />}</Paged>
        </Panel>
      </div>

      <section aria-labelledby="insights-heading" className="space-y-3">
        <div><h2 id="insights-heading" className="text-lg font-extrabold text-[#12093a]">Insights</h2><p className="text-sm text-slate-500">Drawn from {data.insights.eligible.toLocaleString("en")} {data.insights.eligible === 1 ? "article" : "articles"} with at least {data.insights.minViews} views{data.previous ? ", compared with the previous period" : ""}.</p></div>
        <div className="grid gap-5 md:grid-cols-2">
          <Panel title="Trending" subtitle="Biggest rise in views against the previous period.">
            <Paged list="trending" first={data.insights.trending} filters={data.filters} label="Trending" noun={ARTICLES}>{(rows, start) => <ArticleList rows={rows} start={start} onOpen={setArticle} empty={data.previous ? "Nothing is rising sharply." : "Needs a previous period with data to compare."} value={(row) => <span className="font-semibold text-emerald-700">+{compact(row.views - row.previousViews)}</span>} />}</Paged>
          </Panel>
          <Panel title="Losing readers" subtitle="Biggest drop in views against the previous period.">
            <Paged list="declining" first={data.insights.declining} filters={data.filters} label="Losing readers" noun={ARTICLES}>{(rows, start) => <ArticleList rows={rows} start={start} onOpen={setArticle} empty={data.previous ? "Nothing is falling sharply." : "Needs a previous period with data to compare."} value={(row) => <span className="font-semibold text-red-700">−{compact(row.previousViews - row.views)}</span>} />}</Paged>
          </Panel>
          <Panel title="Opened but skimmed" subtitle="Many views, under half the typical reading time: check the headline promise, the opening or the length.">
            <Paged list="skimmed" first={data.insights.skimmed} filters={data.filters} label="Opened but skimmed" noun={ARTICLES}>{(rows, start) => <ArticleList rows={rows} start={start} onOpen={setArticle} empty="No article stands out as skimmed, or there are not enough articles to judge yet." value={(row) => <span className="text-xs text-slate-600">{articleFigures(row)}</span>} />}</Paged>
          </Panel>
          <Panel title="Hidden gems" subtitle="Fewer views, top-quarter reading time: worth promoting.">
            <Paged list="gems" first={data.insights.gems} filters={data.filters} label="Hidden gems" noun={ARTICLES}>{(rows, start) => <ArticleList rows={rows} start={start} onOpen={setArticle} empty="No hidden gems yet, or there are not enough articles to judge." value={(row) => <span className="text-xs text-slate-600">{articleFigures(row)}</span>} />}</Paged>
          </Panel>
        </div>
      </section>

      <ArticleTable filters={filters} onOpen={setArticle} />
    </div>}

    {article !== null && <ArticleDrawer id={article} filters={filters} onClose={closeArticle} />}
  </div>;
}
