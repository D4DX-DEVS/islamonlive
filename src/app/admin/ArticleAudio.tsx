"use client";

import { useRef, useState } from "react";
import { AUDIO_TYPES, UPLOAD_LIMIT_LABEL } from "@/lib/admin-upload";
import { MAX_SPOTIFY_URL, spotifyEmbed } from "@/lib/spotify";
import { CardTitle } from "./form-parts";
import { Icon } from "./icons";
import { checkAudio, uploadMedia } from "./media-client";
import { cardClass, inputClass } from "./ui";

/** True when the link is filled in but is not one the article page can play. */
export const spotifyInvalid = (url: string) => Boolean(url.trim()) && !spotifyEmbed(url);

/** An audio file uploaded to the media library. */
export type AudioFile = { url: string; name: string };

interface ArticleAudioCardProps {
  value: string;
  onChange: (value: string) => void;
  file: AudioFile | null;
  onFileChange: (file: AudioFile | null) => void;
  onBusyChange: (busy: boolean) => void;
}

const tabClass = (active: boolean) => `min-h-10 flex-1 rounded-lg px-3 text-sm font-semibold transition ${active ? "bg-violet-700 text-white shadow-sm" : "text-slate-700 hover:bg-white"}`;

/** The optional audio for an article: a Spotify link and/or an uploaded audio file, with the player readers will see. */
export default function ArticleAudioCard({ value, onChange, file, onFileChange, onBusyChange }: ArticleAudioCardProps) {
  const embed = spotifyEmbed(value);
  const inputRef = useRef<HTMLInputElement>(null);
  const [tab, setTab] = useState<"spotify" | "upload" | null>(null);
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState("");
  const [dragging, setDragging] = useState(false);
  // until the editor picks a tab, open the one that holds the article's audio
  const mode = tab ?? (file && !value ? "upload" : "spotify");

  async function upload(chosen?: File) {
    if (!chosen) return;
    const refusal = checkAudio(chosen);
    if (refusal) { setProblem(refusal); return; }
    setProblem(""); setBusy(true); onBusyChange(true);
    try { const media = await uploadMedia(chosen, "audio"); onFileChange({ url: media.url, name: chosen.name }); }
    catch (failure) { setProblem(failure instanceof Error ? failure.message : "The audio could not be uploaded."); }
    finally { setBusy(false); onBusyChange(false); }
  }

  return <section className={`${cardClass} space-y-4`}>
    <CardTitle icon="headphones">Audio <span className="font-medium text-slate-500">(Optional)</span></CardTitle>
    <div role="tablist" aria-label="Audio source" className="flex gap-1 rounded-xl bg-slate-100 p-1">
      <button type="button" role="tab" aria-selected={mode === "spotify"} onClick={() => setTab("spotify")} className={tabClass(mode === "spotify")}>Spotify link</button>
      <button type="button" role="tab" aria-selected={mode === "upload"} onClick={() => setTab("upload")} className={tabClass(mode === "upload")}>Upload Audio</button>
    </div>
    {mode === "spotify" ? <>
      <label className="block"><span className="sr-only">Spotify link</span>
        <span className="relative block">
          <Icon name="link" className="pointer-events-none absolute left-3.5 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-slate-500" />
          <input className={`${inputClass} pl-10 ${value ? "pr-16" : ""}`} value={value} maxLength={MAX_SPOTIFY_URL} onChange={(event) => onChange(event.target.value)} placeholder="Paste Spotify link…" inputMode="url" />
          {value && <button type="button" onClick={() => onChange("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-semibold text-violet-700 hover:underline">Clear</button>}
        </span>
      </label>
      {embed ? <iframe title="Spotify player preview" src={embed.src} height={embed.height} loading="lazy" allow="encrypted-media; clipboard-write" className="w-full rounded-xl border-0" />
        : value.trim() ? <p role="alert" className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">That is not a Spotify episode, show, track, playlist or album link.</p>
        : <div className="flex flex-col items-center rounded-xl border border-dashed border-slate-300 bg-slate-50/60 px-4 py-7 text-center"><span className="flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 text-slate-400"><Icon name="headphones" className="h-6 w-6" /></span><p className="mt-3 text-sm font-medium text-slate-800">Audio player will appear here</p><p className="mt-0.5 text-xs text-slate-500">In Spotify use Share → Copy link. Readers can play it on the article.</p></div>}
    </> : <>
      <input ref={inputRef} className="hidden" type="file" accept={AUDIO_TYPES.join(",")} onChange={(event) => { void upload(event.target.files?.[0]); event.target.value = ""; }} />
      {file ? <div className="space-y-3">
        <audio key={file.url} controls preload="metadata" src={file.url} className="w-full" />
        <p className="break-all text-xs text-slate-500">{file.name}</p>
        <div className="flex gap-2">
          <button type="button" disabled={busy} onClick={() => inputRef.current?.click()} className="min-h-10 flex-1 rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold hover:bg-slate-50 disabled:opacity-50">{busy ? "Uploading…" : "Replace"}</button>
          <button type="button" disabled={busy} onClick={() => onFileChange(null)} className="min-h-10 flex-1 rounded-xl border border-red-200 bg-white px-3 text-sm font-semibold text-red-700 hover:bg-red-50 disabled:opacity-50">Remove</button>
        </div>
      </div> : <div role="button" tabIndex={0} aria-busy={busy} onClick={() => { if (!busy) inputRef.current?.click(); }} onKeyDown={(event) => { if (!busy && (event.key === "Enter" || event.key === " ")) { event.preventDefault(); inputRef.current?.click(); } }} onDragOver={(event) => { event.preventDefault(); setDragging(true); }} onDragLeave={() => setDragging(false)} onDrop={(event) => { event.preventDefault(); setDragging(false); if (!busy) void upload(event.dataTransfer.files?.[0]); }} className={`flex cursor-pointer flex-col items-center rounded-xl border-2 border-dashed px-4 py-7 text-center transition ${dragging ? "border-violet-500 bg-violet-50" : "border-slate-300 bg-slate-50/50 hover:border-violet-400"}`}>
        <span className="flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 text-slate-500"><Icon name="headphones" className="h-6 w-6" /></span>
        <p className="mt-3 text-sm font-semibold text-slate-900">{busy ? "Uploading audio…" : "Choose an audio file"}</p>
        <p className="mt-1 text-xs text-slate-500">Drag &amp; drop an audio file here, or click to browse</p>
        <p className="mt-0.5 text-[11px] text-slate-400">MP3, M4A, AAC, WAV or OGG · up to {UPLOAD_LIMIT_LABEL}</p>
        <span className="mt-4 flex min-h-10 items-center gap-2 rounded-xl border border-violet-300 bg-white px-4 text-sm font-semibold text-violet-700"><Icon name="upload" className="h-4 w-4" />Select audio</span>
      </div>}
      <p className="text-xs text-slate-500">Longer recordings are best published on Spotify and added as a link.</p>
    </>}
    {problem && <p role="alert" className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">{problem}</p>}
  </section>;
}
