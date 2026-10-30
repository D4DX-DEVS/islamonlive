"use client";

/* eslint-disable @next/next/no-img-element -- previews an address the admin typed or uploaded, on any host */

import { useRef, useState } from "react";
import { Icon } from "../icons";
import { IMAGE_TYPES } from "@/lib/admin-upload";
import { prepareImage, uploadMedia, type UploadedMedia } from "../media-client";
import { MAX_BANNERS, MAX_EMBED_URL, embedFor, safeDay, safeHref, todayInIndia, type BannerItem, type CustomSection, type HomeSection } from "@/lib/home-layout/schema";
import { META_PARTS, type MetaPart } from "@/lib/home-layout/theme";
import { Field, TextInput, iconButton, secondaryButton } from "./parts";

/* The builder's less common section settings: schedule, card details, the
   promo-banner list, the text-and-embed block and image uploads. Split from
   SectionSettings to keep each file to one job. */

/** "Upload a picture" for an image field: shrinks big photos, sends them to the media library, hands back the address and size. */
export function ImageUpload({ alt, onUploaded, label = "Upload a picture" }: { alt: string; onUploaded: (media: UploadedMedia) => void; label?: string }) {
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function upload(file?: File) {
    if (!file) return;
    setBusy(true); setError("");
    try { onUploaded(await uploadMedia(await prepareImage(file), "image", alt)); } catch (problem) { setError(problem instanceof Error ? problem.message : "The upload did not go through."); } finally { setBusy(false); }
  }
  return <div>
    <input ref={input} type="file" accept={IMAGE_TYPES.join(",")} className="hidden" onChange={(event) => { void upload(event.target.files?.[0]); event.target.value = ""; }} />
    <button type="button" disabled={busy} onClick={() => input.current?.click()} className={`${secondaryButton} w-full`}><Icon name="upload" className={`h-4 w-4 ${busy ? "animate-pulse" : ""}`} />{busy ? "Uploading…" : label}</button>
    {error && <p role="alert" className="mt-1 text-xs font-medium text-red-700">{error}</p>}
  </div>;
}

/** When readers see the section: from / until a day, in India time. */
export function ScheduleFields({ section, set }: { section: HomeSection; set: (patch: Partial<HomeSection>) => void }) {
  const today = todayInIndia();
  const bad = section.showFrom && section.showUntil && section.showUntil < section.showFrom;
  const state = !section.showFrom && !section.showUntil ? null
    : section.showUntil && section.showUntil < today ? "Ended: readers no longer see it."
      : section.showFrom && section.showFrom > today ? `Starts on ${section.showFrom}: readers do not see it yet.`
        : "Showing now.";
  const dateClass = "min-h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-900 shadow-sm focus-visible:border-violet-500 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-violet-100";
  return <div className="space-y-3">
    <div className="grid grid-cols-2 gap-3">
      <Field label="Show from"><input type="date" value={section.showFrom} max={section.showUntil || undefined} onChange={(event) => set({ showFrom: safeDay(event.target.value) })} className={dateClass} /></Field>
      <Field label="Show until"><input type="date" value={section.showUntil} min={section.showFrom || undefined} onChange={(event) => set({ showUntil: safeDay(event.target.value) })} className={dateClass} /></Field>
    </div>
    <p className="text-xs leading-relaxed text-slate-500">Both days included, India time. Empty = no limit. The change reaches readers within a few minutes of midnight; the preview always shows the section.</p>
    {bad && <p role="alert" className="text-xs font-medium text-red-700">“Until” is before “from”: the end date will be dropped.</p>}
    {state && !bad && <p className="rounded-lg bg-sky-50 px-3 py-2 text-xs text-sky-900">{state}</p>}
    {(section.showFrom || section.showUntil) && <button type="button" onClick={() => set({ showFrom: "", showUntil: "" })} className="text-xs font-semibold text-violet-700 hover:underline">Remove the schedule</button>}
  </div>;
}

/** Which card details (category label, author, date, summary) the section shows. */
export function CardDetails({ hide, onChange }: { hide: MetaPart[]; onChange: (hide: MetaPart[]) => void }) {
  return <fieldset>
    <legend className="text-sm font-semibold text-slate-900">Show on the cards</legend>
    <div className="mt-1.5 flex flex-wrap gap-2">
      {META_PARTS.map((part) => {
        const shown = !hide.includes(part.key);
        return <button key={part.key} type="button" role="checkbox" aria-checked={shown} onClick={() => { const next = shown ? [...hide, part.key] : hide.filter((h) => h !== part.key); onChange(META_PARTS.map((p) => p.key).filter((key) => next.includes(key))); }} className={`inline-flex min-h-11 items-center gap-1.5 rounded-full border px-3 text-xs font-semibold transition ${shown ? "border-violet-300 bg-violet-50 text-violet-800" : "border-slate-200 bg-white text-slate-400 line-through"}`}>
          <Icon name={shown ? "check" : "close"} className="h-3.5 w-3.5" />{part.label}
        </button>;
      })}
    </div>
  </fieldset>;
}

const blankBanner: BannerItem = { img: "", href: "", alt: "", width: 1440, height: 120 };

/** The promo banners, edited in place; an empty list keeps the saved promo strip. */
export function BannersEditor({ items, onChange }: { items: BannerItem[]; onChange: (items: BannerItem[]) => void }) {
  const [draft, setDraft] = useState<BannerItem>(blankBanner);
  const update = (index: number, patch: Partial<BannerItem>) => onChange(items.map((item, i) => (i === index ? { ...item, ...patch } : item)));
  const move = (from: number, to: number) => { const next = [...items]; const [item] = next.splice(from, 1); next.splice(to, 0, item); onChange(next); };
  return <div className="space-y-3">
    {items.length === 0 && <p className="rounded-lg bg-slate-50 px-3 py-2 text-xs leading-relaxed text-slate-600">No banners of its own: the section shows the saved promo strip (computers only). Add a banner to replace it with your own.</p>}
    {items.map((item, index) => <div key={index} className="space-y-2 rounded-xl border border-slate-200 p-2">
      <div className="overflow-hidden rounded-lg bg-slate-100">{safeHref(item.img) ? <img src={item.img} alt="" className="h-auto w-full" /> : <p className="p-3 text-xs text-amber-700">The picture address must start with https:// or /.</p>}</div>
      <TextInput value={item.href} onChange={(href) => update(index, { href })} placeholder="Opens when clicked: /support-us or https://…" />
      {item.href && !safeHref(item.href) && <p role="alert" className="text-xs font-medium text-red-700">Links must start with / or https://.</p>}
      <TextInput value={item.alt} onChange={(alt) => update(index, { alt })} placeholder="Description for screen readers" />
      <div className="flex items-center gap-1">
        <span className="min-w-0 flex-1 truncate px-1 text-[11px] text-slate-400">{item.width} × {item.height}px</span>
        <button type="button" aria-label="Move banner up" disabled={index === 0} onClick={() => move(index, index - 1)} className={iconButton}><Icon name="arrowUp" className="h-4 w-4" /></button>
        <button type="button" aria-label="Move banner down" disabled={index === items.length - 1} onClick={() => move(index, index + 1)} className={iconButton}><Icon name="arrowUp" className="h-4 w-4 rotate-180" /></button>
        <button type="button" aria-label={`Remove banner ${index + 1}`} onClick={() => onChange(items.filter((_, i) => i !== index))} className={`${iconButton} hover:text-red-600`}><Icon name="trash" className="h-4 w-4" /></button>
      </div>
    </div>)}
    {items.length < MAX_BANNERS && <div className="space-y-2 rounded-xl border border-dashed border-slate-300 p-3">
      <p className="text-xs font-semibold text-slate-600">Add a banner</p>
      <ImageUpload alt={draft.alt} onUploaded={(media) => { onChange([...items, { ...draft, img: media.url, width: media.width ?? 1440, height: media.height ?? 120 }]); setDraft(blankBanner); }} />
      <div className="flex gap-2">
        <TextInput value={draft.img} onChange={(img) => setDraft({ ...draft, img })} placeholder="…or paste a picture address" />
        <button type="button" disabled={!safeHref(draft.img)} onClick={() => { onChange([...items, draft]); setDraft(blankBanner); }} className={`${secondaryButton} shrink-0`}>Add</button>
      </div>
    </div>}
  </div>;
}

/** The text-and-embed block's own fields. */
export function CustomFields({ section, set }: { section: CustomSection; set: (patch: Partial<CustomSection>) => void }) {
  const embed = section.embedUrl.trim() ? embedFor(section.embedUrl) : null;
  return <div className="space-y-4">
    <Field label="Text" hint="Plain text. Leave a blank line between paragraphs."><textarea value={section.text} onChange={(event) => set({ text: event.target.value })} rows={6} maxLength={2000} className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm leading-relaxed text-slate-900 shadow-sm focus-visible:border-violet-500 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-violet-100" /></Field>
    <div className="grid grid-cols-2 gap-3">
      <Field label="Button text"><TextInput value={section.buttonLabel} onChange={(buttonLabel) => set({ buttonLabel })} placeholder="Support us" /></Field>
      <Field label="Button link"><TextInput value={section.buttonHref} onChange={(buttonHref) => set({ buttonHref })} placeholder="/support-us" /></Field>
    </div>
    {section.buttonHref && !safeHref(section.buttonHref) && <p role="alert" className="text-xs font-medium text-red-700">Links must start with / or https:// — this one will be dropped.</p>}
    {section.buttonLabel && !section.buttonHref && <p className="text-xs text-amber-700">Add a link, or the button does not show.</p>}
    <Field label="Embed" hint="A YouTube or Vimeo video, a Spotify episode or show, a Google Form (the “Send → link” address) or a Google Maps “Embed a map” address."><TextInput value={section.embedUrl} onChange={(embedUrl) => set({ embedUrl })} placeholder="https://www.youtube.com/watch?v=…" maxLength={MAX_EMBED_URL} /></Field>
    {section.embedUrl.trim() && (embed ? <p className="text-xs text-emerald-700">Recognised: {embed.title}.</p> : <p role="alert" className="text-xs font-medium text-red-700">This address is not one of the supported players, forms or maps; it will be dropped.</p>)}
  </div>;
}
