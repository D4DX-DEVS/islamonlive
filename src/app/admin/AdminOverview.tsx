"use client";

import { KeyboardEvent, PointerEvent, useState } from "react";
import Image from "next/image";
import type { AnalyticsSummary } from "@/lib/analytics";
import type { ContentStatus } from "@/lib/content-status";
import Avatar from "./avatar";
import { Icon } from "./icons";
import { cardClass, formatDay, formatDuration, iconProps, Skeleton, tints } from "./ui";

export type OverviewData = {
  reader: AnalyticsSummary | null;
  content: ContentStatus | null;
  errors: { reader: string | null; content: string | null };
};

const RANGES = [7, 30, 90];
const barColors = ["#7c3aed", "#a78bfa", "#b8a4fb", "#c9bcfc", "#ddd6fe"];

const dayMonth = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
const fullDate = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
const utcDay = (iso: string) => new Date(`${iso.slice(0, 10)}T00:00:00Z`);

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

function Sparkline({ values }: { values: number[] }) {
  const recent = values.slice(-7);
  const max = Math.max(...recent, 0);
  return <span aria-hidden className="hidden h-12 shrink-0 items-end gap-[3px] self-end @[15rem]:flex">
    {recent.map((value, index) => <span key={index} className="w-1 rounded-full" style={{ height: `${max ? Math.max(12, (value / max) * 100) : 12}%`, backgroundColor: max ? "#c4b5fd" : "#ede9fe", opacity: 0.45 + (index / Math.max(recent.length - 1, 1)) * 0.55 }} />)}
  </span>;
}

/** Relative change against the previous window; null when there is nothing to compare with. */
function change(current: number, previous: number | undefined): number | null {
  return previous ? Math.round(((current - previous) / previous) * 100) : null;
}

function Trend({ pct }: { pct: number | null }) {
  if (pct === null) return <p className="mt-1 text-sm font-semibold text-slate-400" title="No data in the previous period">—</p>;
  const up = pct > 0;
  const tone = pct === 0 ? "text-slate-500" : up ? "text-emerald-600" : "text-red-600";
  return <p className={`mt-1 flex items-center gap-1 text-sm font-semibold ${tone}`}>
    {pct !== 0 && <svg {...iconProps} strokeWidth={2.2} className="h-4 w-4"><path d={up ? "M12 19V5M6 11l6-6 6 6" : "M12 5v14M6 13l6 6 6-6"} /></svg>}
    {Math.abs(pct)}%<span className="sr-only">{pct === 0 ? " no change" : up ? " increase" : " decrease"}</span>
  </p>;
}

const readerIcons = {
  eye: <Icon name="eye" className="h-6 w-6" />,
  users: <svg {...iconProps} className="h-6 w-6"><circle cx="9" cy="8.5" r="3.2" /><path d="M3 20c0-3.3 2.7-5.5 6-5.5s6 2.2 6 5.5M16 5.6a3.2 3.2 0 010 5.8M18 14.8c1.8.7 3 2.4 3 5.2" /></svg>,
  clock: <Icon name="clock" className="h-6 w-6" />,
  check: <svg {...iconProps} className="h-6 w-6"><circle cx="12" cy="12" r="8.5" /><path d="M8.5 12.2l2.4 2.4 4.6-4.9" /></svg>,
};

type StatCardProps = {
  label: string;
  value: string;
  icon: React.ReactNode;
  /** A percentage, null when there is nothing to compare with, undefined for a plain current total. */
  trend?: number | null;
  caption: string;
  series?: number[];
  onClick?: () => void;
};

function StatCard({ label, value, icon, trend, caption, series, onClick }: StatCardProps) {
  const body = <>
    <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-violet-50 text-violet-600">{icon}</span>
    <span className="min-w-0 flex-1">
      <span className="block text-sm text-slate-500">{label}</span>
      <span className="mt-0.5 block text-[28px] font-extrabold leading-tight text-[#12093a]">{value}</span>
      {trend !== undefined && <Trend pct={trend} />}
      <span className={`block text-xs text-slate-500 ${trend === undefined ? "mt-1" : ""}`}>{caption}</span>
    </span>
    {series && <Sparkline values={series} />}
  </>;
  const className = `${cardClass} @container flex items-start gap-3.5 !p-4`;
  return onClick
    ? <button type="button" onClick={onClick} className={`${className} text-left transition hover:border-violet-200`}>{body}</button>
    : <div className={className}>{body}</div>;
}

function niceScale(max: number): { top: number; step: number } {
  if (max <= 0) return { top: 4, step: 1 };
  const raw = max / 5;
  const magnitude = 10 ** Math.floor(Math.log10(raw));
  // Whole-number ticks only (these are counts), with a step of headroom above the peak.
  const step = Math.max(1, ([1, 2, 5, 10].find((multiple) => multiple * magnitude >= raw) ?? 10) * magnitude);
  return { top: (Math.floor(max / step) + 1) * step, step };
}

/** Smooth line through the points, control points clamped so it never dips below the baseline. */
function smoothPath(points: [number, number][], baseline: number): string {
  return points.map(([x, y], index) => {
    if (index === 0) return `M${x} ${y}`;
    const [x0, y0] = points[index - 2] ?? points[index - 1];
    const [x1, y1] = points[index - 1];
    const [x3, y3] = points[index + 1] ?? points[index];
    const clamp = (value: number) => Math.min(baseline, Math.max(0, value));
    return `C${x1 + (x - x0) / 6} ${clamp(y1 + (y - y0) / 6)} ${x - (x3 - x1) / 6} ${clamp(y - (y3 - y1) / 6)} ${x} ${y}`;
  }).join(" ");
}

type Point = { date: string; value: number };

function DailyChart({ points, unit, gradientId, emptyText }: { points: Point[]; unit: [string, string]; gradientId: string; emptyText: string }) {
  const [hover, setHover] = useState<number | null>(null);
  const count = points.length;
  const maxValue = Math.max(...points.map((point) => point.value), 0);
  const peak = maxValue ? points.findIndex((point) => point.value === maxValue) : null;
  const active = hover ?? peak;
  const { top, step } = niceScale(maxValue);
  const ticks = Array.from({ length: top / step + 1 }, (_, index) => index * step);
  const W = 1000;
  const H = 300;
  const xPercent = (index: number) => (count > 1 ? (index / (count - 1)) * 100 : 50);
  const yPercent = (value: number) => 100 - (value / top) * 100;
  const coordinates = points.map((point, index): [number, number] => [xPercent(index) * (W / 100), (yPercent(point.value) / 100) * H]);
  const line = smoothPath(coordinates, H);
  const labelIndexes = [...new Set(Array.from({ length: Math.min(count, 7) }, (_, index) => Math.round((index * (count - 1)) / Math.max(Math.min(count, 7) - 1, 1))))];
  const label = (value: number) => `${value.toLocaleString()} ${value === 1 ? unit[0] : unit[1]}`;

  function moveTo(event: PointerEvent<HTMLDivElement>) {
    const rect = event.currentTarget.getBoundingClientRect();
    setHover(Math.max(0, Math.min(count - 1, Math.round(((event.clientX - rect.left) / rect.width) * (count - 1)))));
  }
  function onKey(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
    event.preventDefault();
    setHover(Math.max(0, Math.min(count - 1, (active ?? 0) + (event.key === "ArrowRight" ? 1 : -1))));
  }

  const point = active === null ? null : points[active];
  // Near the top of the plot the tooltip would sit over the heading, so it drops below the point instead.
  const tooltipBelow = point ? yPercent(point.value) < 28 : false;
  return <div className="mt-5 flex gap-3 pr-5">
    <div aria-hidden className="relative h-52 w-8 shrink-0 text-right text-xs text-slate-500 lg:h-56">
      {ticks.map((tick) => <span key={tick} className="absolute right-0 -translate-y-1/2" style={{ top: `${yPercent(tick)}%` }}>{tick}</span>)}
    </div>
    <div className="min-w-0 flex-1">
      <div role="group" aria-label={`${unit[1]} per day. ${maxValue ? `Peak ${label(maxValue)} on ${fullDate.format(utcDay(points[peak!].date))}.` : "None yet."} Use the left and right arrow keys to inspect a day.`} tabIndex={0} onPointerMove={moveTo} onPointerDown={moveTo} onPointerLeave={() => setHover(null)} onKeyDown={onKey} onBlur={() => setHover(null)} className="relative h-52 touch-pan-y rounded-md outline-none focus-visible:ring-2 focus-visible:ring-violet-300 lg:h-56">
        <svg aria-hidden viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="absolute inset-0 h-full w-full overflow-visible">
          <defs><linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#8b5cf6" stopOpacity=".32" /><stop offset="1" stopColor="#8b5cf6" stopOpacity="0" /></linearGradient></defs>
          {ticks.map((tick) => <line key={tick} x1="0" x2={W} y1={(yPercent(tick) / 100) * H} y2={(yPercent(tick) / 100) * H} stroke="#eceaf5" strokeWidth="1" vectorEffect="non-scaling-stroke" />)}
          {labelIndexes.map((index) => <line key={index} x1={coordinates[index][0]} x2={coordinates[index][0]} y1="0" y2={H} stroke="#f1eff8" strokeWidth="1" vectorEffect="non-scaling-stroke" />)}
          {maxValue > 0 && <>
            <path d={`${line} L${W} ${H} L0 ${H} Z`} fill={`url(#${gradientId})`} />
            <path d={line} fill="none" stroke="#7c3aed" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
          </>}
        </svg>
        {maxValue === 0 && <p className="absolute inset-0 flex items-center justify-center px-6 text-center text-sm text-slate-500"><span className="rounded-lg bg-white px-3 py-1.5">{emptyText}</span></p>}
        {point && maxValue > 0 && <>
          <span aria-hidden className="pointer-events-none absolute h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white bg-violet-600 shadow-[0_0_0_2px_#7c3aed]" style={{ left: `${xPercent(active!)}%`, top: `${yPercent(point.value)}%` }} />
          <span className={`pointer-events-none absolute -translate-x-1/2 whitespace-nowrap rounded-lg bg-violet-600 px-3 py-1.5 text-center text-xs font-semibold text-white shadow-lg ${tooltipBelow ? "" : "-translate-y-full"}`} style={{ left: `clamp(48px, ${xPercent(active!)}%, calc(100% - 48px))`, top: `calc(${yPercent(point.value)}% ${tooltipBelow ? "+" : "-"} 12px)` }}>
            {label(point.value)}<span className="block font-normal text-violet-200">{fullDate.format(utcDay(point.date))}</span>
          </span>
        </>}
      </div>
      <div aria-hidden className="relative mt-2 h-5 text-xs text-slate-500">
        {labelIndexes.map((index, position) => <span key={index} className={`absolute -translate-x-1/2 whitespace-nowrap ${position % 2 ? "max-sm:hidden" : ""}`} style={{ left: `${xPercent(index)}%` }}>{dayMonth.format(utcDay(points[index].date))}</span>)}
      </div>
    </div>
  </div>;
}

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

function ReaderSection({ reader, error, days }: { reader: AnalyticsSummary | null; error: string | null; days: number }) {
  const { previous, daily } = reader ?? { previous: null, daily: [] };
  const hasActivity = Boolean(reader && (reader.views > 0 || previous));
  const storage = reader?.storage;
  return <section aria-labelledby="reader-heading" className="space-y-5 sm:space-y-6">
    <div className="flex flex-wrap items-end justify-between gap-2">
      <div><h2 id="reader-heading" className="text-xl font-extrabold text-[#12093a]">Reader analytics</h2><p className="mt-1 text-sm text-slate-500">Anonymous readers, article views and reading depth from this site.</p></div>
      {storage && <span className={`inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-semibold ${storage.ok ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-800"}`}><span aria-hidden className={`h-2 w-2 rounded-full ${storage.ok ? "bg-emerald-500" : "bg-amber-500"}`} />{storage.ok ? `Tracking on · ${storage.kind === "redis" ? "Redis" : "local file"}` : "Tracking not saving"}</span>}
    </div>
    {error && <p role="alert" className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">Reader analytics could not be loaded: {error}</p>}
    {reader && storage && !storage.ok && <p role="alert" className="rounded-xl bg-amber-50 px-4 py-3 text-sm leading-relaxed text-amber-900">Reader events can&apos;t be saved here: {storage.message} Connect an Upstash Redis database (<code className="rounded bg-amber-100 px-1">UPSTASH_REDIS_REST_URL</code> and <code className="rounded bg-amber-100 px-1">UPSTASH_REDIS_REST_TOKEN</code>) to record them.</p>}
    {reader && !hasActivity && (!storage || storage.ok) && <div className={`${cardClass} text-sm text-slate-600`}><p className="font-semibold text-slate-900">No reader activity recorded yet.</p><p className="mt-1">Views, reading time and completion appear here once readers open articles on the live site{storage?.kind === "file" ? " (this environment saves events to a local file, so only visits to this server are counted)" : ""}.</p></div>}
    {reader && hasActivity && <>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Views" icon={readerIcons.eye} value={reader.views.toLocaleString()} trend={change(reader.views, previous?.views)} caption={`vs previous ${days} days`} series={daily.map((day) => day.views)} />
        <StatCard label="Unique readers" icon={readerIcons.users} value={reader.uniqueReaders.toLocaleString()} trend={change(reader.uniqueReaders, previous?.uniqueReaders)} caption={`vs previous ${days} days`} series={daily.map((day) => day.uniqueReaders)} />
        <StatCard label="Avg. reading time" icon={readerIcons.clock} value={formatDuration(reader.averageReadingSeconds)} trend={change(reader.averageReadingSeconds, previous?.averageReadingSeconds)} caption={`vs previous ${days} days`} series={daily.map((day) => day.averageReadingSeconds)} />
        <StatCard label="Completion" icon={readerIcons.check} value={`${reader.completionRate}%`} trend={change(reader.completionRate, previous?.completionRate)} caption={`vs previous ${days} days`} series={daily.map((day) => day.completionRate)} />
      </div>
      <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1.85fr)_minmax(0,1fr)]">
        <section className={cardClass}>
          <h3 className="text-lg font-extrabold text-[#12093a]">Daily readers</h3><p className="mt-1 text-sm text-slate-500">Number of unique readers per day in the last {days} days.</p>
          <DailyChart key={`readers-${days}`} points={daily.map((day) => ({ date: day.date, value: day.uniqueReaders }))} unit={["reader", "readers"]} gradientId="readers-fill" emptyText="No readers in this period." />
        </section>
        <section className={cardClass}>
          <h3 className="text-lg font-extrabold text-[#12093a]">Most read articles</h3><p className="mt-1 text-sm text-slate-500">Most viewed in the last {days} days</p>
          {reader.topArticles.length ? <ul className="mt-3 divide-y divide-slate-100">{reader.topArticles.slice(0, 8).map((article) => <ArticleRow key={article.articleId} href={article.path} title={article.title} image={article.imageUrl} meta={`${article.publishedAt ? `Published ${fullDate.format(utcDay(article.publishedAt))} · ` : ""}${formatDuration(article.averageReadingSeconds)} avg. read · ${article.readers.toLocaleString()} ${article.readers === 1 ? "reader" : "readers"}`} aside={<span className="flex shrink-0 items-center gap-1.5 text-sm font-semibold tabular-nums text-slate-800"><Icon name="eye" className="h-[18px] w-[18px] text-slate-500" />{article.views.toLocaleString()}<span className="sr-only"> views</span></span>} />)}</ul> : <p className="mt-5 text-sm text-slate-500">No article data yet.</p>}
        </section>
      </div>
    </>}
  </section>;
}

export function Overview({ data, loading, error, days, onDaysChange, onRefresh, onOpenArticles }: { data: OverviewData | null; loading: boolean; error?: string; days: number; onDaysChange: (days: number) => void; onRefresh: () => void; onOpenArticles: (status?: string) => void }) {
  if (!data && error) return <div className={`${cardClass} space-y-3`} role="alert"><p className="text-sm font-semibold text-slate-900">The overview could not be loaded.</p><p className="text-sm text-slate-500">{error}</p><button type="button" onClick={onRefresh} className="min-h-11 rounded-xl border border-slate-200 px-4 text-sm font-semibold hover:bg-slate-50">Try again</button></div>;
  if (!data) return <OverviewSkeleton />;

  const { content, reader, errors } = data;
  const range = content ?? reader;
  const rangeText = range ? `${fullDate.format(utcDay(range.from))} – ${fullDate.format(utcDay(range.to))}` : `Last ${days} days`;
  const windowDays = content?.windowDays ?? reader?.windowDays ?? days;

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
      {errors.content && <p role="alert" className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">Publishing activity could not be loaded from WordPress: {errors.content}</p>}

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

    <ReaderSection reader={reader} error={errors.reader} days={windowDays} />
  </div>;
}
