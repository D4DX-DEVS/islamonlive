"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { IMAGE_TYPES, UPLOAD_LIMIT_LABEL } from "@/lib/admin-upload";
import { parseEmbed, type Embed } from "@/lib/video-embed";
import { Icon } from "./icons";
import { inputClass } from "./ui";
import { prepareImage, uploadMedia, useObjectUrl, type UploadedMedia } from "./media-client";

/* eslint-disable @next/next/no-img-element -- previews are local blob files, not app images */

const primaryButton = "flex min-h-11 items-center justify-center gap-2 rounded-xl bg-[linear-gradient(90deg,#7c3aed,#6d28d9)] px-5 text-sm font-bold text-white shadow-[0_10px_22px_-10px_rgba(109,40,217,0.8)] transition hover:brightness-110 disabled:opacity-50";
const secondaryButton = "min-h-11 rounded-xl border border-slate-200 bg-white px-5 text-sm font-semibold text-slate-800 transition hover:bg-slate-50";

function DialogFrame({ title, onClose, children, footer }: { title: string; onClose: () => void; children: React.ReactNode; footer: React.ReactNode }) {
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => { if (event.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);
  return createPortal(<div className="fixed inset-0 z-[200] flex items-end justify-center bg-slate-900/50 p-0 sm:items-center sm:p-6" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
    <div role="dialog" aria-modal="true" aria-label={title} className="flex max-h-[92vh] w-full max-w-lg flex-col overflow-hidden rounded-t-2xl bg-white shadow-2xl sm:rounded-2xl">
      <div className="flex items-center justify-between border-b border-slate-200 px-5 py-3"><h2 className="text-base font-bold text-[#12093a]">{title}</h2><button type="button" aria-label="Close" onClick={onClose} className="flex h-10 w-10 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100"><Icon name="close" /></button></div>
      <div className="space-y-4 overflow-y-auto p-5">{children}</div>
      <div className="flex justify-end gap-3 border-t border-slate-200 bg-slate-50/60 px-5 py-3">{footer}</div>
    </div>
  </div>, document.body);
}

const problemClass = "rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700";

export function ImageDialog({ onInsert, onClose }: { onInsert: (image: UploadedMedia) => void; onClose: () => void }) {
  const [file, setFile] = useState<File | null>(null);
  const [alt, setAlt] = useState("");
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState("");
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const preview = useObjectUrl(file);
  function choose(next?: File) {
    if (!next) return;
    if (!IMAGE_TYPES.includes(next.type)) { setProblem(`${next.name} is not a PNG, JPG, WebP or GIF image.`); return; }
    setProblem(""); setFile(next);
  }
  async function insert() {
    if (!file) return;
    setBusy(true); setProblem("");
    try { onInsert(await uploadMedia(await prepareImage(file), "image", alt)); }
    catch (failure) { setProblem(failure instanceof Error ? failure.message : "The image could not be uploaded."); setBusy(false); }
  }
  return <DialogFrame title="Insert image" onClose={onClose} footer={<>
    <button type="button" onClick={onClose} className={secondaryButton}>Cancel</button>
    <button type="button" disabled={!file || busy} onClick={() => void insert()} className={primaryButton}><Icon name="upload" className="h-[18px] w-[18px]" />{busy ? "Uploading…" : "Insert image"}</button>
  </>}>
    <input ref={inputRef} className="hidden" type="file" accept={IMAGE_TYPES.join(",")} onChange={(event) => { choose(event.target.files?.[0]); event.target.value = ""; }} />
    {file && preview
      ? <div className="space-y-2"><img src={preview} alt="Selected image preview" className="max-h-56 w-full rounded-xl border border-slate-200 bg-slate-50 object-contain" /><div className="flex items-center justify-between gap-3 text-xs text-slate-500"><span className="min-w-0 break-all">{file.name} · {Math.ceil(file.size / 1024).toLocaleString()} KB</span><button type="button" disabled={busy} onClick={() => inputRef.current?.click()} className="shrink-0 font-semibold text-violet-700 hover:underline">Choose another</button></div></div>
      : <div role="button" tabIndex={0} onClick={() => inputRef.current?.click()} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); inputRef.current?.click(); } }} onDragOver={(event) => { event.preventDefault(); setDragging(true); }} onDragLeave={() => setDragging(false)} onDrop={(event) => { event.preventDefault(); setDragging(false); choose(event.dataTransfer.files?.[0]); }} className={`flex cursor-pointer flex-col items-center rounded-2xl border-2 border-dashed px-4 py-8 text-center transition ${dragging ? "border-violet-500 bg-violet-50" : "border-slate-300 bg-slate-50/50 hover:border-violet-400"}`}>
        <span className="flex h-14 w-14 items-center justify-center rounded-full bg-slate-100 text-slate-600"><Icon name="image" className="h-7 w-7" /></span>
        <p className="mt-3 text-sm font-semibold text-slate-900">Choose an image</p>
        <p className="mt-1 text-xs text-slate-500">Drag &amp; drop here, or click to browse</p>
        <p className="mt-0.5 text-[11px] text-slate-400">PNG, JPG, WebP or GIF · large photos are shrunk to fit {UPLOAD_LIMIT_LABEL}</p>
      </div>}
    <label className="block text-sm font-semibold text-slate-900">Alt text<input className={`${inputClass} mt-1.5`} value={alt} onChange={(event) => setAlt(event.target.value)} placeholder="Describe the image (optional)" /></label>
    {problem && <p role="alert" className={problemClass}>{problem}</p>}
  </DialogFrame>;
}

/** The player for a pasted video link, sized to fit a dialog or the sidebar. */
export function VideoPlayer({ embed, className = "" }: { embed: Embed; className?: string }) {
  return <iframe src={embed.src} title={`${embed.provider} video preview`} loading="lazy" allowFullScreen referrerPolicy="strict-origin-when-cross-origin" className={`aspect-video w-full rounded-xl border border-slate-200 bg-slate-900 ${className}`} />;
}

export function VideoDialog({ onInsert, onClose }: { onInsert: (embed: Embed) => void; onClose: () => void }) {
  const [url, setUrl] = useState("");
  const embed = parseEmbed(url);
  return <DialogFrame title="Insert video" onClose={onClose} footer={<>
    <button type="button" onClick={onClose} className={secondaryButton}>Cancel</button>
    <button type="button" disabled={!embed} onClick={() => embed && onInsert(embed)} className={primaryButton}><Icon name="video" className="h-[18px] w-[18px]" />Insert video</button>
  </>}>
    <label className="block text-sm font-semibold text-slate-900">Video link
      <span className="relative mt-1.5 block"><Icon name="link" className="pointer-events-none absolute left-3.5 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-slate-500" /><input autoFocus className={`${inputClass} pl-10`} value={url} onChange={(event) => setUrl(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter" && embed) { event.preventDefault(); onInsert(embed); } }} placeholder="Paste a YouTube, Vimeo or Dailymotion link…" /></span>
    </label>
    {embed ? <VideoPlayer embed={embed} /> : <p className={url.trim() ? problemClass : "text-xs text-slate-500"}>{url.trim() ? "That is not a YouTube, Vimeo or Dailymotion link." : "The video appears in the article as an embedded player."}</p>}
  </DialogFrame>;
}

export function TableDialog({ onInsert, onClose }: { onInsert: (rows: number, columns: number, header: boolean) => void; onClose: () => void }) {
  const [rows, setRows] = useState(3);
  const [columns, setColumns] = useState(3);
  const [header, setHeader] = useState(true);
  const clamp = (value: string, max: number) => Math.min(max, Math.max(1, Math.floor(Number(value)) || 1));
  return <DialogFrame title="Insert table" onClose={onClose} footer={<>
    <button type="button" onClick={onClose} className={secondaryButton}>Cancel</button>
    <button type="button" onClick={() => onInsert(rows, columns, header)} className={primaryButton}><Icon name="table" className="h-[18px] w-[18px]" />Insert table</button>
  </>}>
    <div className="grid grid-cols-2 gap-4">
      <label className="block text-sm font-semibold text-slate-900">Rows<input type="number" min={1} max={20} className={`${inputClass} mt-1.5`} value={rows} onChange={(event) => setRows(clamp(event.target.value, 20))} /></label>
      <label className="block text-sm font-semibold text-slate-900">Columns<input type="number" min={1} max={8} className={`${inputClass} mt-1.5`} value={columns} onChange={(event) => setColumns(clamp(event.target.value, 8))} /></label>
    </div>
    <label className="flex items-center gap-2.5 text-sm text-slate-700"><input type="checkbox" className="h-4 w-4 accent-violet-700" checked={header} onChange={(event) => setHeader(event.target.checked)} />First row is a heading</label>
  </DialogFrame>;
}
/* eslint-enable @next/next/no-img-element */
