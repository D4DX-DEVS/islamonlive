"use client";

import { useEffect, useRef, useState } from "react";
import { Icon, type IconName } from "../icons";
import type { Device } from "./PreviewCanvas";
import type { LayoutState, SaveStatus } from "./useLayoutDraft";

/* The builder's top bar: leave, save state, device size, undo/redo, history,
   open the preview in a tab, discard and publish. */

const when = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
const formatWhen = (iso: string | null) => (iso && Date.parse(iso) > 0 ? when.format(new Date(iso)) : "");
const DEVICES: { key: Device; label: string; icon: IconName }[] = [{ key: "desktop", label: "Desktop", icon: "monitor" }, { key: "tablet", label: "Tablet", icon: "tablet" }, { key: "phone", label: "Phone", icon: "smartphone" }];
const tool = "flex h-9 w-9 items-center justify-center rounded-lg text-slate-600 transition hover:bg-slate-100 hover:text-slate-900 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-violet-100 disabled:opacity-30 disabled:hover:bg-transparent";

function Status({ save, hasChanges, savedAt, server, onRetry }: { save: SaveStatus; hasChanges: boolean; savedAt: string | null; server: LayoutState; onRetry: () => void }) {
  if (save === "error") return <button type="button" onClick={onRetry} className="flex items-center gap-1.5 rounded-full bg-red-50 px-2.5 py-1 text-xs font-semibold text-red-700 hover:bg-red-100"><span className="h-1.5 w-1.5 rounded-full bg-red-500" />Not saved · Retry</button>;
  if (save === "pending" || save === "saving") return <span className="flex items-center gap-1.5 rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-600"><span className="h-1.5 w-1.5 animate-pulse rounded-full bg-slate-400" />Saving…</span>;
  if (hasChanges) return <span title={savedAt ? `Draft saved ${formatWhen(savedAt)}` : undefined} className="flex items-center gap-1.5 rounded-full bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-800"><span className="h-1.5 w-1.5 rounded-full bg-amber-500" />Draft saved · not live</span>;
  return <span title={server.updatedAt ? `Published ${formatWhen(server.updatedAt)}${server.updatedBy ? ` by ${server.updatedBy.name}` : ""}` : "The original layout"} className="flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-800"><span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />{server.isDefault ? "Original layout" : "Live"}</span>;
}

function HistoryMenu({ server, busy, onRestore, onReset }: { server: LayoutState; busy: boolean; onRestore: (index: number) => void; onReset: () => void }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const close = (event: MouseEvent | KeyboardEvent) => { if (event instanceof KeyboardEvent ? event.key === "Escape" : !ref.current?.contains(event.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", close);
    return () => { document.removeEventListener("mousedown", close); document.removeEventListener("keydown", close); };
  }, [open]);
  return <div ref={ref} className="relative">
    <button type="button" aria-label="Version history" title="Version history" aria-haspopup="menu" aria-expanded={open} onClick={() => setOpen((v) => !v)} className={tool}><Icon name="history" className="h-[18px] w-[18px]" /></button>
    {open && <div role="menu" className="absolute right-0 top-full z-30 mt-2 w-72 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl">
      <p className="border-b border-slate-100 px-4 py-2.5 text-xs font-bold uppercase tracking-[0.12em] text-slate-400">Published versions</p>
      <div className="max-h-80 overflow-y-auto p-1.5">
        {server.updatedAt && <div className="flex items-center justify-between gap-2 rounded-lg px-3 py-2 text-xs"><span><span className="block font-semibold text-slate-900">Live now</span><span className="text-slate-500">{formatWhen(server.updatedAt)}{server.updatedBy ? ` · ${server.updatedBy.name}` : ""}</span></span><span className="rounded-md bg-emerald-50 px-2 py-0.5 font-semibold text-emerald-700">Current</span></div>}
        {server.history.length === 0 && <p className="px-3 py-3 text-xs text-slate-500">Earlier versions appear here after you publish.</p>}
        {server.history.map((version) => <div key={version.index} className="flex items-center justify-between gap-2 rounded-lg px-3 py-2 text-xs hover:bg-slate-50">
          <span className="min-w-0"><span className="block font-semibold text-slate-900">{Date.parse(version.savedAt) > 0 ? formatWhen(version.savedAt) : "Original layout"}</span><span className="block truncate text-slate-500">{version.savedBy?.name ?? "Built in"} · {version.sections} sections</span></span>
          <button type="button" role="menuitem" disabled={busy} onClick={() => { setOpen(false); onRestore(version.index); }} className="min-h-9 shrink-0 rounded-lg px-2.5 font-semibold text-violet-700 hover:bg-violet-50 disabled:opacity-50">Restore</button>
        </div>)}
      </div>
      <button type="button" role="menuitem" onClick={() => { setOpen(false); onReset(); }} className="flex min-h-11 w-full items-center gap-2 border-t border-slate-100 px-4 text-left text-xs font-semibold text-slate-700 hover:bg-slate-50"><Icon name="reset" className="h-4 w-4" />Start again from the original layout</button>
    </div>}
  </div>;
}

interface Props {
  server: LayoutState;
  save: SaveStatus;
  savedAt: string | null;
  hasChanges: boolean;
  busy: boolean;
  device: Device;
  canUndo: boolean;
  canRedo: boolean;
  onDevice: (device: Device) => void;
  onUndo: () => void;
  onRedo: () => void;
  onExit: () => void;
  onRetry: () => void;
  onDiscard: () => void;
  onPublish: () => void;
  onRestore: (index: number) => void;
  onReset: () => void;
}

export default function BuilderTopBar(props: Props) {
  const { server, device, busy, hasChanges } = props;
  return <header className="flex h-14 shrink-0 items-center gap-2 border-b border-slate-200 bg-white px-2 sm:px-3">
    <button type="button" onClick={props.onExit} className="flex min-h-10 items-center gap-1.5 rounded-lg px-2 text-sm font-semibold text-slate-700 hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-violet-100"><Icon name="arrowLeft" className="h-[18px] w-[18px]" /><span className="hidden sm:inline">Exit</span></button>
    <span className="hidden h-6 w-px bg-slate-200 sm:block" />
    <div className="flex min-w-0 items-center gap-2">
      <h1 className="hidden truncate text-sm font-bold text-[#12093a] md:block">Homepage builder</h1>
      <Status save={props.save} hasChanges={hasChanges} savedAt={props.savedAt} server={server} onRetry={props.onRetry} />
    </div>

    <div role="group" aria-label="Preview size" className="mx-auto hidden items-center rounded-lg bg-slate-100 p-0.5 md:flex">
      {DEVICES.map((d) => <button key={d.key} type="button" aria-pressed={device === d.key} title={d.label} onClick={() => props.onDevice(d.key)} className={`flex h-8 items-center gap-1.5 rounded-md px-2.5 text-xs font-semibold transition ${device === d.key ? "bg-white text-violet-700 shadow-sm" : "text-slate-500 hover:text-slate-800"}`}><Icon name={d.icon} className="h-4 w-4" /><span className="hidden xl:inline">{d.label}</span></button>)}
    </div>

    <div className="ml-auto flex items-center gap-0.5 md:ml-0">
      <button type="button" aria-label="Undo" title="Undo (Ctrl+Z)" disabled={!props.canUndo || busy} onClick={props.onUndo} className={tool}><Icon name="undo" className="h-[18px] w-[18px]" /></button>
      <button type="button" aria-label="Redo" title="Redo (Ctrl+Shift+Z)" disabled={!props.canRedo || busy} onClick={props.onRedo} className={tool}><Icon name="redo" className="h-[18px] w-[18px]" /></button>
      <HistoryMenu server={server} busy={busy} onRestore={props.onRestore} onReset={props.onReset} />
      <a href="/preview/home/" target="_blank" rel="noopener noreferrer" aria-label="Open the preview in a new tab" title="Open the preview in a new tab" className={`${tool} hidden sm:flex`}><Icon name="external" className="h-[18px] w-[18px]" /></a>
      <span className="mx-1 hidden h-6 w-px bg-slate-200 sm:block" />
      {hasChanges && <button type="button" disabled={busy} onClick={props.onDiscard} className="hidden min-h-9 rounded-lg px-3 text-sm font-semibold text-slate-600 hover:bg-slate-100 disabled:opacity-50 sm:block">Discard</button>}
      <button type="button" disabled={!hasChanges || busy} onClick={props.onPublish} className="flex min-h-9 items-center gap-1.5 rounded-lg bg-[linear-gradient(90deg,#7c3aed,#6d28d9)] px-3.5 text-sm font-bold text-white shadow-[0_8px_18px_-10px_rgba(109,40,217,0.9)] transition hover:brightness-110 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-violet-200 disabled:opacity-40 disabled:shadow-none">
        <Icon name="send" className="h-4 w-4" />{busy ? "Working…" : "Publish"}
      </button>
    </div>
  </header>;
}
