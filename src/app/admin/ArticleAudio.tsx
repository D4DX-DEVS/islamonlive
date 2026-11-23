"use client";

import { MAX_SPOTIFY_URL, spotifyEmbed } from "@/lib/spotify";
import { CardTitle } from "./form-parts";
import { Icon } from "./icons";
import { cardClass, inputClass } from "./ui";

/** True when the link is filled in but is not one the article page can play. */
export const spotifyInvalid = (url: string) => Boolean(url.trim()) && !spotifyEmbed(url);

/** The optional Spotify audio for an article: a link, with the player readers will see. */
export default function ArticleAudioCard({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  const embed = spotifyEmbed(value);
  return <section className={`${cardClass} space-y-4`}>
    <CardTitle icon="headphones">Audio <span className="font-medium text-slate-500">(Optional)</span></CardTitle>
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
  </section>;
}
