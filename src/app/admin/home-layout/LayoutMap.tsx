"use client";

import { groupSections, KIND_LABELS, type HomeSection } from "@/lib/home-layout/schema";

/* A thumbnail of the page the layout produces: full-width rows as bars, the
   two-column blocks as paired cells, in the order readers on a computer see them. */

function label(section: HomeSection): string {
  return ("title" in section && section.title) || KIND_LABELS[section.kind];
}

function Cell({ section, selected, onSelect }: { section: HomeSection; selected: boolean; onSelect: (id: string) => void }) {
  return <button type="button" onClick={() => onSelect(section.id)} className={`block w-full truncate rounded-md border px-2 py-1.5 text-left text-[11px] font-semibold transition ${selected ? "border-violet-500 bg-violet-100 text-violet-900" : "border-slate-200 bg-white text-slate-600 hover:border-violet-300"} ${section.visibility === "mobile" ? "border-dashed opacity-60" : ""}`} title={section.visibility === "mobile" ? `${label(section)} (phones only)` : label(section)}>
    {label(section)}{section.visibility === "desktop" ? <span className="ml-1 font-normal text-slate-400">· desktop</span> : section.visibility === "mobile" ? <span className="ml-1 font-normal text-slate-400">· phones</span> : null}
  </button>;
}

export default function LayoutMap({ sections, selectedId, onSelect }: { sections: HomeSection[]; selectedId: string | null; onSelect: (id: string) => void }) {
  const groups = groupSections(sections);
  if (!groups.length) return <p className="rounded-xl border border-dashed border-slate-200 p-4 text-center text-xs text-slate-500">Nothing is switched on. The homepage would be empty.</p>;
  return <div className="space-y-1.5 rounded-xl bg-slate-100 p-2.5" aria-label="Page outline">
    {groups.map((group, index) => group.type === "full"
      ? <Cell key={group.section.id} section={group.section} selected={selectedId === group.section.id} onSelect={onSelect} />
      : <div key={`b${index}`} className="space-y-1.5">{group.rows.map((row, r) => <div key={r} className="grid grid-cols-3 gap-1.5">
        <div className={`space-y-1.5 ${row.side.length ? "col-span-2" : "col-span-3"}`}>{row.main.map((s) => <Cell key={s.id} section={s} selected={selectedId === s.id} onSelect={onSelect} />)}</div>
        {row.side.length > 0 && <div className="space-y-1.5">{row.side.map((s) => <Cell key={s.id} section={s} selected={selectedId === s.id} onSelect={onSelect} />)}</div>}
      </div>)}</div>)}
  </div>;
}
