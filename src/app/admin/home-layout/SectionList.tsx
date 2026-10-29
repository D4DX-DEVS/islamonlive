"use client";

import { useState } from "react";
import { Icon, type IconName } from "../icons";
import { KIND_LABELS, STYLE_LABELS, type HomeSection } from "@/lib/home-layout/schema";
import { iconButton } from "./parts";

/* The builder's left panel: the page's sections top to bottom. Drag or use the
   arrows to reorder, the eye to hide, click to select (the canvas scrolls to it). */

const KIND_ICON: Record<HomeSection["kind"], IconName> = { hero: "layers", reels: "video", banners: "image", watch: "video", listen: "mic", image: "image", posts: "grid" };
const PLACEMENT = { full: "Full width", main: "Main column", side: "Sidebar" } as const;

export function sectionName(section: HomeSection): string {
  return ("title" in section && section.title) || KIND_LABELS[section.kind];
}

function meta(section: HomeSection): string {
  const kind = section.kind === "posts" ? STYLE_LABELS[section.style].split(":")[0] : KIND_LABELS[section.kind];
  const where = PLACEMENT[section.placement];
  const device = section.visibility === "desktop" ? " · computers" : section.visibility === "mobile" ? " · phones" : "";
  return `${kind} · ${where}${device}`;
}

interface Props {
  sections: HomeSection[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onMove: (from: number, to: number) => void;
  onToggle: (id: string) => void;
  onDuplicate: (id: string) => void;
  onDelete: (id: string) => void;
  onAdd: () => void;
}

export default function SectionList({ sections, selectedId, onSelect, onMove, onToggle, onDuplicate, onDelete, onAdd }: Props) {
  const [dragFrom, setDragFrom] = useState<number | null>(null);
  const [dragOver, setDragOver] = useState<number | null>(null);

  return <div className="flex h-full min-h-0 flex-col">
    <div className="flex items-center justify-between gap-2 border-b border-slate-200 px-4 py-3">
      <div><h2 className="text-sm font-bold text-[#12093a]">Sections</h2><p className="text-[11px] text-slate-500">{sections.length} on the page · drag to reorder</p></div>
      <button type="button" onClick={onAdd} className="flex min-h-9 items-center gap-1.5 rounded-lg bg-violet-600 px-3 text-xs font-bold text-white transition hover:bg-violet-700 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-violet-200"><Icon name="plus" className="h-4 w-4" strokeWidth={2.2} />Add</button>
    </div>
    {sections.length === 0 ? <div className="m-4 rounded-xl border border-dashed border-slate-300 p-6 text-center text-sm text-slate-500">The page is empty.<button type="button" onClick={onAdd} className="mt-2 block w-full font-semibold text-violet-700 hover:underline">Add the first section</button></div>
      : <ol className="min-h-0 flex-1 space-y-1.5 overflow-y-auto p-3">{sections.map((section, index) => {
        const selected = section.id === selectedId;
        const name = sectionName(section);
        return <li key={section.id} draggable
          onDragStart={(event) => { setDragFrom(index); event.dataTransfer.effectAllowed = "move"; event.dataTransfer.setData("text/plain", section.id); }}
          onDragOver={(event) => { event.preventDefault(); if (dragOver !== index) setDragOver(index); }}
          onDragLeave={() => setDragOver((current) => (current === index ? null : current))}
          onDrop={(event) => { event.preventDefault(); if (dragFrom !== null) onMove(dragFrom, index); setDragFrom(null); setDragOver(null); }}
          onDragEnd={() => { setDragFrom(null); setDragOver(null); }}
          className={`group relative rounded-xl border transition ${selected ? "border-violet-400 bg-violet-50/70 shadow-[0_0_0_3px_rgba(167,139,250,0.25)]" : "border-slate-200 bg-white hover:border-violet-200"} ${dragFrom === index ? "opacity-40" : ""} ${dragOver === index && dragFrom !== null && dragFrom !== index ? (dragFrom < index ? "after:absolute after:inset-x-2 after:-bottom-1 after:h-0.5 after:rounded after:bg-violet-500" : "before:absolute before:inset-x-2 before:-top-1 before:h-0.5 before:rounded before:bg-violet-500") : ""}`}>
          <div className="flex items-center gap-2 p-2">
            <span aria-hidden className="cursor-grab text-slate-300 active:cursor-grabbing"><svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor"><circle cx="9" cy="6" r="1.5" /><circle cx="15" cy="6" r="1.5" /><circle cx="9" cy="12" r="1.5" /><circle cx="15" cy="12" r="1.5" /><circle cx="9" cy="18" r="1.5" /><circle cx="15" cy="18" r="1.5" /></svg></span>
            <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${selected ? "bg-violet-600 text-white" : "bg-slate-100 text-slate-500"}`}><Icon name={KIND_ICON[section.kind]} className="h-4 w-4" /></span>
            <button type="button" onClick={() => onSelect(section.id)} aria-current={selected ? "true" : undefined} className="min-w-0 flex-1 py-0.5 text-left focus-visible:outline-none">
              <span className={`block truncate text-[13px] font-semibold ${section.enabled ? "text-[#12093a]" : "text-slate-400 line-through decoration-slate-300"}`}>{name}</span>
              <span className="block truncate text-[11px] text-slate-500">{section.enabled ? meta(section) : "Hidden from the page"}</span>
            </button>
            <button type="button" aria-label={section.enabled ? `Hide ${name}` : `Show ${name}`} title={section.enabled ? "Hide" : "Show"} onClick={() => onToggle(section.id)} className={`${iconButton} h-8 w-8`}><Icon name={section.enabled ? "eye" : "eyeOff"} className="h-4 w-4" /></button>
          </div>
          {selected && <div className="flex items-center gap-0.5 border-t border-violet-100 px-2 py-1">
            <button type="button" aria-label={`Move ${name} up`} disabled={index === 0} onClick={() => onMove(index, index - 1)} className={`${iconButton} h-8 w-8`}><Icon name="arrowUp" className="h-4 w-4" /></button>
            <button type="button" aria-label={`Move ${name} down`} disabled={index === sections.length - 1} onClick={() => onMove(index, index + 1)} className={`${iconButton} h-8 w-8`}><Icon name="arrowUp" className="h-4 w-4 rotate-180" /></button>
            <button type="button" aria-label={`Duplicate ${name}`} onClick={() => onDuplicate(section.id)} className={`${iconButton} h-8 w-8`}><Icon name="copy" className="h-4 w-4" /></button>
            <button type="button" aria-label={`Remove ${name}`} onClick={() => onDelete(section.id)} className={`${iconButton} ml-auto h-8 w-8 hover:text-red-600`}><Icon name="trash" className="h-4 w-4" /></button>
          </div>}
        </li>;
      })}</ol>}
  </div>;
}
