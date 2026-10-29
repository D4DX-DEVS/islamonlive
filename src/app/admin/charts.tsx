"use client";

import { KeyboardEvent, PointerEvent, useState } from "react";
import { cardClass, iconProps } from "./ui";

/* Shared by the Overview and the Analytics page: stat cards with a trend and a
   sparkline, and the daily area chart with its hover and keyboard readout. */

export const dayMonth = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
export const fullDate = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
export const utcDay = (iso: string) => new Date(`${iso.slice(0, 10)}T00:00:00Z`);

export function Sparkline({ values }: { values: number[] }) {
  const recent = values.slice(-7);
  const max = Math.max(...recent, 0);
  return <span aria-hidden className="hidden h-12 shrink-0 items-end gap-[3px] self-end @[15rem]:flex">
    {recent.map((value, index) => <span key={index} className="w-1 rounded-full" style={{ height: `${max ? Math.max(12, (value / max) * 100) : 12}%`, backgroundColor: max ? "#c4b5fd" : "#ede9fe", opacity: 0.45 + (index / Math.max(recent.length - 1, 1)) * 0.55 }} />)}
  </span>;
}

/** Relative change against the previous window; null when there is nothing to compare with. */
export function change(current: number, previous: number | undefined): number | null {
  return previous ? Math.round(((current - previous) / previous) * 100) : null;
}

export function Trend({ pct }: { pct: number | null }) {
  if (pct === null) return <p className="mt-1 text-sm font-semibold text-slate-400" title="No data in the previous period">—</p>;
  const up = pct > 0;
  const tone = pct === 0 ? "text-slate-500" : up ? "text-emerald-600" : "text-red-600";
  return <p className={`mt-1 flex items-center gap-1 text-sm font-semibold ${tone}`}>
    {pct !== 0 && <svg {...iconProps} strokeWidth={2.2} className="h-4 w-4"><path d={up ? "M12 19V5M6 11l6-6 6 6" : "M12 5v14M6 13l6 6 6-6"} /></svg>}
    {Math.abs(pct)}%<span className="sr-only">{pct === 0 ? " no change" : up ? " increase" : " decrease"}</span>
  </p>;
}

export type StatCardProps = {
  label: string;
  value: string;
  icon: React.ReactNode;
  /** A percentage, null when there is nothing to compare with, undefined for a plain current total. */
  trend?: number | null;
  caption: string;
  series?: number[];
  onClick?: () => void;
};

export function StatCard({ label, value, icon, trend, caption, series, onClick }: StatCardProps) {
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

export function niceScale(max: number): { top: number; step: number } {
  if (max <= 0) return { top: 4, step: 1 };
  const raw = max / 5;
  const magnitude = 10 ** Math.floor(Math.log10(raw));
  // Whole-number ticks only (these are counts), with a step of headroom above the peak.
  const step = Math.max(1, ([1, 2, 5, 10].find((multiple) => multiple * magnitude >= raw) ?? 10) * magnitude);
  return { top: (Math.floor(max / step) + 1) * step, step };
}

/** Smooth line through the points, control points clamped so it never dips below the baseline. */
export function smoothPath(points: [number, number][], baseline: number): string {
  return points.map(([x, y], index) => {
    if (index === 0) return `M${x} ${y}`;
    const [x0, y0] = points[index - 2] ?? points[index - 1];
    const [x1, y1] = points[index - 1];
    const [x3, y3] = points[index + 1] ?? points[index];
    const clamp = (value: number) => Math.min(baseline, Math.max(0, value));
    return `C${x1 + (x - x0) / 6} ${clamp(y1 + (y - y0) / 6)} ${x - (x3 - x1) / 6} ${clamp(y - (y3 - y1) / 6)} ${x} ${y}`;
  }).join(" ");
}

export type Point = { date: string; value: number };

/** `format` writes a value (the tooltip, the peak); `tick` an axis label. Both default to counts of `unit`. */
export function DailyChart({ points, unit, gradientId, emptyText, format, tick, fill }: { points: Point[]; unit: [string, string]; gradientId: string; emptyText: string; format?: (value: number) => string; tick?: (value: number) => string; fill?: boolean }) {
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
  const label = format ?? ((value: number) => `${value.toLocaleString()} ${value === 1 ? unit[0] : unit[1]}`);

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
  // `fill` lets the plot grow on xl to match a taller sibling card; the axis column skips the 28px date row.
  return <div className={`mt-5 flex gap-3 pr-5 ${fill ? "xl:flex-1" : ""}`}>
    <div aria-hidden className={`relative h-52 w-10 shrink-0 text-right text-xs text-slate-500 lg:h-56 ${fill ? "xl:mb-7 xl:h-auto" : ""}`}>
      {ticks.map((value) => <span key={value} className="absolute right-0 -translate-y-1/2 whitespace-nowrap" style={{ top: `${yPercent(value)}%` }}>{tick ? tick(value) : value.toLocaleString()}</span>)}
    </div>
    <div className={`min-w-0 flex-1 ${fill ? "xl:flex xl:flex-col" : ""}`}>
      <div role="group" aria-label={`${unit[1]} per day. ${maxValue ? `Peak ${label(maxValue)} on ${fullDate.format(utcDay(points[peak!].date))}.` : "None yet."} Use the left and right arrow keys to inspect a day.`} tabIndex={0} onPointerMove={moveTo} onPointerDown={moveTo} onPointerLeave={() => setHover(null)} onKeyDown={onKey} onBlur={() => setHover(null)} className={`relative h-52 touch-pan-y rounded-md outline-none focus-visible:ring-2 focus-visible:ring-violet-300 lg:h-56 ${fill ? "xl:h-auto xl:min-h-56 xl:flex-1" : ""}`}>
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

