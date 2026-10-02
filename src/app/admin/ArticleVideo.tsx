"use client";

import { useRef, useState } from "react";
import { UPLOAD_LIMIT_LABEL, VIDEO_TYPES } from "@/lib/admin-upload";
import { parseEmbed } from "@/lib/video-embed";
import { VideoPlayer } from "./EditorDialogs";
import { CardTitle } from "./form-parts";
import { Icon } from "./icons";
import { checkVideo, uploadMedia } from "./media-client";
import { cardClass, inputClass } from "./ui";

/** What the editor has set for the featured video: a link, or an uploaded file, whichever tab is open. */
export type VideoChoice = { mode: "url" | "upload"; url: string; media: { id: number; url: string; name: string } | null };

export const noVideo: VideoChoice = { mode: "url", url: "", media: null };

/** What a choice amounts to: "none", "embed:<link>", "self:<id>", or "invalid" for a link that is not a supported video. */
export function videoKey(choice: VideoChoice): string {
  if (choice.mode === "upload") return choice.media ? `self:${choice.media.id}` : "none";
  const text = choice.url.trim();
  if (!text) return "none";
  const embed = parseEmbed(text);
  return embed ? `embed:${embed.url}` : "invalid";
}

/** The form field the API reads: what to attach, or null when the video is as it was. */
export function videoPayload(choice: VideoChoice): string | null {
  const key = videoKey(choice);
  if (key === "invalid") return null;
  if (key.startsWith("embed:")) return JSON.stringify({ source: "embed", url: key.slice(6) });
  if (key.startsWith("self:")) return JSON.stringify({ source: "self", mediaId: Number(key.slice(5)) });
  return JSON.stringify({ source: "none" });
}

const tabClass = (active: boolean) => `min-h-10 flex-1 rounded-lg px-3 text-sm font-semibold transition ${active ? "bg-violet-700 text-white shadow-sm" : "text-slate-700 hover:bg-white"}`;

export default function FeaturedVideoCard({ value, onChange, onBusyChange, unavailable }: { value: VideoChoice; onChange: (value: VideoChoice) => void; onBusyChange: (busy: boolean) => void; /** Why a video cannot be set on this article, when it cannot. */ unavailable?: string }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState("");
  const [dragging, setDragging] = useState(false);
  const embed = value.mode === "url" ? parseEmbed(value.url) : null;

  async function upload(file?: File) {
    if (!file) return;
    const refusal = checkVideo(file);
    if (refusal) { setProblem(refusal); return; }
    setProblem(""); setBusy(true); onBusyChange(true);
    try { const media = await uploadMedia(file, "video"); onChange({ ...value, media: { id: media.id, url: media.url, name: file.name } }); }
    catch (failure) { setProblem(failure instanceof Error ? failure.message : "The video could not be uploaded."); }
    finally { setBusy(false); onBusyChange(false); }
  }

  return <section className={`${cardClass} space-y-4`}>
    <CardTitle icon="video">Featured video <span className="font-medium text-slate-500">(Optional)</span></CardTitle>
    {unavailable ? <p className="rounded-xl bg-amber-50 px-3 py-2.5 text-sm text-amber-800">{unavailable}</p> : <>
      <div role="tablist" aria-label="Video source" className="flex gap-1 rounded-xl bg-slate-100 p-1">
        <button type="button" role="tab" aria-selected={value.mode === "url"} onClick={() => onChange({ ...value, mode: "url" })} className={tabClass(value.mode === "url")}>YouTube / URL</button>
        <button type="button" role="tab" aria-selected={value.mode === "upload"} onClick={() => onChange({ ...value, mode: "upload" })} className={tabClass(value.mode === "upload")}>Upload Video</button>
      </div>

      {value.mode === "url" ? <>
        <label className="block"><span className="sr-only">Video link</span>
          <span className="relative block"><Icon name="link" className="pointer-events-none absolute left-3.5 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-slate-500" /><input className={`${inputClass} pl-10 ${value.url ? "pr-16" : ""}`} value={value.url} onChange={(event) => onChange({ ...value, url: event.target.value })} placeholder="Paste YouTube URL…" inputMode="url" />{value.url && <button type="button" onClick={() => onChange({ ...value, url: "" })} className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-semibold text-violet-700 hover:underline">Clear</button>}</span>
        </label>
        {embed ? <VideoPlayer embed={embed} />
          : value.url.trim() ? <p role="alert" className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">That is not a YouTube, Vimeo or Dailymotion link.</p>
          : <div className="flex flex-col items-center rounded-xl border border-dashed border-slate-300 bg-slate-50/60 px-4 py-7 text-center"><span className="flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 text-slate-400"><Icon name="video" className="h-6 w-6" /></span><p className="mt-3 text-sm font-medium text-slate-800">Video preview will appear here</p><p className="mt-0.5 text-xs text-slate-500">Supports YouTube, Vimeo and Dailymotion links.</p></div>}
      </> : <>
        <input ref={inputRef} className="hidden" type="file" accept={VIDEO_TYPES.join(",")} onChange={(event) => { void upload(event.target.files?.[0]); event.target.value = ""; }} />
        {value.media ? <div className="space-y-3">
          <video key={value.media.url} controls preload="metadata" src={value.media.url} className="aspect-video w-full rounded-xl border border-slate-200 bg-slate-900" />
          <p className="break-all text-xs text-slate-500">{value.media.name}</p>
          <div className="flex gap-2">
            <button type="button" disabled={busy} onClick={() => inputRef.current?.click()} className="min-h-10 flex-1 rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold hover:bg-slate-50 disabled:opacity-50">{busy ? "Uploading…" : "Replace"}</button>
            <button type="button" disabled={busy} onClick={() => onChange({ ...value, media: null })} className="min-h-10 flex-1 rounded-xl border border-red-200 bg-white px-3 text-sm font-semibold text-red-700 hover:bg-red-50 disabled:opacity-50">Remove</button>
          </div>
        </div> : <div role="button" tabIndex={0} aria-busy={busy} onClick={() => { if (!busy) inputRef.current?.click(); }} onKeyDown={(event) => { if (!busy && (event.key === "Enter" || event.key === " ")) { event.preventDefault(); inputRef.current?.click(); } }} onDragOver={(event) => { event.preventDefault(); setDragging(true); }} onDragLeave={() => setDragging(false)} onDrop={(event) => { event.preventDefault(); setDragging(false); if (!busy) void upload(event.dataTransfer.files?.[0]); }} className={`flex cursor-pointer flex-col items-center rounded-xl border-2 border-dashed px-4 py-7 text-center transition ${dragging ? "border-violet-500 bg-violet-50" : "border-slate-300 bg-slate-50/50 hover:border-violet-400"}`}>
          <span className="flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 text-slate-500"><Icon name="video" className="h-6 w-6" /></span>
          <p className="mt-3 text-sm font-semibold text-slate-900">{busy ? "Uploading video…" : "Choose a video file"}</p>
          <p className="mt-1 text-xs text-slate-500">Drag &amp; drop a video here, or click to browse</p>
          <p className="mt-0.5 text-[11px] text-slate-400">MP4, WebM, MOV or OGG · up to {UPLOAD_LIMIT_LABEL}</p>
          <span className="mt-4 flex min-h-10 items-center gap-2 rounded-xl border border-violet-300 bg-white px-4 text-sm font-semibold text-violet-700"><Icon name="upload" className="h-4 w-4" />Select video</span>
        </div>}
        <p className="text-xs text-slate-500">Longer videos are best uploaded to YouTube or Vimeo and added as a link.</p>
      </>}
      {problem && <p role="alert" className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">{problem}</p>}
    </>}
  </section>;
}
