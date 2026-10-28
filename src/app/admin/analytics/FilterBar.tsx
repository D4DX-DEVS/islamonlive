"use client";

import { useState } from "react";
import { inputClass, stripHtml } from "../ui";
import { Icon } from "../icons";
import { Select } from "../Select";
import { MAX_RANGE_DAYS, daysIn, type RangePreset } from "@/lib/analytics/filters";
import { DEVICES, SOURCES, addDays, istDay } from "@/lib/analytics/shared";
import { DEVICE_LABELS, SOURCE_LABELS } from "./format";
import type { FilterState } from "./api";
import type { Category } from "../ui";

const PRESETS: { id: Exclude<RangePreset, "custom">; label: string }[] = [{ id: "today", label: "Today" }, { id: "7", label: "7 days" }, { id: "30", label: "30 days" }, { id: "90", label: "90 days" }];
const selectClass = "sm:w-auto sm:min-w-44";
/** the value that stands for "no filter": Radix keeps "" for itself */
const ALL = "all";

type FilterBarProps = { filters: FilterState; categories: Category[]; onChange: (next: FilterState) => void };

/** One row above everything it scopes: the date range first, then the dimensions. */
export default function FilterBar({ filters, categories, onChange }: FilterBarProps) {
  // the date the page opened on is close enough; it only bounds the date pickers
  const [today] = useState(() => istDay(Date.now()));
  const [custom, setCustom] = useState({ from: filters.from ?? addDays(today, -13), to: filters.to ?? today });
  const [showCustom, setShowCustom] = useState(filters.preset === "custom");
  const customError = custom.from > custom.to ? "The start date is after the end date." : daysIn(custom) > MAX_RANGE_DAYS ? `Choose at most ${MAX_RANGE_DAYS} days.` : "";
  const set = (patch: Partial<FilterState>) => onChange({ ...filters, ...patch });
  const active = Boolean(filters.category || filters.device || filters.source || filters.visitor);

  return <div className="space-y-3">
    <div className="flex flex-wrap items-center gap-2">
      <div role="group" aria-label="Date range" className="flex flex-wrap rounded-xl border border-slate-200 bg-white p-1 shadow-sm">
        {PRESETS.map((preset) => <button key={preset.id} type="button" aria-pressed={filters.preset === preset.id} onClick={() => { setShowCustom(false); set({ preset: preset.id, from: undefined, to: undefined }); }}
          className={`min-h-9 rounded-lg px-3 text-sm font-semibold transition ${filters.preset === preset.id ? "bg-violet-600 text-white shadow-sm" : "text-slate-600 hover:bg-violet-50 hover:text-violet-800"}`}>{preset.label}</button>)}
        <button type="button" aria-pressed={filters.preset === "custom"} aria-expanded={showCustom} onClick={() => setShowCustom((open) => !open)}
          className={`flex min-h-9 items-center gap-1.5 rounded-lg px-3 text-sm font-semibold transition ${filters.preset === "custom" ? "bg-violet-600 text-white shadow-sm" : "text-slate-600 hover:bg-violet-50 hover:text-violet-800"}`}><Icon name="calendar" className="h-4 w-4" />Custom</button>
      </div>
      {showCustom && <form className="flex flex-wrap items-end gap-2" onSubmit={(event) => { event.preventDefault(); if (!customError) set({ preset: "custom", ...custom }); }}>
        <label className="text-xs font-medium text-slate-600">From<input type="date" required value={custom.from} max={today} onChange={(e) => setCustom({ ...custom, from: e.target.value })} className={`${inputClass} mt-1 min-h-11 sm:w-40`} /></label>
        <label className="text-xs font-medium text-slate-600">To<input type="date" required value={custom.to} max={today} onChange={(e) => setCustom({ ...custom, to: e.target.value })} className={`${inputClass} mt-1 min-h-11 sm:w-40`} /></label>
        <button type="submit" disabled={Boolean(customError)} className="min-h-11 rounded-xl bg-violet-600 px-4 text-sm font-bold text-white transition hover:bg-violet-700 disabled:opacity-50">Apply</button>
        {customError && <p role="alert" className="w-full text-xs text-red-600">{customError}</p>}
      </form>}
    </div>
    <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:items-center">
      <Select label="Category" value={String(filters.category ?? ALL)} onChange={(v) => set({ category: v === ALL ? undefined : Number(v) })} className={selectClass}
        options={[{ value: ALL, label: "All categories" }, ...categories.map((category) => ({ value: String(category.id), label: stripHtml(category.name) }))]} />
      <Select label="Device" value={filters.device ?? ALL} onChange={(v) => set({ device: v === ALL ? undefined : v as FilterState["device"] })} className={selectClass}
        options={[{ value: ALL, label: "All devices" }, ...DEVICES.map((device) => ({ value: device, label: DEVICE_LABELS[device] }))]} />
      <Select label="Traffic source" value={filters.source ?? ALL} onChange={(v) => set({ source: v === ALL ? undefined : v as FilterState["source"] })} className={selectClass}
        options={[{ value: ALL, label: "All sources" }, ...SOURCES.map((source) => ({ value: source, label: SOURCE_LABELS[source] }))]} />
      <Select label="Visitors" value={filters.visitor ?? ALL} onChange={(v) => set({ visitor: v === ALL ? undefined : v as FilterState["visitor"] })} className={selectClass}
        options={[{ value: ALL, label: "New and returning" }, { value: "new", label: "New visitors" }, { value: "returning", label: "Returning visitors" }]} />
      {active && <button type="button" onClick={() => set({ category: undefined, device: undefined, source: undefined, visitor: undefined })} className="col-span-2 flex min-h-11 items-center justify-center gap-1.5 rounded-xl px-3 text-sm font-semibold text-violet-700 transition hover:bg-violet-50 sm:col-span-1"><Icon name="close" className="h-4 w-4" />Clear filters</button>}
    </div>
  </div>;
}
