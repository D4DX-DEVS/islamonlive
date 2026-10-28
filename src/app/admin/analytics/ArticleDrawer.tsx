"use client";

import { useEffect, useRef, useState } from "react";
import { Icon } from "../icons";
import { DailyChart } from "../charts";
import { fetchArticle, type FilterState } from "./api";
import { DEVICE_LABELS, SOURCE_LABELS, compact, delta, duration, longDay, metric, percent, shortDuration } from "./format";
import { BarList, EmptyNote, ErrorNote, ListSkeleton, Panel, ScrollFunnel, SplitBar, Stat, TEAL, VIOLET } from "./parts";
import type { ArticleDetail, Metric } from "@/lib/analytics/report-types";

/** "12% above the site average" style note; nothing when either side is unknown. */
function versus(value: Metric, average: Metric, format: (n: number) => string): string | undefined {
  if (value === null || average === null) return undefined;
  if (value === average) return "Same as the site average";
  return `Site average ${format(average)}`;
}

function change(current: Metric, previous: Metric | undefined): string | undefined {
  const pct = delta(current, previous);
  return pct === null ? undefined : `${pct > 0 ? "+" : ""}${pct}% vs previous period`;
}

/** One article's breakdown for the current filters, in a panel over the page. */
export default function ArticleDrawer({ id, filters, onClose }: { id: number; filters: FilterState; onClose: () => void }) {
  const [state, setState] = useState<{ key: string; detail?: ArticleDetail; error?: string } | null>(null);
  const [attempt, setAttempt] = useState(0);
  const closeRef = useRef<HTMLButtonElement>(null);
  const key = JSON.stringify([id, filters, attempt]);

  useEffect(() => {
    const controller = new AbortController();
    const [articleId, filterState] = JSON.parse(key) as [number, FilterState];
    fetchArticle(articleId, filterState, controller.signal)
      .then((detail) => setState({ key, detail }))
      .catch((reason) => { if (!controller.signal.aborted) setState({ key, error: reason instanceof Error ? reason.message : "Could not load this article's numbers." }); });
    return () => controller.abort();
  }, [key]);

  useEffect(() => {
    closeRef.current?.focus();
    const onKey = (event: KeyboardEvent) => { if (event.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  const current = state?.key === key ? state : null;
  const d = current?.detail;
  const t = d?.totals;
  const p = d?.previous ?? undefined;

  return <div className="fixed inset-0 z-[120] flex justify-end bg-slate-900/40" onClick={onClose}>
    <div role="dialog" aria-modal="true" aria-labelledby="article-analytics-title" onClick={(e) => e.stopPropagation()} className="flex h-full w-full max-w-3xl flex-col overflow-y-auto bg-[#f7f6fc] shadow-2xl">
      <div className="sticky top-0 z-10 flex items-start gap-3 border-b border-slate-200 bg-white px-4 py-4 sm:px-6">
        <div className="min-w-0 flex-1">
          <p className="text-xs font-semibold uppercase tracking-wide text-violet-700">Article analytics</p>
          <h2 id="article-analytics-title" className="mt-1 line-clamp-2 text-lg font-extrabold text-[#12093a] sm:text-xl">{d?.article.title ?? "Loading…"}</h2>
          {d && <p className="mt-1 text-sm text-slate-500">{[d.article.category, d.article.publishedAt && `Published ${longDay(d.article.publishedAt)}`].filter(Boolean).join(" · ")}{d.article.path && <> · <a href={d.article.path} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 font-semibold text-violet-700 hover:underline">Open article<Icon name="external" className="h-3.5 w-3.5" /></a></>}</p>}
        </div>
        <button ref={closeRef} type="button" aria-label="Close" onClick={onClose} className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-white transition hover:bg-slate-50"><Icon name="close" className="h-5 w-5" /></button>
      </div>
      <div className="space-y-4 p-4 sm:space-y-5 sm:p-6">
        {current?.error && <ErrorNote message={current.error} onRetry={() => setAttempt((n) => n + 1)} />}
        {!current && <ListSkeleton rows={6} />}
        {d && t && <>
          {t.views === 0 && <EmptyNote>This article has no views in this period with these filters.</EmptyNote>}
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
            <Stat label="Views" value={compact(t.views)} note={change(t.views, p?.views)} />
            <Stat label="Unique visitors" value={metric(t.visitors, compact)} note={t.visitors === null ? "Older than the 400 days raw views are kept" : change(t.visitors, p?.visitors)} />
            <Stat label="Total reading time" value={duration(t.articleActiveSeconds)} note={change(t.articleActiveSeconds, p?.articleActiveSeconds)} />
            <Stat label="Avg. reading time" value={metric(t.avgArticleSeconds, duration)} note={versus(t.avgArticleSeconds, d.siteAverage.avgArticleSeconds, duration)} />
            <Stat label="Avg. scroll depth" value={metric(t.avgScroll, percent)} note={versus(t.avgScroll, d.siteAverage.avgScroll, percent)} />
            <Stat label="Finished (90%+)" value={metric(t.completionRate, percent)} note={versus(t.completionRate, d.siteAverage.completionRate, percent)} />
          </div>
          <Panel title="Where readers stop" subtitle="Views that scrolled at least this far down the article.">
            <ScrollFunnel reached={t.reached} views={t.articleViews} />
          </Panel>
          <Panel title="Views per day">
            <DailyChart key={`a-views-${key}`} points={d.series.map((point) => ({ date: point.day, value: point.articleViews }))} unit={["view", "views"]} gradientId="article-views-fill" emptyText="No views in this period." />
          </Panel>
          <Panel title="Reading time per day" subtitle="Active reading time, all readers together.">
            <DailyChart key={`a-time-${key}`} points={d.series.map((point) => ({ date: point.day, value: point.articleActiveSeconds }))} unit={["second", "seconds"]} gradientId="article-time-fill" emptyText="No reading time in this period." format={duration} tick={shortDuration} />
          </Panel>
          <div className="grid gap-4 sm:grid-cols-2">
            <Panel title="Traffic sources">
              {d.sources.length ? <BarList label="Views by traffic source" rows={d.sources.map((s) => ({ id: s.id, label: SOURCE_LABELS[s.id] ?? s.id, value: s.views, display: compact(s.views), detail: percent(s.share) }))} /> : <EmptyNote>No views yet.</EmptyNote>}
              {d.referrers.length > 0 && <><p className="mt-4 text-xs font-semibold uppercase tracking-wide text-slate-500">Top referring sites</p><BarList label="Views by referring site" rows={d.referrers.map((r) => ({ id: r.id, label: r.id, value: r.views, display: compact(r.views) }))} /></>}
            </Panel>
            <Panel title="Devices and visitors">
              {d.devices.length ? <BarList label="Views by device" rows={d.devices.map((s) => ({ id: s.id, label: DEVICE_LABELS[s.id] ?? s.id, value: s.views, display: compact(s.views), detail: percent(s.share) }))} /> : <EmptyNote>No views yet.</EmptyNote>}
              <SplitBar label="Views by new and returning visitors" parts={[{ label: "New", value: t.newViews, color: TEAL }, { label: "Returning", value: t.returningViews, color: VIOLET }]} />
            </Panel>
          </div>
        </>}
      </div>
    </div>
  </div>;
}
