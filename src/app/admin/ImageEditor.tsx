"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Icon } from "./icons";
import { ASPECTS, NO_ADJUSTMENTS, capSize, defaultOutputType, dragRect, filterString, fitAspect, outputName, resizeTo, rotatedBounds, type Adjustments, type Handle, type OutputType, type Rect, type Size } from "./image-edit";

/* Crop, turn, flip, resize, adjust and re-save a picture before it is uploaded.
   Everything happens on a canvas in the browser; the result is a new File that
   then goes through prepareImage() like any other upload.

   z-[210]: above the admin dialogs (z-200) it is opened from. */

/** Animated GIFs would lose their frames on a canvas, so they skip the editor. */
export const canEditImage = (file: File) => file.type.startsWith("image/") && file.type !== "image/gif";

type Transform = { quarter: number; straighten: number; flipX: boolean; flipY: boolean; adjust: Adjustments };
const START: Transform = { quarter: 0, straighten: 0, flipX: false, flipY: false, adjust: NO_ADJUSTMENTS };

const FORMATS: { label: string; type: OutputType }[] = [{ label: "WebP", type: "image/webp" }, { label: "JPEG", type: "image/jpeg" }, { label: "PNG", type: "image/png" }];
const HANDLES: Handle[] = ["nw", "n", "ne", "e", "se", "s", "sw", "w"];
const HANDLE_PLACE: Record<string, string> = {
  nw: "-left-1.5 -top-1.5 cursor-nwse-resize", n: "left-1/2 -top-1.5 -translate-x-1/2 cursor-ns-resize", ne: "-right-1.5 -top-1.5 cursor-nesw-resize", e: "-right-1.5 top-1/2 -translate-y-1/2 cursor-ew-resize",
  se: "-right-1.5 -bottom-1.5 cursor-nwse-resize", s: "left-1/2 -bottom-1.5 -translate-x-1/2 cursor-ns-resize", sw: "-left-1.5 -bottom-1.5 cursor-nesw-resize", w: "-left-1.5 top-1/2 -translate-y-1/2 cursor-ew-resize",
};

const kb = (bytes: number) => bytes >= 1_048_576 ? `${(bytes / 1_048_576).toFixed(1)} MB` : `${Math.ceil(bytes / 1024).toLocaleString()} KB`;

/** Draws the turned, flipped, filtered picture's `crop` region into a canvas of `out` size. */
function paint(canvas: HTMLCanvasElement, image: ImageBitmap, t: Transform, bounds: Size, crop: Rect, out: Size, background: string | null) {
  canvas.width = out.width; canvas.height = out.height;
  const context = canvas.getContext("2d");
  if (!context) return;
  context.save();
  if (background) { context.fillStyle = background; context.fillRect(0, 0, out.width, out.height); }
  context.imageSmoothingQuality = "high";
  context.filter = filterString(t.adjust);
  context.scale(out.width / crop.width, out.height / crop.height);
  context.translate(-crop.x + bounds.width / 2, -crop.y + bounds.height / 2);
  context.rotate(((t.quarter * 90 + t.straighten) * Math.PI) / 180);
  context.scale(t.flipX ? -1 : 1, t.flipY ? -1 : 1);
  context.drawImage(image, -image.width / 2, -image.height / 2);
  context.restore();
}

const encode = (canvas: HTMLCanvasElement, type: OutputType, quality: number) => new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, type, type === "image/png" ? undefined : quality));

const chip = (on: boolean) => `min-h-9 rounded-lg border px-2.5 text-xs font-semibold transition ${on ? "border-violet-600 bg-violet-700 text-white" : "border-slate-200 bg-white text-slate-700 hover:bg-violet-50"}`;
const tool = "flex min-h-10 items-center justify-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700 transition hover:bg-violet-50 hover:text-violet-800 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-violet-100";
const numberInput = "min-h-10 w-full rounded-lg border border-slate-200 bg-white px-2.5 text-sm tabular-nums outline-none focus-visible:border-violet-500 focus-visible:ring-4 focus-visible:ring-violet-100";

function Slider({ label, value, min, max, unit = "%", onChange }: { label: string; value: number; min: number; max: number; unit?: string; onChange: (value: number) => void }) {
  return <label className="block text-xs font-semibold text-slate-700">
    <span className="flex justify-between"><span>{label}</span><span className="tabular-nums text-slate-500">{value}{unit}</span></span>
    <input type="range" min={min} max={max} value={value} onChange={(event) => onChange(Number(event.target.value))} className="mt-1 w-full accent-violet-700" />
  </label>;
}

export interface ImageEditorProps {
  file: File;
  /** Preset chosen when the editor opens: a ratio, "original" or null for free. */
  initialAspect?: number | "original" | null;
  onApply: (file: File) => void;
  onCancel: () => void;
}

export default function ImageEditor({ file, initialAspect = null, onApply, onCancel }: ImageEditorProps) {
  const [image, setImage] = useState<ImageBitmap | null>(null);
  const [problem, setProblem] = useState("");
  const [t, setT] = useState<Transform>(START);
  const [aspectChoice, setAspectChoice] = useState<number | "original" | null>(initialAspect);
  const [crop, setCrop] = useState<Rect | null>(null);
  const [size, setSize] = useState<Size | null>(null);
  const [locked, setLocked] = useState(true);
  const [type, setType] = useState<OutputType>(() => defaultOutputType(file.type));
  const [quality, setQuality] = useState(88);
  const [zoom, setZoom] = useState(1);
  const [estimate, setEstimate] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [stage, setStage] = useState<Size>({ width: 600, height: 400 });
  const stageRef = useRef<HTMLDivElement>(null);
  const previewRef = useRef<HTMLCanvasElement>(null);
  const drag = useRef<{ handle: Handle; x: number; y: number; start: Rect } | null>(null);

  useEffect(() => {
    let alive = true, bitmap: ImageBitmap | null = null;
    createImageBitmap(file).then((loaded) => { bitmap = loaded; if (alive) setImage(loaded); else loaded.close(); }).catch(() => { if (alive) setProblem(`${file.name} could not be opened for editing.`); });
    return () => { alive = false; bitmap?.close(); };
  }, [file]);

  useEffect(() => {
    const element = stageRef.current;
    if (!element) return;
    const observer = new ResizeObserver(([entry]) => setStage({ width: entry.contentRect.width, height: entry.contentRect.height }));
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => { if (event.key === "Escape" && !busy) { event.stopPropagation(); onCancel(); } };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [busy, onCancel]);

  const bounds = useMemo(() => image ? rotatedBounds(image.width, image.height, t.quarter * 90 + t.straighten) : null, [image, t.quarter, t.straighten]);
  const aspect = aspectChoice === "original" ? (bounds ? (t.quarter % 2 ? image!.height / image!.width : image!.width / image!.height) : null) : aspectChoice;
  // a new shape or a turn starts the crop box over
  useEffect(() => { if (bounds) queueMicrotask(() => { setCrop(fitAspect(bounds, aspect)); setSize(null); }); }, [bounds, aspect]);

  const box = crop && bounds ? crop : null;
  const out = useMemo(() => size ?? (box ? capSize({ width: Math.round(box.width), height: Math.round(box.height) }) : null), [size, box]);
  const scale = bounds ? Math.min(stage.width / bounds.width, stage.height / bounds.height, 1) * zoom : 1;
  const background = type === "image/jpeg" ? "#ffffff" : null;

  // the preview: the whole turned picture, at screen size
  useEffect(() => {
    const canvas = previewRef.current;
    if (!canvas || !image || !bounds) return;
    const view = { width: Math.max(1, Math.round(bounds.width * scale)), height: Math.max(1, Math.round(bounds.height * scale)) };
    paint(canvas, image, t, bounds, { x: 0, y: 0, ...bounds }, view, background);
  }, [image, t, bounds, scale, background]);

  // the file size, worked out by actually saving, a moment after changes stop
  useEffect(() => {
    if (!image || !bounds || !box || !out) return;
    let alive = true;
    const timer = setTimeout(async () => {
      const canvas = document.createElement("canvas");
      paint(canvas, image, t, bounds, box, out, background);
      const blob = await encode(canvas, type, quality / 100);
      if (alive) setEstimate(blob?.size ?? null);
    }, 450);
    return () => { alive = false; clearTimeout(timer); };
  }, [image, t, bounds, box, out, type, quality, background]);

  const onPointerDown = useCallback((handle: Handle) => (event: React.PointerEvent) => {
    if (!box) return;
    event.preventDefault(); event.stopPropagation();
    (event.currentTarget as Element).setPointerCapture(event.pointerId);
    drag.current = { handle, x: event.clientX, y: event.clientY, start: box };
  }, [box]);
  function onPointerMove(event: React.PointerEvent) {
    const current = drag.current;
    if (!current || !bounds) return;
    setCrop(dragRect(current.start, current.handle, (event.clientX - current.x) / scale, (event.clientY - current.y) / scale, bounds, aspect));
    setSize(null);
  }
  const endDrag = () => { drag.current = null; };
  function nudge(event: React.KeyboardEvent) {
    const step = event.shiftKey ? 10 : 1, moves: Record<string, [number, number]> = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] };
    const move = moves[event.key];
    if (!move || !box || !bounds) return;
    event.preventDefault();
    setCrop(dragRect(box, "move", move[0] / scale, move[1] / scale, bounds, aspect));
  }

  const set = (patch: Partial<Transform>) => setT((previous) => ({ ...previous, ...patch }));
  const adjust = (patch: Partial<Adjustments>) => setT((previous) => ({ ...previous, adjust: { ...previous.adjust, ...patch } }));
  function reset() { setT(START); setAspectChoice(initialAspect); setZoom(1); setSize(null); setLocked(true); setType(defaultOutputType(file.type)); setQuality(88); }

  async function apply() {
    if (!image || !bounds || !box || !out) return;
    setBusy(true); setProblem("");
    const canvas = document.createElement("canvas");
    paint(canvas, image, t, bounds, box, out, background);
    const blob = await encode(canvas, type, quality / 100);
    if (!blob) { setProblem("This browser could not save the edited picture."); setBusy(false); return; }
    // a browser without a WebP writer hands back PNG; name the file for what it is
    onApply(new File([blob], outputName(file.name, blob.type), { type: blob.type }));
  }

  return createPortal(<div role="dialog" aria-modal="true" aria-labelledby="image-editor-title" className="fixed inset-0 z-[210] flex items-stretch justify-center bg-slate-900/60 sm:items-center sm:p-4">
    <div className="flex max-h-dvh w-full max-w-6xl flex-col overflow-hidden bg-white shadow-2xl sm:max-h-[94dvh] sm:rounded-2xl">
      <div className="flex items-center justify-between gap-3 border-b border-slate-200 px-4 py-3 sm:px-5">
        <div className="min-w-0"><h2 id="image-editor-title" className="text-base font-bold text-slate-900">Edit image</h2><p className="truncate text-xs text-slate-500">{file.name}{image && ` · ${image.width}×${image.height}`}</p></div>
        <button type="button" aria-label="Close editor" onClick={onCancel} disabled={busy} className="flex h-10 w-10 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100"><Icon name="close" className="h-5 w-5" /></button>
      </div>

      <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
        <div className="flex min-h-[260px] min-w-0 flex-1 flex-col bg-[repeating-conic-gradient(#e2e8f0_0%_25%,#f8fafc_0%_50%)] bg-[length:20px_20px] p-3 sm:p-4">
          <div ref={stageRef} className="relative flex min-h-0 flex-1 overflow-auto">
            {!image && !problem && <div className="flex h-full w-full items-center justify-center text-sm text-slate-500">Opening the picture…</div>}
            {image && bounds && <div className="relative m-auto shrink-0" style={{ width: bounds.width * scale, height: bounds.height * scale }} onPointerMove={onPointerMove} onPointerUp={endDrag} onPointerCancel={endDrag}>
              <canvas ref={previewRef} className="block h-full w-full" aria-label="Image preview" />
              {box && <div role="group" tabIndex={0} aria-label={`Crop area, ${Math.round(box.width)} by ${Math.round(box.height)} pixels: drag to move, arrow keys to nudge`}
                onPointerDown={onPointerDown("move")} onKeyDown={nudge}
                className="absolute cursor-move touch-none outline-none ring-violet-300 focus-visible:ring-4"
                style={{ left: box.x * scale, top: box.y * scale, width: box.width * scale, height: box.height * scale, boxShadow: "0 0 0 9999px rgba(15,23,42,0.55)", border: "2px solid white" }}>
                <div aria-hidden className="pointer-events-none absolute inset-0 grid grid-cols-3 grid-rows-3">{Array.from({ length: 9 }, (_, i) => <span key={i} className="border border-white/30" />)}</div>
                {HANDLES.map((handle) => <span key={handle} aria-hidden onPointerDown={onPointerDown(handle)} className={`absolute h-3.5 w-3.5 touch-none rounded-sm border-2 border-violet-700 bg-white ${HANDLE_PLACE[handle]}`} />)}
              </div>}
            </div>}
          </div>
          <div className="mt-3 flex items-center gap-3 rounded-xl bg-white/90 px-3 py-2"><Icon name="search" className="h-4 w-4 text-slate-500" /><label className="flex flex-1 items-center gap-3 text-xs font-semibold text-slate-700"><span className="sr-only">Zoom</span><input type="range" min={50} max={300} value={Math.round(zoom * 100)} onChange={(event) => setZoom(Number(event.target.value) / 100)} className="flex-1 accent-violet-700" aria-label="Zoom" /><span className="w-10 tabular-nums text-slate-500">{Math.round(zoom * 100)}%</span></label></div>
        </div>

        <div className="max-h-[45dvh] w-full shrink-0 space-y-5 overflow-y-auto border-t border-slate-200 p-4 lg:max-h-none lg:w-80 lg:border-l lg:border-t-0">
          <section aria-label="Crop shape"><h3 className="text-xs font-bold uppercase tracking-wide text-slate-500">Crop</h3>
            <div className="mt-2 flex flex-wrap gap-1.5">{ASPECTS.map((option) => <button key={option.label} type="button" aria-pressed={aspectChoice === option.value} onClick={() => setAspectChoice(option.value)} className={chip(aspectChoice === option.value)}>{option.label}</button>)}</div>
          </section>

          <section aria-label="Rotate and flip"><h3 className="text-xs font-bold uppercase tracking-wide text-slate-500">Rotate &amp; flip</h3>
            <div className="mt-2 grid grid-cols-2 gap-1.5">
              <button type="button" className={tool} onClick={() => set({ quarter: (t.quarter + 3) % 4 })}><Icon name="undo" className="h-4 w-4" />Left 90°</button>
              <button type="button" className={tool} onClick={() => set({ quarter: (t.quarter + 1) % 4 })}><Icon name="redo" className="h-4 w-4" />Right 90°</button>
              <button type="button" aria-pressed={t.flipX} className={tool} onClick={() => set({ flipX: !t.flipX })}>Flip horizontal</button>
              <button type="button" aria-pressed={t.flipY} className={tool} onClick={() => set({ flipY: !t.flipY })}>Flip vertical</button>
            </div>
            <div className="mt-3"><Slider label="Straighten" value={t.straighten} min={-45} max={45} unit="°" onChange={(straighten) => set({ straighten })} /></div>
          </section>

          <section aria-label="Size"><h3 className="text-xs font-bold uppercase tracking-wide text-slate-500">Resize</h3>
            {out && box && <div className="mt-2 flex items-end gap-2">
              <label className="flex-1 text-xs font-semibold text-slate-700">Width<input type="number" min={1} max={4000} value={out.width} onChange={(event) => setSize(resizeTo(box, "width", Number(event.target.value), out, locked))} className={`${numberInput} mt-1`} /></label>
              <button type="button" aria-pressed={locked} aria-label={locked ? "Unlock aspect ratio" : "Lock aspect ratio"} onClick={() => setLocked(!locked)} className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border ${locked ? "border-violet-600 bg-violet-50 text-violet-700" : "border-slate-200 text-slate-500"}`}><Icon name={locked ? "lock" : "link"} className="h-4 w-4" /></button>
              <label className="flex-1 text-xs font-semibold text-slate-700">Height<input type="number" min={1} max={4000} value={out.height} onChange={(event) => setSize(resizeTo(box, "height", Number(event.target.value), out, locked))} className={`${numberInput} mt-1`} /></label>
            </div>}
            <div className="mt-2 flex flex-wrap gap-1.5">{[2000, 1600, 1200, 800].map((edge) => <button key={edge} type="button" className={chip(false)} onClick={() => box && setSize(capSize({ width: box.width, height: box.height }, edge))}>{edge}px</button>)}</div>
          </section>

          <section aria-label="Adjust colours" className="space-y-3"><h3 className="text-xs font-bold uppercase tracking-wide text-slate-500">Adjust</h3>
            <Slider label="Brightness" value={t.adjust.brightness} min={0} max={200} onChange={(brightness) => adjust({ brightness })} />
            <Slider label="Contrast" value={t.adjust.contrast} min={0} max={200} onChange={(contrast) => adjust({ contrast })} />
            <Slider label="Saturation" value={t.adjust.saturation} min={0} max={200} onChange={(saturation) => adjust({ saturation })} />
            <Slider label="Black & white" value={t.adjust.grayscale} min={0} max={100} onChange={(grayscale) => adjust({ grayscale })} />
          </section>

          <section aria-label="Save as"><h3 className="text-xs font-bold uppercase tracking-wide text-slate-500">Save as</h3>
            <div className="mt-2 flex gap-1.5">{FORMATS.map((format) => <button key={format.type} type="button" aria-pressed={type === format.type} onClick={() => setType(format.type)} className={`${chip(type === format.type)} flex-1`}>{format.label}</button>)}</div>
            {type !== "image/png" && <div className="mt-3"><Slider label="Quality" value={quality} min={30} max={100} onChange={setQuality} /></div>}
            {type === "image/jpeg" && <p className="mt-2 text-[11px] text-slate-500">JPEG has no transparency; see-through areas become white.</p>}
          </section>
        </div>
      </div>

      <div className="flex flex-col gap-3 border-t border-slate-200 bg-slate-50/60 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-5">
        <p className="text-xs text-slate-600" aria-live="polite">{out ? `${out.width}×${out.height}px` : ""}{estimate !== null && ` · about ${kb(estimate)}`}{problem && <span role="alert" className="ml-2 font-semibold text-red-700">{problem}</span>}</p>
        <div className="flex gap-2">
          <button type="button" onClick={reset} disabled={busy} className="flex min-h-11 items-center gap-1.5 rounded-xl px-3 text-sm font-semibold text-slate-600 hover:bg-slate-100"><Icon name="reset" className="h-4 w-4" />Reset</button>
          <button type="button" onClick={onCancel} disabled={busy} className="min-h-11 rounded-xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 hover:bg-slate-50">Cancel</button>
          <button type="button" onClick={() => void apply()} disabled={busy || !box} className="flex min-h-11 items-center gap-1.5 rounded-xl bg-[linear-gradient(90deg,#7c3aed,#6d28d9)] px-5 text-sm font-semibold text-white hover:brightness-110 disabled:opacity-60"><Icon name="check" className="h-4 w-4" />{busy ? "Saving…" : "Apply"}</button>
        </div>
      </div>
    </div>
  </div>, document.body);
}
