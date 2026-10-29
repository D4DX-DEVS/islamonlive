"use client";

import { useEffect, useState } from "react";
import ConfirmDialog, { type ConfirmDialogProps } from "../ConfirmDialog";
import { Icon } from "../icons";
import { Skeleton, type Category } from "../ui";
import { DEFAULT_LAYOUT, KIND_LABELS, STYLE_LABELS, newSectionId, type HomeSection } from "@/lib/home-layout/schema";
import BuilderTopBar from "./BuilderTopBar";
import PreviewCanvas, { type Device } from "./PreviewCanvas";
import SectionList, { sectionName } from "./SectionList";
import SectionSettings from "./SectionSettings";
import AddSectionDialog from "./AddSectionDialog";
import LayoutMap from "./LayoutMap";
import { ChangeList, compareLayouts } from "./changes";
import { useLayoutDraft } from "./useLayoutDraft";

/* The homepage builder (administrators only): the section list on the left,
   the live page in the middle, the selected section's settings on the right.
   Edits autosave as a draft that only the preview shows; Publish puts it live.
   On a phone the three panels become tabs.

   Confirmation rule: anything that changes what readers see (publish,
   restore), throws work away (discard, remove, reset) or leaves with work
   unpublished asks first in a modal. Small draft edits (hide, duplicate, add,
   move, typing) do not interrupt; they show an Undo toast instead, and every
   one of them is undoable. */

type Pending = { kind: "delete"; id: string } | { kind: "reset" } | { kind: "restore"; index: number } | { kind: "discard" } | { kind: "publish" } | { kind: "exit" } | null;
type Panel = "sections" | "preview" | "settings";
type Toast = { id: number; text: string; undo: boolean; href?: string };

const when = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });

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
  const [toast, setToast] = useState<Toast | null>(null);
  const selected = draft.find((s) => s.id === selectedId) ?? null;
  const index = selected ? draft.indexOf(selected) : -1;

  // Ctrl+Z / Ctrl+Shift+Z outside text fields; Escape clears the selection
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const typing = event.target instanceof HTMLElement && (event.target.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(event.target.tagName));
      if (event.key === "Escape" && !typing && !adding && !pending) setSelectedId(null);
      if (typing || pending || !(event.ctrlKey || event.metaKey)) return;
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

  // a toast stays for six seconds; a newer one replaces it
  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast((current) => (current?.id === toast.id ? null : current)), 6000);
    return () => clearTimeout(timer);
  }, [toast]);

  const notify = (text: string, undo = true, href?: string) => setToast((current) => ({ id: (current?.id ?? 0) + 1, text, undo, href }));
  const select = (id: string | null, from: "list" | "canvas" = "list") => { setSelectedId(id); if (id && from === "list") setPanel((p) => (p === "sections" ? "settings" : p)); };
  const move = (from: number, to: number) => { if (to < 0 || to >= draft.length || from === to) return; const next = [...draft]; const [item] = next.splice(from, 1); next.splice(to, 0, item); commit(next); };
  const update = (section: HomeSection) => { const before = draft.find((s) => s.id === section.id); commit(draft.map((s) => (s.id === section.id ? section : s)), before ? `${section.id}:${changedKeys(before, section)}` : undefined); };
  const toggle = (id: string) => {
    const section = draft.find((s) => s.id === id);
    if (!section) return;
    commit(draft.map((s) => (s.id === id ? ({ ...s, enabled: !s.enabled } as HomeSection) : s)));
    notify(section.enabled ? `“${sectionName(section)}” hidden in the draft` : `“${sectionName(section)}” shown again`);
  };
  const duplicate = (id: string) => { const at = draft.findIndex((s) => s.id === id); if (at < 0) return; const copy = { ...draft[at], id: newSectionId() } as HomeSection; commit([...draft.slice(0, at + 1), copy, ...draft.slice(at + 1)]); setSelectedId(copy.id); notify(`Duplicated “${sectionName(copy)}”`); };
  const add = (section: HomeSection) => { const at = index >= 0 ? index + 1 : draft.length; commit([...draft.slice(0, at), section, ...draft.slice(at)]); setAdding(false); setSelectedId(section.id); setPanel("settings"); notify(`Added “${sectionName(section)}”`); };
  const undoFromToast = () => { layout.undo(); setToast(null); };
  // nothing unpublished and nothing unsaved: leave straight away; otherwise ask
  const exit = async () => {
    if (layout.hasChanges || layout.save === "error") { setPending({ kind: "exit" }); return; }
    await layout.flush();
    onExit();
  };

  function dialogFor(action: NonNullable<Pending>): Omit<ConfirmDialogProps, "open" | "onCancel"> {
    const changes = server ? compareLayouts(server.sections, draft) : null;
    switch (action.kind) {
      case "publish": return {
        title: "Publish to the homepage?", tone: "primary", icon: "send", confirmLabel: "Publish now", pendingLabel: "Publishing…",
        body: "Every reader sees this layout as soon as it is published. The current one is kept in the version history.",
        details: changes && <ChangeList changes={changes} />,
        onConfirm: async () => { await layout.publish(); setPending(null); notify("Published: the homepage now shows this layout", false, "/"); },
      };
      case "discard": return {
        title: "Discard the draft?", tone: "danger", icon: "trash", confirmLabel: "Discard draft", pendingLabel: "Discarding…",
        body: "The builder goes back to the layout readers see now. Undo can bring the draft back while you stay in the builder.",
        details: changes && <ChangeList changes={changes} verb="would have" />,
        onConfirm: async () => { await layout.discard(); setPending(null); notify("Draft discarded"); },
      };
      case "restore": {
        const version = server?.history[action.index];
        return {
          title: "Restore this version?", tone: "warning", icon: "history", confirmLabel: "Restore and publish", pendingLabel: "Restoring…",
          body: "It goes live straight away, replacing the layout readers see now. That one stays in the history.",
          details: version && <p><span className="font-semibold text-slate-800">{Date.parse(version.savedAt) > 0 ? when.format(new Date(version.savedAt)) : "Original layout"}</span>{version.savedBy ? ` · published by ${version.savedBy.name}` : ""} · {version.sections} sections</p>,
          onConfirm: async () => { await layout.restore(action.index); setPending(null); notify("Earlier version restored and live", true, "/"); },
        };
      }
      case "delete": {
        const section = draft.find((s) => s.id === action.id);
        const name = section ? sectionName(section) : "this section";
        return {
          title: `Remove “${name}”?`, tone: "danger", icon: "trash", confirmLabel: "Remove section",
          body: "It leaves the draft now, and the homepage when you publish.",
          details: section && <p>{describe(section)} · {section.placement === "full" ? "full width" : section.placement === "main" ? "main column" : "sidebar"}</p>,
          onConfirm: () => { commit(draft.filter((s) => s.id !== action.id)); if (selectedId === action.id) setSelectedId(null); setPending(null); notify(`Removed “${name}”`); },
        };
      }
      case "reset": return {
        title: "Start again from the original layout?", tone: "warning", icon: "reset", confirmLabel: "Use original layout",
        body: "Your sections in the draft are replaced by the built-in homepage. Readers see nothing until you publish.",
        onConfirm: () => { commit(DEFAULT_LAYOUT); setSelectedId(null); setPending(null); notify("Original layout loaded into the draft"); },
      };
      case "exit": {
        const unsaved = layout.save === "error";
        return unsaved ? {
          title: "Leave without saving?", tone: "danger", icon: "info", confirmLabel: "Leave anyway", cancelLabel: "Stay and retry",
          body: "Your last changes could not be saved, so they will be lost if you leave now.",
          onConfirm: () => { setPending(null); onExit(); },
        } : {
          title: "Leave the builder?", tone: "warning", icon: "info", confirmLabel: "Leave builder", cancelLabel: "Keep editing", pendingLabel: "Saving draft…",
          body: "Your changes are kept as a draft. Readers keep seeing the live homepage until you come back and publish.",
          details: changes && <ChangeList changes={changes} verb="is waiting to be" />,
          onConfirm: async () => { await layout.flush(); setPending(null); onExit(); },
        };
      }
    }
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
    {pending && <ConfirmDialog key={pending.kind} open {...dialogFor(pending)} onCancel={() => setPending(null)} />}
    {toast && <div role="status" className="fixed bottom-20 left-1/2 z-[150] flex max-w-[calc(100vw-2rem)] -translate-x-1/2 items-center gap-3 rounded-xl bg-slate-900 py-2 pl-4 pr-2 text-sm text-white shadow-2xl transition duration-200 starting:translate-y-3 starting:opacity-0 lg:bottom-6">
      <Icon name="info" className="h-4 w-4 shrink-0 text-violet-300" />
      <span className="min-w-0 truncate">{toast.text}</span>
      {toast.href && <a href={toast.href} target="_blank" rel="noopener noreferrer" className="shrink-0 rounded-lg px-2.5 py-1.5 font-semibold text-violet-200 hover:bg-white/10">View</a>}
      {toast.undo && layout.canUndo && <button type="button" onClick={undoFromToast} className="shrink-0 rounded-lg px-2.5 py-1.5 font-semibold text-violet-200 hover:bg-white/10">Undo</button>}
      <button type="button" aria-label="Dismiss" onClick={() => setToast(null)} className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-slate-400 hover:bg-white/10 hover:text-white"><Icon name="close" className="h-4 w-4" /></button>
    </div>}
  </div>;
}
