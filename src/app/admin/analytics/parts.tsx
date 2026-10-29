"use client";

import type { ReactNode } from "react";
import { cardClass, Skeleton } from "../ui";
import { Icon } from "../icons";
import { duration, metric, percent, viewCount } from "./format";
import type { ArticleRow } from "@/lib/analytics/report-types";

/* Building blocks of the Analytics page. Marks are one violet (#7c3aed) for
   magnitudes; the only two-colour mark (new vs returning) pairs it with teal
   #0d9488, a pair checked for colour-blind separation. Every value a bar shows
   is also written beside it, so nothing depends on colour or hover. */

export const VIOLET = "#7c3aed";
export const TEAL = "#0d9488";

export function Panel({ title, subtitle, action, children, className = "" }: { title: string; subtitle?: string; action?: ReactNode; children: ReactNode; className?: string }) {
  // a column, so a Pager's mt-auto pins it to the foot and pagers line up across a row of cards
  return <section className={`${cardClass} flex min-w-0 flex-col ${className}`}>
    <div className="flex flex-wrap items-start justify-between gap-2">
      <div className="min-w-0"><h3 className="text-base font-extrabold text-[#12093a] sm:text-lg">{title}</h3>{subtitle && <p className="mt-1 text-sm text-slate-500">{subtitle}</p>}</div>
      {action}
    </div>
    {children}
  </section>;
}

export function EmptyNote({ children }: { children: ReactNode }) {
  return <p className="mt-4 rounded-xl bg-slate-50 px-4 py-3 text-sm text-slate-600">{children}</p>;
}

export function ErrorNote({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return <div role="alert" className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">
    <span>{message}</span>
    {onRetry && <button type="button" onClick={onRetry} className="inline-flex min-h-11 items-center gap-1.5 rounded-lg border border-red-200 bg-white px-3 font-semibold text-red-700 transition hover:bg-red-100"><Icon name="reset" className="h-4 w-4" />Retry</button>}
  </div>;
}

export function ListSkeleton({ rows = 5 }: { rows?: number }) {
  return <div aria-hidden className="mt-4 space-y-3">{Array.from({ length: rows }, (_, i) => <Skeleton key={i} className="h-9 w-full" />)}</div>;
}

export type Bar = { id: string; label: string; value: number; display: string; detail?: string };

/** Horizontal bars sharing one scale, the value written at the end. Clickable when `onPick` is given.
    A paged list passes the whole list's top value as `scale`, so later pages are drawn to the same scale. */
export function BarList({ rows, onPick, label, active, scale }: { rows: Bar[]; onPick?: (id: string) => void; label: string; active?: string; scale?: number }) {
  const max = Math.max(...rows.map((row) => row.value), scale ?? 0, 0);
  return <ul aria-label={label} className="mt-4 space-y-3">
    {rows.map((row) => {
      const body = <>
        <span className="flex items-baseline justify-between gap-3 text-sm">
          <span className="min-w-0 truncate font-medium text-slate-800">{row.label}</span>
          <span className="shrink-0 tabular-nums text-slate-900"><span className="font-semibold">{row.display}</span>{row.detail && <span className="ml-1.5 hidden text-xs text-slate-500 sm:inline">{row.detail}</span>}</span>
        </span>
        {/* on a phone the detail gets its own line, so the name isn't squeezed to a few letters */}
        {row.detail && <span className="mt-0.5 block truncate text-xs text-slate-500 sm:hidden">{row.detail}</span>}
        <span aria-hidden className="mt-1.5 block h-2 w-full">
          <span className="block h-2 rounded-r-[4px]" style={{ width: `${max ? Math.max(1.5, (row.value / max) * 100) : 0}%`, backgroundColor: VIOLET, opacity: active && active !== row.id ? 0.35 : 1 }} />
        </span>
      </>;
      return <li key={row.id}>
        {onPick
          ? <button type="button" onClick={() => onPick(row.id)} aria-pressed={active === row.id} title={`Filter by ${row.label}`} className="block w-full rounded-lg px-1 py-0.5 text-left transition hover:bg-violet-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-300">{body}</button>
          : <div className="px-1 py-0.5">{body}</div>}
      </li>;
    })}
  </ul>;
}

/** New vs returning: one bar split in two with a 2px gap, a legend with the numbers beneath. */
export function SplitBar({ parts, label }: { parts: { label: string; value: number; color: string; detail?: string }[]; label: string }) {
  const total = parts.reduce((sum, part) => sum + part.value, 0);
  return <div className="mt-4">
    <div role="img" aria-label={`${label}: ${parts.map((p) => `${p.label} ${p.value.toLocaleString("en")}`).join(", ")}`} className="flex h-3 w-full gap-[2px] overflow-hidden rounded-[4px] bg-slate-100">
      {total > 0 && parts.filter((p) => p.value > 0).map((part) => <span key={part.label} className="h-full" style={{ width: `${(part.value / total) * 100}%`, backgroundColor: part.color }} />)}
    </div>
    <ul className="mt-3 flex flex-wrap gap-x-6 gap-y-2 text-sm">
      {parts.map((part) => <li key={part.label} className="flex items-center gap-2">
        <span aria-hidden className="h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: part.color }} />
        <span className="text-slate-600">{part.label}</span>
        <span className="font-semibold tabular-nums text-slate-900">{part.value.toLocaleString("en")}</span>
        {total > 0 && <span className="text-xs text-slate-500">{percent(Math.round((part.value / total) * 1000) / 10)}</span>}
        {part.detail && <span className="text-xs text-slate-500">{part.detail}</span>}
      </li>)}
    </ul>
  </div>;
}

/** Where readers stop: article views reaching each scroll depth. */
export function ScrollFunnel({ reached, views }: { reached: Record<25 | 50 | 75 | 90, number>; views: number }) {
  const steps = [25, 50, 75, 90] as const;
  if (!views) return <EmptyNote>No article views in this period, so there is no scroll depth to show.</EmptyNote>;
  return <ol aria-label="Article views reaching each scroll depth" className="mt-4 space-y-3">
    {steps.map((step, index) => {
      const share = Math.round((reached[step] / views) * 1000) / 10;
      const lost = index === 0 ? views - reached[step] : reached[steps[index - 1]] - reached[step];
      return <li key={step}>
        <span className="flex items-baseline justify-between gap-3 text-sm">
          <span className="font-medium text-slate-800">Read {step}%{step === 90 ? " (finished)" : ""}</span>
          <span className="tabular-nums"><span className="font-semibold text-slate-900">{reached[step].toLocaleString("en")}</span><span className="ml-1.5 text-xs text-slate-500">{percent(share)} · {lost.toLocaleString("en")} stopped before</span></span>
        </span>
        <span aria-hidden className="mt-1.5 block h-2 w-full rounded-r-[4px] bg-violet-50"><span className="block h-2 rounded-r-[4px]" style={{ width: `${share}%`, backgroundColor: VIOLET }} /></span>
      </li>;
    })}
  </ol>;
}

/** A ranked list of articles; each opens the article's breakdown. `start` is how many rows earlier pages hold. */
export function ArticleList({ rows, value, onOpen, empty, start = 0 }: { rows: ArticleRow[]; value: (row: ArticleRow) => ReactNode; onOpen: (id: number) => void; empty: string; start?: number }) {
  if (!rows.length) return <EmptyNote>{empty}</EmptyNote>;
  return <ol className="mt-3 divide-y divide-slate-100">
    {rows.map((row, index) => <li key={row.id}>
      <button type="button" onClick={() => onOpen(row.id)} className="flex min-h-14 w-full items-center gap-3 rounded-lg px-1 py-2 text-left transition hover:bg-violet-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-300">
        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-violet-50 text-xs font-bold text-violet-700">{start + index + 1}</span>
        <span className="min-w-0 flex-1"><span className="line-clamp-2 text-sm font-semibold text-slate-900">{row.title}</span>{row.category && <span className="mt-0.5 block truncate text-xs text-slate-500">{row.category}</span>}</span>
        <span className="shrink-0 text-right text-sm tabular-nums text-slate-900">{value(row)}</span>
      </button>
    </li>)}
  </ol>;
}

/** Previous / next under a paged list. mt-auto pins it to the card's foot. Nothing when everything fits on one page. */
export function Pager({ label, page, totalPages, total, noun, onPage, disabled }: { label: string; page: number; totalPages: number; total: number; noun: [string, string]; onPage: (page: number) => void; disabled?: boolean }) {
  if (totalPages <= 1) return null;
  const button = "flex h-11 w-11 items-center justify-center rounded-xl border border-slate-200 bg-white transition hover:bg-slate-50 disabled:opacity-40";
  return <nav aria-label={`${label}: pages`} className="mt-auto flex items-center justify-between gap-3 pt-4 text-sm text-slate-600">
    <p>Page {page} of {totalPages} <span className="text-slate-400">· {total.toLocaleString("en")} {total === 1 ? noun[0] : noun[1]}</span></p>
    <div className="flex items-center gap-2">
      <button type="button" aria-label="Previous page" disabled={disabled || page <= 1} onClick={() => onPage(page - 1)} className={button}><Icon name="chevronLeft" className="h-4 w-4" /></button>
      <button type="button" aria-label="Next page" disabled={disabled || page >= totalPages} onClick={() => onPage(page + 1)} className={button}><Icon name="chevronRight" className="h-4 w-4" /></button>
    </div>
  </nav>;
}

/** The usual one-line article figures. */
export const articleFigures = (row: Pick<ArticleRow, "views" | "avgSeconds" | "completionRate">) =>
  `${viewCount(row.views)} · ${metric(row.avgSeconds, duration)} avg · ${metric(row.completionRate, percent)} finished`;

/** A headline figure; `change` (percent against the previous period) is shown in place of the note when there is one. */
export function Stat({ label, value, note, change }: { label: string; value: string; note?: string; change?: number | null }) {
  return <div className="min-w-0 rounded-xl bg-slate-50 px-3 py-2.5">
    <p className="truncate text-xs text-slate-500 sm:text-sm">{label}</p>
    <p className="mt-0.5 text-lg font-extrabold tabular-nums text-[#12093a] sm:text-2xl">{value}</p>
    {typeof change === "number"
      ? <p className={`mt-0.5 text-xs font-semibold ${change > 0 ? "text-emerald-700" : change < 0 ? "text-red-700" : "text-slate-500"}`}>{change > 0 ? "+" : change < 0 ? "−" : ""}{Math.abs(change)}% vs previous period</p>
      : note && <p className="mt-0.5 text-xs text-slate-500">{note}</p>}
  </div>;
}
