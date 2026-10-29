"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";

/* The builder's canvas: the real homepage (/preview/home, the draft) in an
   iframe sized like the chosen device and scaled to fit.

   Two frames take turns. A new version loads in the hidden one, takes the
   visible one's scroll position, and only then swaps in, so an edit never
   flashes a blank page. Both frames are same-origin, which lets the builder
   reach into the page: clicks pick a section instead of following links, and
   the selected section is outlined and scrolled into view. */

export type Device = "desktop" | "tablet" | "phone";
export const DEVICE_WIDTH: Record<Device, number> = { desktop: 1280, tablet: 820, phone: 390 };

const src = (version: number) => `/preview/home/?v=${version}`;

type Frames = { active: 0 | 1; versions: [number | null, number | null] };

function prepare(frame: HTMLIFrameElement, onSelect: (id: string) => void): void {
  const doc = frame.contentDocument;
  // the page's own wrapper, not <html>: the frame's load can come before React
  // hydrates, and an attribute React didn't render is a hydration mismatch —
  // the wrapper is the one node the preview page tells React to expect it on
  const root = doc?.querySelector<HTMLElement>("[data-preview-root]");
  if (!doc || !root || root.dataset.builder) return;
  root.dataset.builder = "1";
  // a click picks the section under it; links and forms stay put so the canvas never navigates away
  doc.addEventListener("click", (event) => {
    // not `instanceof Element`: the page's nodes belong to the frame's window, whose Element is a different class
    const target = event.target as Element | null;
    if (!target || typeof target.closest !== "function") return;
    if (target.closest("a")) event.preventDefault();
    const slot = target.closest("[data-section-id]");
    const id = slot?.getAttribute("data-section-id");
    if (id) onSelect(id);
  }, true);
  doc.addEventListener("submit", (event) => event.preventDefault(), true);
}

function mark(frame: HTMLIFrameElement | null, selectedId: string | null, scroll: boolean): void {
  const doc = frame?.contentDocument;
  if (!doc) return;
  doc.querySelectorAll("[data-selected]").forEach((el) => el.removeAttribute("data-selected"));
  if (!selectedId) return;
  const el = doc.querySelector(`[data-section-id="${CSS.escape(selectedId)}"]`);
  if (!el) return;
  el.setAttribute("data-selected", "");
  if (!scroll) return;
  const box = el.getBoundingClientRect();
  const view = frame!.contentWindow!.innerHeight;
  if (box.top < 60 || box.top > view * 0.7) el.scrollIntoView({ behavior: "smooth", block: "start" });
}

export default function PreviewCanvas({ version, device, selectedId, onSelect, saving }: { version: number; device: Device; selectedId: string | null; onSelect: (id: string) => void; saving: boolean }) {
  const [frames, setFrames] = useState<Frames>({ active: 0, versions: [version, null] });
  const [box, setBox] = useState({ width: 0, height: 0 });
  const refs = [useRef<HTMLIFrameElement>(null), useRef<HTMLIFrameElement>(null)];
  const stage = useRef<HTMLDivElement>(null);
  const selectRef = useRef(onSelect);
  const selectedRef = useRef(selectedId);
  useLayoutEffect(() => { selectRef.current = onSelect; selectedRef.current = selectedId; });

  useEffect(() => {
    const node = stage.current;
    if (!node) return;
    const observer = new ResizeObserver(([entry]) => setBox({ width: entry.contentRect.width, height: entry.contentRect.height }));
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  // the selection is drawn inside the page, which is a system outside React
  useEffect(() => { mark(refs[frames.active].current, selectedId, true); }, [selectedId, frames.active]); // eslint-disable-line react-hooks/exhaustive-deps

  const shown = frames.versions[frames.active];
  const pending = shown !== version;
  const other = frames.active === 0 ? 1 : 0;

  function loaded(index: 0 | 1) {
    const frame = refs[index].current;
    if (!frame) return;
    const v = frame.src.startsWith("about:") ? null : new URL(frame.src, window.location.href).searchParams.get("v");
    // the idle frame's about:blank also fires load; it is not a version
    if (v === null) return;
    const loadedVersion = Number(v);
    prepare(frame, (id) => selectRef.current(id));
    if (index === frames.active && frames.versions[index] === loadedVersion) { mark(frame, selectedRef.current, false); return; }
    if (index !== other || loadedVersion !== version) return;
    // take over where the reader was, then swap
    const previous = refs[frames.active].current?.contentWindow;
    if (previous) frame.contentWindow?.scrollTo(0, previous.scrollY);
    mark(frame, selectedRef.current, false);
    setFrames((current) => ({ active: index, versions: index === 0 ? [loadedVersion, current.versions[1]] : [current.versions[0], loadedVersion] }));
  }

  const width = DEVICE_WIDTH[device];
  const padding = device === "desktop" ? 32 : 48;
  const scale = box.width ? Math.min(1, (box.width - padding) / width) : 1;
  const frameHeight = box.height ? (box.height - padding - (device === "desktop" ? 36 : 24)) / scale : 800;

  return <div ref={stage} className="relative h-full min-h-0 w-full overflow-hidden bg-[radial-gradient(#d4d4e8_1px,transparent_1px)] [background-size:18px_18px]">
    {box.width > 0 && <div className="absolute left-1/2 top-4 -translate-x-1/2" style={{ width: width * scale + (device === "desktop" ? 0 : 16) }}>
      <div className={`overflow-hidden bg-white shadow-[0_24px_60px_-24px_rgba(30,10,77,0.45)] ${device === "desktop" ? "rounded-xl border border-slate-200" : "rounded-[30px] border-[8px] border-slate-900"}`}>
        {device === "desktop" && <div className="flex h-9 items-center gap-1.5 border-b border-slate-200 bg-slate-50 px-3">
          <span className="h-2.5 w-2.5 rounded-full bg-red-300" /><span className="h-2.5 w-2.5 rounded-full bg-amber-300" /><span className="h-2.5 w-2.5 rounded-full bg-emerald-300" />
          <span className="mx-auto max-w-xs flex-1 truncate rounded-md bg-white px-3 py-0.5 text-center text-[11px] text-slate-500 ring-1 ring-slate-200">islamonlive.in</span>
        </div>}
        <div className="relative overflow-hidden" style={{ width: width * scale, height: frameHeight * scale }}>
          {([0, 1] as const).map((index) => {
            const v = index === frames.active ? frames.versions[index] : pending ? version : frames.versions[index];
            return <iframe key={index} ref={refs[index]} title={index === frames.active ? "Homepage preview" : "Homepage preview (loading)"} aria-hidden={index !== frames.active}
              src={v === null ? "about:blank" : src(v)} onLoad={() => loaded(index)}
              className={`absolute left-0 top-0 origin-top-left border-0 bg-white ${index === frames.active ? "visible" : "invisible"}`}
              style={{ width, height: frameHeight, transform: `scale(${scale})` }} />;
          })}
        </div>
      </div>
    </div>}
    <div aria-live="polite" className={`pointer-events-none absolute bottom-4 left-1/2 flex -translate-x-1/2 items-center gap-2 rounded-full bg-slate-900/85 px-3.5 py-2 text-xs font-medium text-white shadow-lg transition-opacity ${pending || saving ? "opacity-100" : "opacity-0"}`}>
      <svg aria-hidden viewBox="0 0 24 24" className="h-3.5 w-3.5 animate-spin"><circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" strokeOpacity=".3" strokeWidth="3" /><path d="M21 12a9 9 0 00-9-9" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" /></svg>
      {saving ? "Saving draft…" : "Updating preview…"}
    </div>
  </div>;
}
