"use client";

import { useEffect, useState } from "react";
import ConfirmDialog from "@/components/ConfirmDialog";
import { Icon } from "../icons";
import { Skeleton, type Category } from "../ui";
import { DEFAULT_LAYOUT, KIND_LABELS, STYLE_LABELS, newSectionId, type HomeSection } from "@/lib/home-layout/schema";
import BuilderTopBar from "./BuilderTopBar";
import PreviewCanvas, { type Device } from "./PreviewCanvas";
import SectionList, { sectionName } from "./SectionList";
import SectionSettings from "./SectionSettings";
import AddSectionDialog from "./AddSectionDialog";
import LayoutMap from "./LayoutMap";
import { useLayoutDraft } from "./useLayoutDraft";

/* The homepage builder (administrators only): the section list on the left,
   the live page in the middle, the selected section's settings on the right.
   Edits autosave as a draft that only the preview shows; Publish puts it live.
   On a phone the three panels become tabs. */

type Pending = { kind: "delete"; id: string } | { kind: "reset" } | { kind: "restore"; index: number } | { kind: "discard" } | { kind: "publish" } | null;
type Panel = "sections" | "preview" | "settings";

const CONFIRM: Record<NonNullable<Pending>["kind"], { title: string; body: string; label: string; destructive?: boolean }> = {
  delete: { title: "Remove this section?", body: "It leaves the draft now and the homepage when you publish. Undo brings it back.", label: "Remove section", destructive: true },
  reset: { title: "Start again from the original layout?", body: "The draft is replaced by the built-in homepage. Readers see nothing until you publish, and Undo brings your sections back.", label: "Use original layout" },
  restore: { title: "Restore this version?", body: "It goes live immediately. The layout live now stays in the history.", label: "Restore and publish" },
  discard: { title: "Discard the draft?", body: "The builder goes back to the layout readers see now.", label: "Discard draft", destructive: true },
  publish: { title: "Publish to the homepage?", body: "Every reader sees this layout from now on. The current one is kept in the history.", label: "Publish now" },
};

function changedKeys(before: HomeSection, after: HomeSection): string {
  return Object.keys(after).filter((key) => JSON.stringify((before as unknown as Record<string, unknown>)[key]) !== JSON.stringify((after as unknown as Record<string, unknown>)[key])).join(",");
}

function describe(section: HomeSection): string {
  return section.kind === "posts" ? STYLE_LABELS[section.style] : KIND_LABELS[section.kind];
}

export default function HomeLayoutPage({ categories, onExit }: { categories: Category[]; onExit: () => void }) {
  const layout = useLayoutDraft();
  const { draft, commit, server } = layout;
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [device, setDevice] = useState<Device>(() => (window.innerWidth < 768 ? "phone" : "desktop"));
  const [panel, setPanel] = useState<Panel>("preview");
  const [adding, setAdding] = useState(false);
  const [pending, setPending] = useState<Pending>(null);
  const selected = draft.find((s) => s.id === selectedId) ?? null;
  const index = selected ? draft.indexOf(selected) : -1;

  // Ctrl+Z / Ctrl+Shift+Z outside text fields; Escape clears the selection
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const typing = event.target instanceof HTMLElement && (event.target.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(event.target.tagName));
      if (event.key === "Escape" && !typing && !adding && !pending) setSelectedId(null);
      if (typing || !(event.ctrlKey || event.metaKey)) return;
      const key = event.key.toLowerCase();
      if (key === "z" && !event.shiftKey) { event.preventDefault(); layout.undo(); }
      if ((key === "z" && event.shiftKey) || key === "y") { event.preventDefault(); layout.redo(); }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [layout, adding, pending]);

  // an unsaved edit asks before the tab closes
  useEffect(() => {
    if (layout.save !== "pending" && layout.save !== "saving" && layout.save !== "error") return;
    const warn = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [layout.save]);

  const select = (id: string | null, from: "list" | "canvas" = "list") => { setSelectedId(id); if (id && from === "list") setPanel((p) => (p === "sections" ? "settings" : p)); };
  const move = (from: number, to: number) => { if (to < 0 || to >= draft.length || from === to) return; const next = [...draft]; const [item] = next.splice(from, 1); next.splice(to, 0, item); commit(next); };
  const update = (section: HomeSection) => { const before = draft.find((s) => s.id === section.id); commit(draft.map((s) => (s.id === section.id ? section : s)), before ? `${section.id}:${changedKeys(before, section)}` : undefined); };
  const toggle = (id: string) => commit(draft.map((s) => (s.id === id ? ({ ...s, enabled: !s.enabled } as HomeSection) : s)));
  const duplicate = (id: string) => { const at = draft.findIndex((s) => s.id === id); if (at < 0) return; const copy = { ...draft[at], id: newSectionId() } as HomeSection; commit([...draft.slice(0, at + 1), copy, ...draft.slice(at + 1)]); setSelectedId(copy.id); };
  const add = (section: HomeSection) => { const at = index >= 0 ? index + 1 : draft.length; commit([...draft.slice(0, at), section, ...draft.slice(at)]); setAdding(false); setSelectedId(section.id); setPanel("settings"); };
  const exit = async () => { await layout.flush(); onExit(); };

  function confirm() {
    const action = pending; setPending(null);
    if (!action) return;
    if (action.kind === "delete") { commit(draft.filter((s) => s.id !== action.id)); if (selectedId === action.id) setSelectedId(null); }
    if (action.kind === "reset") commit(DEFAULT_LAYOUT);
    if (action.kind === "discard") void layout.discard();
    if (action.kind === "publish") void layout.publish();
    if (action.kind === "restore") void layout.restore(action.index);
  }

  if (!server) return <div className="fixed inset-0 z-[110] flex flex-col bg-slate-50">
    <div className="flex h-14 items-center gap-3 border-b border-slate-200 bg-white px-3"><Skeleton className="h-8 w-20" /><Skeleton className="h-6 w-40" /><Skeleton className="ml-auto h-9 w-28" /></div>
    {layout.error ? <div role="alert" className="m-6 rounded-xl bg-red-50 p-6 text-sm text-red-700">{layout.error}<button type="button" onClick={() => void layout.load()} className="ml-3 font-semibold text-violet-700 hover:underline">Retry</button><button type="button" onClick={onExit} className="ml-3 font-semibold text-slate-600 hover:underline">Exit</button></div>
      : <div className="grid min-h-0 flex-1 gap-4 p-4 lg:grid-cols-[18rem_1fr_21rem]"><div className="hidden space-y-2 lg:block">{Array.from({ length: 9 }, (_, i) => <Skeleton key={i} className="h-14 w-full" />)}</div><Skeleton className="h-full w-full rounded-xl" /><div className="hidden space-y-3 lg:block"><Skeleton className="h-10 w-full" /><Skeleton className="h-40 w-full" /></div></div>}
  </div>;

  const settingsPanel = selected ? <div className="flex h-full min-h-0 flex-col">
    <div className="flex items-start gap-1 border-b border-slate-200 px-4 py-3">
      <div className="min-w-0 flex-1 pr-2"><p className="truncate text-[11px] font-semibold uppercase tracking-[0.12em] text-violet-600">{describe(selected)}</p><h2 className="truncate text-base font-bold text-[#12093a]">{sectionName(selected)}</h2></div>
      <button type="button" aria-label={selected.enabled ? "Hide section" : "Show section"} title={selected.enabled ? "Hide" : "Show"} onClick={() => toggle(selected.id)} className="flex h-9 w-9 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100"><Icon name={selected.enabled ? "eye" : "eyeOff"} className="h-[18px] w-[18px]" /></button>
      <button type="button" aria-label="Duplicate section" title="Duplicate" onClick={() => duplicate(selected.id)} className="flex h-9 w-9 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100"><Icon name="copy" className="h-[18px] w-[18px]" /></button>
      <button type="button" aria-label="Remove section" title="Remove" onClick={() => setPending({ kind: "delete", id: selected.id })} className="flex h-9 w-9 items-center justify-center rounded-lg text-slate-500 hover:bg-red-50 hover:text-red-600"><Icon name="trash" className="h-[18px] w-[18px]" /></button>
      <button type="button" aria-label="Close settings" onClick={() => setSelectedId(null)} className="flex h-9 w-9 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100"><Icon name="close" className="h-[18px] w-[18px]" /></button>
    </div>
    {!selected.enabled && <p className="mx-4 mt-3 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-900">Hidden: readers do not see this section. <button type="button" onClick={() => toggle(selected.id)} className="font-semibold underline">Show it</button></p>}
    {selected.enabled && selected.visibility !== "all" && <p className="mx-4 mt-3 rounded-lg bg-sky-50 px-3 py-2 text-xs text-sky-900">Shown on {selected.visibility === "desktop" ? "computers" : "phones and tablets"} only. Switch the preview size to see it.</p>}
    <div className="min-h-0 flex-1 overflow-y-auto"><SectionSettings key={selected.id} section={selected} categories={categories} onChange={update} /></div>
  </div> : <div className="h-full overflow-y-auto p-4">
    <h2 className="text-base font-bold text-[#12093a]">Page</h2>
    <p className="mt-1 text-sm leading-relaxed text-slate-500">Click a section in the preview or the list to edit it. Changes save as a draft straight away; readers see them only when you publish.</p>
    <h3 className="mb-2 mt-5 text-[11px] font-bold uppercase tracking-[0.14em] text-slate-400">Structure on a computer</h3>
    <LayoutMap sections={draft} selectedId={selectedId} onSelect={(id) => select(id)} />
    <button type="button" onClick={() => setAdding(true)} className="mt-4 flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border border-dashed border-violet-300 text-sm font-semibold text-violet-700 hover:bg-violet-50"><Icon name="plus" className="h-4 w-4" />Add a section</button>
    <ul className="mt-5 space-y-2 text-xs text-slate-500"><li><kbd className="rounded border border-slate-200 bg-slate-50 px-1.5 py-0.5 font-sans">Ctrl Z</kbd> undo · <kbd className="rounded border border-slate-200 bg-slate-50 px-1.5 py-0.5 font-sans">Ctrl Shift Z</kbd> redo</li><li>Drag sections in the list to reorder them.</li><li>The clock icon above lists earlier published versions.</li></ul>
  </div>;

  const tabs: { key: Panel; label: string }[] = [{ key: "sections", label: "Sections" }, { key: "preview", label: "Preview" }, { key: "settings", label: selected ? "Edit" : "Page" }];

  return <div className="fixed inset-0 z-[110] flex flex-col bg-slate-50 text-slate-900">
    <BuilderTopBar server={server} save={layout.save} savedAt={layout.savedAt} hasChanges={layout.hasChanges} busy={layout.busy} device={device} canUndo={layout.canUndo} canRedo={layout.canRedo}
      onDevice={setDevice} onUndo={layout.undo} onRedo={layout.redo} onExit={() => void exit()} onRetry={layout.retry} onDiscard={() => setPending({ kind: "discard" })} onPublish={() => setPending({ kind: "publish" })} onRestore={(i) => setPending({ kind: "restore", index: i })} onReset={() => setPending({ kind: "reset" })} />
    {layout.error && <p role="alert" className="flex items-center gap-2 border-b border-red-100 bg-red-50 px-4 py-2 text-sm text-red-700"><Icon name="info" className="h-4 w-4 shrink-0" /><span className="min-w-0 flex-1">{layout.error}</span><button type="button" aria-label="Dismiss" onClick={() => layout.setError("")} className="rounded p-1 hover:bg-red-100"><Icon name="close" className="h-4 w-4" /></button></p>}

    <div className="grid min-h-0 flex-1 lg:grid-cols-[17rem_minmax(0,1fr)_21rem] xl:grid-cols-[18rem_minmax(0,1fr)_22rem]">
      <aside aria-label="Sections" className={`min-h-0 border-r border-slate-200 bg-white ${panel === "sections" ? "block" : "hidden"} lg:block`}>
        <SectionList sections={draft} selectedId={selectedId} onSelect={(id) => select(id)} onMove={move} onToggle={toggle} onDuplicate={duplicate} onDelete={(id) => setPending({ kind: "delete", id })} onAdd={() => setAdding(true)} />
      </aside>
      <main aria-label="Preview" className={`relative min-h-0 ${panel === "preview" ? "block" : "hidden"} lg:block`}>
        <PreviewCanvas version={layout.version} device={device} selectedId={selectedId} onSelect={(id) => select(id, "canvas")} saving={layout.save === "saving" || layout.save === "pending"} />
        {selected && <button type="button" onClick={() => setPanel("settings")} className="absolute bottom-16 left-1/2 flex min-h-11 max-w-[80%] -translate-x-1/2 items-center gap-2 rounded-full bg-violet-700 px-4 text-sm font-semibold text-white shadow-lg lg:hidden"><Icon name="pencil" className="h-4 w-4 shrink-0" /><span className="truncate">Edit {sectionName(selected)}</span></button>}
        <div role="group" aria-label="Preview size" className="absolute right-3 top-3 flex rounded-lg bg-white p-0.5 shadow md:hidden">
          {(["phone", "tablet", "desktop"] as const).map((d) => <button key={d} type="button" aria-label={`${d} preview`} aria-pressed={device === d} onClick={() => setDevice(d)} className={`flex h-9 w-9 items-center justify-center rounded-md ${device === d ? "bg-violet-100 text-violet-700" : "text-slate-500"}`}><Icon name={d === "phone" ? "smartphone" : d === "tablet" ? "tablet" : "monitor"} className="h-4 w-4" /></button>)}
        </div>
      </main>
      <aside aria-label="Settings" className={`min-h-0 border-l border-slate-200 bg-white ${panel === "settings" ? "block" : "hidden"} lg:block`}>{settingsPanel}</aside>
    </div>

    <nav aria-label="Builder panels" className="grid shrink-0 grid-cols-3 border-t border-slate-200 bg-white pb-[env(safe-area-inset-bottom)] lg:hidden">
      {tabs.map((tab) => <button key={tab.key} type="button" aria-pressed={panel === tab.key} onClick={() => setPanel(tab.key)} className={`min-h-12 text-sm font-semibold ${panel === tab.key ? "text-violet-700 shadow-[inset_0_2px_0_#6d28d9]" : "text-slate-500"}`}>{tab.label}</button>)}
    </nav>

    {adding && <AddSectionDialog after={selected ? sectionName(selected) : null} onAdd={add} onClose={() => setAdding(false)} />}
    <ConfirmDialog open={pending !== null} title={pending ? CONFIRM[pending.kind].title : ""} body={pending ? CONFIRM[pending.kind].body : ""} confirmLabel={pending ? CONFIRM[pending.kind].label : "OK"} destructive={pending ? CONFIRM[pending.kind].destructive : false} onConfirm={confirm} onCancel={() => setPending(null)} />
  </div>;
}
