"use client";

import type { HomeSection } from "@/lib/home-layout/schema";
import { sectionName } from "./SectionList";

/* What a draft changes against the live layout, for the Publish and Discard
   confirmations: readers' homepage is about to change, so say exactly how. */

export interface LayoutChanges {
  added: string[];
  removed: string[];
  edited: string[];
  hidden: string[];
  shown: string[];
  reordered: boolean;
}

export function compareLayouts(live: HomeSection[], draft: HomeSection[]): LayoutChanges {
  const before = new Map(live.map((s) => [s.id, s]));
  const after = new Map(draft.map((s) => [s.id, s]));
  const changes: LayoutChanges = { added: [], removed: [], edited: [], hidden: [], shown: [], reordered: false };
  for (const section of draft) {
    const old = before.get(section.id);
    if (!old) { changes.added.push(sectionName(section)); continue; }
    if (old.enabled && !section.enabled) changes.hidden.push(sectionName(section));
    if (!old.enabled && section.enabled) changes.shown.push(sectionName(section));
    // hiding is reported on its own, so compare everything else
    if (JSON.stringify({ ...section, enabled: true }) !== JSON.stringify({ ...old, enabled: true })) changes.edited.push(sectionName(section));
  }
  for (const section of live) if (!after.has(section.id)) changes.removed.push(sectionName(section));
  const kept = draft.filter((s) => before.has(s.id)).map((s) => s.id);
  const keptBefore = live.filter((s) => after.has(s.id)).map((s) => s.id);
  changes.reordered = kept.join() !== keptBefore.join();
  return changes;
}

function names(list: string[]): string {
  const shown = list.slice(0, 3).map((n) => `“${n}”`).join(", ");
  return list.length > 3 ? `${shown} and ${list.length - 3} more` : shown;
}

/** The change list as rows with a coloured marker; empty when nothing differs. */
export function ChangeList({ changes, verb = "will be" }: { changes: LayoutChanges; verb?: string }) {
  const rows: { tone: string; label: string; text: string }[] = [];
  if (changes.added.length) rows.push({ tone: "bg-emerald-500", label: "Added", text: names(changes.added) });
  if (changes.edited.length) rows.push({ tone: "bg-violet-500", label: "Edited", text: names(changes.edited) });
  if (changes.removed.length) rows.push({ tone: "bg-red-500", label: "Removed", text: names(changes.removed) });
  if (changes.hidden.length) rows.push({ tone: "bg-amber-500", label: "Hidden", text: names(changes.hidden) });
  if (changes.shown.length) rows.push({ tone: "bg-sky-500", label: "Shown again", text: names(changes.shown) });
  if (changes.reordered) rows.push({ tone: "bg-slate-400", label: "Order", text: "sections moved" });
  if (!rows.length) return <p className="text-slate-500">No differences from the live homepage.</p>;
  return <div>
    <p className="mb-2 text-[11px] font-bold uppercase tracking-[0.12em] text-slate-400">What {verb} changed</p>
    <ul className="space-y-1.5">{rows.map((row) => <li key={row.label} className="flex gap-2"><span aria-hidden className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${row.tone}`} /><span><span className="font-semibold text-slate-800">{row.label}:</span> {row.text}</span></li>)}</ul>
  </div>;
}
