"use client";

import Image from "next/image";
import type { Summary } from "@/lib/analytics/report-types";
import { DailyChart, StatCard, change, fullDate, utcDay } from "./charts";
import { delta, metric } from "./analytics/format";
import type { ContentStatus } from "@/lib/content-status";
import Avatar from "./avatar";
import { Icon } from "./icons";
import { cardClass, formatDay, formatDuration, iconProps, Skeleton, tints } from "./ui";

export type OverviewData = {
  /** null for editors: reader analytics are for administrators */
  reader: Summary | null;
  content: ContentStatus | null;
  errors: { reader: string | null; content: string | null };
};

const RANGES = [7, 30, 90];
const barColors = ["#7c3aed", "#a78bfa", "#b8a4fb", "#c9bcfc", "#ddd6fe"];


export function OverviewSkeleton() {
  return <div aria-busy="true" aria-label="Loading overview" className="space-y-5 sm:space-y-6">
    <div className="flex flex-wrap items-start justify-between gap-4"><div className="space-y-3"><Skeleton className="h-6 w-28" /><Skeleton className="h-9 w-56" /><Skeleton className="h-4 w-72 max-w-full" /></div><div className="flex gap-3"><Skeleton className="h-11 w-56" /><Skeleton className="h-11 w-28" /></div></div>
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{Array.from({ length: 4 }, (_, index) => <div className={`${cardClass} flex gap-4`} key={index}><Skeleton className="h-14 w-14 rounded-2xl" /><div className="flex-1 space-y-2.5"><Skeleton className="h-4 w-24" /><Skeleton className="h-8 w-20" /><Skeleton className="h-4 w-28" /></div></div>)}</div>
    <div className="grid gap-5 xl:grid-cols-[minmax(0,1.85fr)_minmax(0,1fr)]">
      <div className="space-y-5"><section className={cardClass}><Skeleton className="h-6 w-36" /><Skeleton className="mt-6 h-52 w-full" /></section><div className="grid gap-5 md:grid-cols-2">{[0, 1].map((key) => <section className={cardClass} key={key}><Skeleton className="h-6 w-36" /><div className="mt-5 space-y-4">{Array.from({ length: 4 }, (_, index) => <Skeleton key={index} className="h-8 w-full" />)}</div></section>)}</div></div>
      <section className={cardClass}><Skeleton className="h-6 w-36" /><div className="mt-5 space-y-4">{Array.from({ length: 5 }, (_, index) => <div className="flex gap-3" key={index}><Skeleton className="h-[52px] w-14 shrink-0 rounded-lg" /><div className="flex-1 space-y-2"><Skeleton className="h-4 w-4/5" /><Skeleton className="h-3 w-3/5" /></div></div>)}</div></section>
    </div>
  </div>;
}

function RangePicker({ days, onChange, label, className = "", children }: { days: number; onChange: (days: number) => void; label: string; className?: string; children: React.ReactNode }) {
  return <label className={`relative flex min-h-11 items-center gap-2.5 rounded-xl border border-slate-200 bg-white px-3.5 text-sm font-medium text-slate-800 shadow-sm transition focus-within:border-violet-500 focus-within:ring-4 focus-within:ring-violet-100 hover:bg-slate-50 ${className}`}>
    {children}
    <svg {...iconProps} strokeWidth={2} className="h-4 w-4 shrink-0 text-slate-500"><path d="M6 9l6 6 6-6" /></svg>
    <select aria-label={label} value={days} onChange={(event) => onChange(Number(event.target.value))} className="absolute inset-0 h-full w-full cursor-pointer opacity-0">
      {RANGES.map((range) => <option key={range} value={range}>Last {range} days</option>)}
    </select>
  </label>;
}

const readerIcons = {
  eye: <Icon name="eye" className="h-6 w-6" />,
  users: <svg {...iconProps} className="h-6 w-6"><circle cx="9" cy="8.5" r="3.2" /><path d="M3 20c0-3.3 2.7-5.5 6-5.5s6 2.2 6 5.5M16 5.6a3.2 3.2 0 010 5.8M18 14.8c1.8.7 3 2.4 3 5.2" /></svg>,
  clock: <Icon name="clock" className="h-6 w-6" />,
  check: <svg {...iconProps} className="h-6 w-6"><circle cx="12" cy="12" r="8.5" /><path d="M8.5 12.2l2.4 2.4 4.6-4.9" /></svg>,
};

type Ranked = { id: number; name: string; value: number; avatar?: string | null };

function RankedList({ title, subtitle, rows, unit, empty, kind }: { title: string; subtitle: string; rows: Ranked[]; unit: string; empty: string; kind: "category" | "author" }) {
  const max = Math.max(...rows.map((row) => row.value), 1);
  return <section className={cardClass}>
    <h2 className="text-lg font-extrabold text-[#12093a]">{title}</h2>
    <p className="mt-1 text-sm text-slate-500">{subtitle}</p>
    {rows.length ? <ul className="mt-5 space-y-3.5">{rows.map((row, index) => <li key={row.id} className="grid grid-cols-[36px_minmax(0,1.5fr)_minmax(0,1fr)_auto] items-center gap-3 text-sm">
      {kind === "author"
        ? <Avatar src={row.avatar} className="h-9 w-9" />
        : <span className={`flex h-9 w-9 items-center justify-center rounded-xl ${tints[index % tints.length]}`}><Icon name="folder" className="h-[18px] w-[18px]" /></span>}
      <span className="break-words font-medium leading-snug text-slate-800">{row.name}</span>
      <span className="h-2 rounded-full bg-violet-100/70"><span className="block h-2 rounded-full" style={{ width: `${Math.max(4, (row.value / max) * 100)}%`, backgroundColor: barColors[index] }} /></span>
      <span className="min-w-8 text-right font-semibold tabular-nums text-slate-800">{row.value.toLocaleString()}<span className="sr-only"> {unit}</span></span>
    </li>)}</ul> : <p className="mt-5 text-sm text-slate-500">{empty}</p>}
  </section>;
}

function ArticleRow({ href, title, meta, image, aside }: { href: string; title: string; meta: string; image?: string | null; aside: React.ReactNode }) {
  return <li>
    <a href={href} target="_blank" rel="noopener noreferrer" className="group flex items-center gap-3 py-3">
      {image
        ? <Image src={image} alt="" width={112} height={104} sizes="56px" className="h-[52px] w-14 shrink-0 rounded-lg bg-slate-100 object-cover" />
        : <span aria-hidden className="flex h-[52px] w-14 shrink-0 items-center justify-center rounded-lg bg-violet-50 text-violet-400"><Icon name="doc" className="h-6 w-6" /></span>}
      <span className="min-w-0 flex-1">
        <span className="line-clamp-2 text-[15px] font-semibold leading-snug text-[#12093a] group-hover:text-violet-700">{title}</span>
        <span className="mt-1 block text-xs text-slate-500">{meta}</span>
      </span>
      {aside}
    </a>
  </li>;
}

function ViewAll({ onClick }: { onClick: () => void }) {
  return <button type="button" onClick={onClick} className="flex min-h-9 shrink-0 items-center gap-1.5 rounded-lg border border-violet-200 px-3 text-xs font-semibold text-violet-700 transition hover:bg-violet-50">View all<Icon name="chevronRight" className="h-3.5 w-3.5" strokeWidth={2.2} /></button>;
}

function ReaderSection({ reader, error, days, onOpenAnalytics }: { reader: Summary | null; error: string | null; days: number; onOpenAnalytics?: () => void }) {
  const t = reader?.totals;
  const previous = reader?.previous ?? undefined;
  const series = reader?.series ?? [];
  const hasActivity = Boolean(t && (t.views > 0 || previous));
  const caption = previous ? `vs previous ${days} days` : "No earlier data to compare";
  return <section aria-labelledby="reader-heading" className="space-y-5 sm:space-y-6">
    <div className="flex flex-wrap items-end justify-between gap-2">
      <div><h2 id="reader-heading" className="text-xl font-extrabold text-[#12093a]">Reader analytics</h2><p className="mt-1 text-sm text-slate-500">Anonymous readers, active reading time and reading depth from this site.</p></div>
      {onOpenAnalytics && <button type="button" onClick={onOpenAnalytics} className="flex min-h-11 items-center gap-2 rounded-xl border border-violet-200 bg-white px-4 text-sm font-semibold text-violet-700 transition hover:bg-violet-50">Open full analytics<Icon name="chevronRight" className="h-4 w-4" /></button>}
    </div>
    {error && <p role="alert" className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">Reader analytics could not be loaded: {error}</p>}
    {reader && !hasActivity && <div className={`${cardClass} text-sm text-slate-600`}><p className="font-semibold text-slate-900">No reader activity recorded yet.</p><p className="mt-1">Views, reading time and completion appear here once readers open pages on the live site.</p></div>}
    {reader && t && hasActivity && <>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Page views" icon={readerIcons.eye} value={t.views.toLocaleString()} trend={delta(t.views, previous?.views)} caption={caption} series={series.map((day) => day.views)} />
        <StatCard label="Unique visitors" icon={readerIcons.users} value={metric(t.visitors)} trend={delta(t.visitors, previous?.visitors)} caption={t.visitors === null ? "Unavailable for this range" : caption} />
        <StatCard label="Avg. time per article" icon={readerIcons.clock} value={metric(t.avgArticleSeconds, formatDuration)} trend={delta(t.avgArticleSeconds, previous?.avgArticleSeconds)} caption={caption} series={series.map((day) => (day.articleViews ? day.articleActiveSeconds / day.articleViews : 0))} />
        <StatCard label="Finished articles" icon={readerIcons.check} value={metric(t.completionRate, (v) => `${v}%`)} trend={delta(t.completionRate, previous?.completionRate)} caption={caption} series={series.map((day) => (day.articleViews ? day.completed / day.articleViews : 0))} />
      </div>
      <div className="grid gap-5 xl:grid-cols-[minmax(0,1.85fr)_minmax(0,1fr)]">
        <section className={`${cardClass} flex flex-col`}>
          <h3 className="text-lg font-extrabold text-[#12093a]">Daily page views</h3><p className="mt-1 text-sm text-slate-500">Page views per day in the last {days} days.</p>
          <DailyChart key={`views-${days}`} points={series.map((day) => ({ date: day.day, value: day.views }))} unit={["view", "views"]} gradientId="readers-fill" emptyText="No page views in this period." fill />
        </section>
        <section className={cardClass}>
          <h3 className="text-lg font-extrabold text-[#12093a]">Most read articles</h3><p className="mt-1 text-sm text-slate-500">Most viewed in the last {days} days</p>
          {reader.topViewed.data.length ? <ul className="mt-3 divide-y divide-slate-100">{reader.topViewed.data.map((article) => <ArticleRow key={article.id} href={article.path ?? "#"} title={article.title} image={article.image} meta={`${article.publishedAt ? `Published ${fullDate.format(utcDay(article.publishedAt))} · ` : ""}${metric(article.avgSeconds, formatDuration)} avg. read · ${metric(article.completionRate, (v) => `${v}%`)} finished`} aside={<span className="flex shrink-0 items-center gap-1.5 text-sm font-semibold tabular-nums text-slate-800"><Icon name="eye" className="h-[18px] w-[18px] text-slate-500" />{article.views.toLocaleString()}<span className="sr-only"> views</span></span>} />)}</ul> : <p className="mt-5 text-sm text-slate-500">No article data yet.</p>}
        </section>
      </div>
    </>}
  </section>;
}

export function Overview({ data, loading, error, days, onDaysChange, onRefresh, onOpenArticles, onOpenAnalytics }: { data: OverviewData | null; loading: boolean; error?: string; days: number; onDaysChange: (days: number) => void; onRefresh: () => void; onOpenArticles: (status?: string) => void; onOpenAnalytics?: () => void }) {
  if (!data && error) return <div className={`${cardClass} space-y-3`} role="alert"><p className="text-sm font-semibold text-slate-900">The overview could not be loaded.</p><p className="text-sm text-slate-500">{error}</p><button type="button" onClick={onRefresh} className="min-h-11 rounded-xl border border-slate-200 px-4 text-sm font-semibold hover:bg-slate-50">Try again</button></div>;
  if (!data) return <OverviewSkeleton />;

  const { content, reader, errors } = data;
  const range = content ?? reader?.filters;
  const rangeText = range ? `${fullDate.format(utcDay(range.from))} – ${fullDate.format(utcDay(range.to))}` : `Last ${days} days`;
  const windowDays = content?.windowDays ?? days;

  return <div aria-busy={loading} className={`space-y-6 transition-opacity sm:space-y-8 ${loading ? "opacity-60" : ""}`}>
    <div className="space-y-5 sm:space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <span className="pill inline-block rounded-md bg-violet-100 px-2.5 py-1.5 text-[11px] font-bold uppercase tracking-[0.12em] text-violet-700">Last {windowDays} days</span>
          <h1 className="mt-3 text-2xl font-extrabold text-[#12093a] sm:text-3xl">Overview</h1>
          <p className="mt-1.5 text-sm text-slate-500">Publishing activity and reader engagement across the site.</p>
        </div>
        <div className="flex w-full items-center gap-3 sm:w-auto">
          <RangePicker days={days} onChange={onDaysChange} label="Date range" className="min-w-0 flex-1 sm:flex-none">
            <Icon name="calendar" className="h-[18px] w-[18px] shrink-0 text-slate-600" />
            <span className="truncate">{rangeText}</span>
          </RangePicker>
          <button type="button" onClick={onRefresh} disabled={loading} className="flex min-h-11 items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-800 shadow-sm transition hover:bg-slate-50 disabled:opacity-60">
            <Icon name="reset" className={`h-[18px] w-[18px] ${loading ? "animate-spin" : ""}`} />Refresh
          </button>
        </div>
      </div>
      {error && <p role="alert" className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>}
      {errors.content && <p role="alert" className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">Publishing activity could not be loaded: {errors.content}</p>}

      {content && <>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard label="Published" icon={<Icon name="doc" className="h-6 w-6" />} value={content.published.total.toLocaleString()} trend={change(content.published.total, content.published.previous)} caption={`vs previous ${windowDays} days`} series={content.published.daily.map((day) => day.count)} onClick={() => onOpenArticles("publish")} />
          <StatCard label="Drafts" icon={<Icon name="pencil" className="h-6 w-6" />} value={content.counts.draft.toLocaleString()} caption="Not yet published" onClick={() => onOpenArticles("draft")} />
          <StatCard label="Pending review" icon={<Icon name="clock" className="h-6 w-6" />} value={content.counts.pending.toLocaleString()} caption="Waiting for approval" onClick={() => onOpenArticles("pending")} />
          <StatCard label="Scheduled" icon={<Icon name="calendar" className="h-6 w-6" />} value={content.counts.future.toLocaleString()} caption="Queued to publish" onClick={() => onOpenArticles("future")} />
        </div>

        <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1.85fr)_minmax(0,1fr)]">
          <div className="space-y-5">
            <section className={cardClass}>
              <h2 className="text-lg font-extrabold text-[#12093a]">Articles published</h2>
              <p className="mt-1 text-sm text-slate-500">Number of articles published per day in the last {windowDays} days.</p>
              <DailyChart key={`published-${windowDays}`} points={content.published.daily.map((day) => ({ date: day.date, value: day.count }))} unit={["article", "articles"]} gradientId="published-fill" emptyText="Nothing was published in this period." />
            </section>
            <div className="grid gap-5 md:grid-cols-2">
              <RankedList title="Top categories" subtitle={`Most articles published in the last ${windowDays} days.`} rows={content.topCategories.map((item) => ({ id: item.id, name: item.name, value: item.count }))} unit="articles" empty="No articles were published in this period." kind="category" />
              <RankedList title="Top authors" subtitle={`Most articles published in the last ${windowDays} days.`} rows={content.topAuthors.map((item) => ({ id: item.id, name: item.name, value: item.count, avatar: item.avatar }))} unit="articles" empty="No articles were published in this period." kind="author" />
            </div>
          </div>

          <section className={cardClass}>
            <div className="flex items-start justify-between gap-3">
              <div><h2 className="text-lg font-extrabold text-[#12093a]">Latest articles</h2><p className="mt-1 text-sm text-slate-500">Most recently published</p></div>
              <ViewAll onClick={() => onOpenArticles("publish")} />
            </div>
            {content.latest.length ? <ul className="mt-3 divide-y divide-slate-100">{content.latest.map((article) => <ArticleRow key={article.id} href={article.path} title={article.title} image={article.imageUrl} meta={`Published ${formatDay(article.date)}${article.author ? ` · ${article.author}` : ""}`} aside={<Avatar src={article.authorAvatar} className="h-8 w-8" />} />)}</ul> : <p className="mt-5 text-sm text-slate-500">No articles yet.</p>}
          </section>
        </div>
      </>}
    </div>

    {(reader || errors.reader) && <ReaderSection reader={reader} error={errors.reader} days={windowDays} onOpenAnalytics={onOpenAnalytics} />}
  </div>;
}
