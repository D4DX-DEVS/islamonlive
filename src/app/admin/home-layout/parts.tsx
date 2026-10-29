"use client";

import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { Icon } from "../icons";
import { inputClass, type Category } from "../ui";

/* Small building blocks of the Homepage screen: the dialog frame, a switch,
   labelled fields and the category / tag pickers. */

export const primaryButton = "flex min-h-11 items-center justify-center gap-2 rounded-xl bg-[linear-gradient(90deg,#7c3aed,#6d28d9)] px-5 text-sm font-bold text-white shadow-[0_10px_22px_-10px_rgba(109,40,217,0.8)] transition hover:brightness-110 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-violet-200 disabled:opacity-50";
export const secondaryButton = "flex min-h-11 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-800 transition hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-violet-100 disabled:opacity-50";
export const iconButton = "flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-slate-500 transition hover:bg-slate-100 hover:text-slate-800 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-violet-100 disabled:opacity-30 disabled:hover:bg-transparent";

export function Dialog({ title, onClose, children, footer, wide = false }: { title: string; onClose: () => void; children: React.ReactNode; footer: React.ReactNode; wide?: boolean }) {
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => { if (event.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);
  return createPortal(<div className="fixed inset-0 z-[200] flex items-end justify-center bg-slate-900/50 sm:items-center sm:p-6" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
    <div role="dialog" aria-modal="true" aria-label={title} className={`flex max-h-[92vh] w-full flex-col overflow-hidden rounded-t-2xl bg-white shadow-2xl sm:rounded-2xl ${wide ? "max-w-2xl" : "max-w-lg"}`}>
      <div className="flex items-center justify-between border-b border-slate-200 px-5 py-3"><h2 className="text-base font-bold text-[#12093a]">{title}</h2><button type="button" aria-label="Close" onClick={onClose} className={iconButton}><Icon name="close" /></button></div>
      <div className="space-y-4 overflow-y-auto p-5">{children}</div>
      <div className="flex flex-wrap justify-end gap-3 border-t border-slate-200 bg-slate-50/60 px-5 py-3">{footer}</div>
    </div>
  </div>, document.body);
}

export function Switch({ checked, onChange, label }: { checked: boolean; onChange: (next: boolean) => void; label: string }) {
  return <button type="button" role="switch" aria-checked={checked} aria-label={label} title={label} onClick={() => onChange(!checked)} className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-violet-100 ${checked ? "bg-violet-600" : "bg-slate-300"}`}>
    <span className={`inline-block h-5 w-5 rounded-full bg-white shadow transition ${checked ? "translate-x-[22px]" : "translate-x-0.5"}`} />
  </button>;
}

export function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return <label className="block text-sm font-semibold text-slate-900">{label}<span className="mt-1.5 block font-normal">{children}</span>{hint && <span className="mt-1 block text-xs font-normal text-slate-500">{hint}</span>}</label>;
}

export function TextInput({ value, onChange, placeholder, type = "text" }: { value: string; onChange: (value: string) => void; placeholder?: string; type?: string }) {
  return <input type={type} value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} className={inputClass} />;
}

export function NumberInput({ value, onChange, min, max }: { value: number; onChange: (value: number) => void; min: number; max: number }) {
  return <input type="number" inputMode="numeric" min={min} max={max} value={value} onChange={(event) => onChange(Math.min(max, Math.max(min, Number(event.target.value) || min)))} className={`${inputClass} max-w-32`} />;
}

/** Pick several categories: chips for the chosen ones, a filterable list to add more. */
export function CategoryPicker({ categories, value, onChange, single = false }: { categories: Category[]; value: number[]; onChange: (ids: number[]) => void; single?: boolean }) {
  const [query, setQuery] = useState("");
  const byId = useMemo(() => new Map(categories.map((c) => [c.id, c])), [categories]);
  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    return categories.filter((c) => !value.includes(c.id) && (!q || c.name.toLowerCase().includes(q))).sort((a, b) => b.count - a.count).slice(0, 8);
  }, [categories, query, value]);
  return <div className="space-y-2">
    {value.length > 0 && <div className="flex flex-wrap gap-1.5">{value.map((id) => <span key={id} className="inline-flex min-h-8 items-center gap-1 rounded-full bg-violet-50 pl-3 pr-1 text-xs font-semibold text-violet-800">{byId.get(id)?.name ?? `#${id}`}<button type="button" aria-label={`Remove ${byId.get(id)?.name ?? id}`} onClick={() => onChange(value.filter((v) => v !== id))} className="flex h-6 w-6 items-center justify-center rounded-full hover:bg-violet-100"><Icon name="close" className="h-3.5 w-3.5" /></button></span>)}</div>}
    {(!single || value.length === 0) && <>
      <input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder={categories.length ? "Search categories…" : "Loading categories…"} aria-label="Search categories" className={inputClass} />
      {query.trim() !== "" && matches.length > 0 && <ul className="max-h-48 overflow-y-auto rounded-xl border border-slate-200 p-1">{matches.map((c) => <li key={c.id}><button type="button" onClick={() => { onChange(single ? [c.id] : [...value, c.id]); setQuery(""); }} className="flex min-h-10 w-full items-center justify-between rounded-lg px-3 text-left text-sm text-slate-700 hover:bg-violet-50"><span className="truncate">{c.name}</span><span className="text-xs text-slate-400">{c.count.toLocaleString()}</span></button></li>)}</ul>}
    </>}
  </div>;
}

type TagHit = { id: number; name: string; count: number };

/** One tag, found by name. */
export function TagPicker({ value, onChange }: { value: number | null; onChange: (id: number | null) => void }) {
  const [query, setQuery] = useState("");
  const [hits, setHits] = useState<TagHit[]>([]);
  const [chosen, setChosen] = useState<TagHit | null>(null);
  useEffect(() => {
    if (!value || chosen?.id === value) return;
    let cancelled = false;
    void fetch(`/api/admin/home-layout/?tagIds=${value}`, { cache: "no-store" }).then((r) => r.json()).then((body) => { if (!cancelled) setChosen(body.items?.[0] ?? { id: value, name: `#${value}`, count: 0 }); }).catch(() => undefined);
    return () => { cancelled = true; };
  }, [value, chosen]);
  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) return;
    const timer = setTimeout(() => { void fetch(`/api/admin/home-layout/?tags=${encodeURIComponent(q)}`, { cache: "no-store" }).then((r) => r.json()).then((body) => setHits(body.items ?? [])).catch(() => setHits([])); }, 300);
    return () => clearTimeout(timer);
  }, [query]);
  if (value) return <span className="inline-flex min-h-8 items-center gap-1 rounded-full bg-teal-50 pl-3 pr-1 text-xs font-semibold text-teal-800">{chosen?.id === value ? chosen.name : "…"}<button type="button" aria-label="Remove tag" onClick={() => onChange(null)} className="flex h-6 w-6 items-center justify-center rounded-full hover:bg-teal-100"><Icon name="close" className="h-3.5 w-3.5" /></button></span>;
  return <div className="space-y-2">
    <input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Type 2+ letters of a tag…" aria-label="Search tags" className={inputClass} />
    {query.trim().length >= 2 && hits.length > 0 && <ul className="max-h-48 overflow-y-auto rounded-xl border border-slate-200 p-1">{hits.map((t) => <li key={t.id}><button type="button" onClick={() => { setChosen(t); onChange(t.id); setQuery(""); }} className="flex min-h-10 w-full items-center justify-between rounded-lg px-3 text-left text-sm text-slate-700 hover:bg-violet-50"><span className="truncate">{t.name}</span><span className="text-xs text-slate-400">{t.count.toLocaleString()}</span></button></li>)}</ul>}
  </div>;
}
