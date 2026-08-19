"use client";

import { useMemo, useRef, useState } from "react";
import Image from "next/image";
import { Episode } from "@/lib/podcast";

const RATES = [1, 1.25, 1.5, 2];

/* ponytail: two inline paths instead of an icon dependency */
function PlayPauseIcon({ paused, className = "h-5 w-5" }: { paused: boolean; className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden className={className}>
      {/* both paths are centred on the 24x24 box so the glyph sits dead centre in its circle */}
      {paused ? <path d="M7 5v14l10-7z" /> : <path d="M8 5h3v14H8V5Zm5 0h3v14h-3V5Z" />}
    </svg>
  );
}

function fmt(sec: number): string {
  if (!isFinite(sec) || sec <= 0) return "00:00";
  const m = Math.floor(sec / 60), s = Math.floor(sec % 60);
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

/* Spotify-style dark player: gradient header with big artwork, green play
   button, numbered track list. Same audio logic as before. */
export default function PodcastPlayer({ episodes, listHeight = 480, spotifyUrl }: { episodes: Episode[]; listHeight?: number; spotifyUrl?: string }) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [idx, setIdx] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [rate, setRate] = useState(1);
  const [time, setTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [q, setQ] = useState("");
  const [page, setPage] = useState(0);
  const PER_PAGE = 20;

  const ep = episodes[idx];
  const filtered = useMemo(
    () => episodes.map((e, i) => ({ e, i })).filter(({ e }) => e.title.toLowerCase().includes(q.toLowerCase())),
    [episodes, q]
  );

  const play = (i: number) => {
    if (i === idx) {
      const a = audioRef.current;
      if (!a) return;
      if (a.paused) { a.play(); } else { a.pause(); }
      return;
    }
    setIdx(i);
    setTime(0);
    // let React swap the src, then start
    requestAnimationFrame(() => audioRef.current?.play());
  };

  const skip = (s: number) => {
    const a = audioRef.current;
    if (a) a.currentTime = Math.max(0, Math.min(a.duration || 0, a.currentTime + s));
  };

  const cycleRate = () => {
    const next = RATES[(RATES.indexOf(rate) + 1) % RATES.length];
    setRate(next);
    if (audioRef.current) audioRef.current.playbackRate = next;
  };

  if (!ep) return null;

  return (
    <div className="overflow-hidden rounded-2xl bg-[#121212] text-white shadow-xl">
      <audio
        ref={audioRef}
        src={ep.audioUrl}
        preload="none"
        onPlay={() => { setPlaying(true); if (audioRef.current) audioRef.current.playbackRate = rate; }}
        onPause={() => setPlaying(false)}
        onTimeUpdate={(e) => setTime(e.currentTarget.currentTime)}
        onLoadedMetadata={(e) => setDuration(e.currentTarget.duration)}
        onEnded={() => idx < episodes.length - 1 && play(idx + 1)}
      />

      {/* gradient header: artwork + now playing */}
      <div className="bg-gradient-to-b from-purple-800 via-purple-950/80 to-[#121212] p-5 sm:p-6">
        <div className="flex items-end gap-4 sm:gap-5">
          <div className="relative h-24 w-24 shrink-0 overflow-hidden rounded-lg bg-zinc-800 shadow-2xl sm:h-36 sm:w-36">
            {ep.image ? (
              <Image src={ep.image} alt="" fill sizes="144px" className="object-cover" unoptimized />
            ) : (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img src="/icon-192.png" alt="" className="h-full w-full object-cover" />
            )}
          </div>
          <div className="min-w-0 flex-1">
            <p className="pill text-[10px] font-semibold uppercase tracking-widest text-purple-200">Podcast · Episode {idx + 1}</p>
            <h3 className="mt-1 line-clamp-2 text-lg font-extrabold leading-snug sm:text-2xl">{ep.title}</h3>
            <p className="mt-1 text-xs text-purple-200/80">Islam Onlive · {episodes.length} episodes</p>
          </div>
        </div>

        {/* progress */}
        <div className="mt-5 flex items-center gap-3 text-[11px] text-zinc-300">
          <span className="w-10">{fmt(time)}</span>
          <input
            type="range" min={0} max={duration || 0} step={1} value={time}
            aria-label="Seek"
            onChange={(e) => { const t = Number(e.target.value); setTime(t); if (audioRef.current) audioRef.current.currentTime = t; }}
            className="h-1 flex-1 accent-[#1db954]"
          />
          <span className="w-10 text-right">{ep.duration || fmt(duration)}</span>
        </div>

        {/* transport */}
        <div className="mt-3 flex items-center justify-center gap-4 sm:gap-5">
          <button aria-label="Playback speed" onClick={cycleRate} className="w-10 rounded-full border border-zinc-600 px-2 py-1 text-xs text-zinc-300 hover:border-white hover:text-white">{rate}x</button>
          <button aria-label="Previous" onClick={() => idx > 0 && play(idx - 1)} className="text-xl text-zinc-300 hover:text-white">⏮</button>
          <button aria-label="Back 10s" onClick={() => skip(-10)} className="text-xs text-zinc-300 hover:text-white">-10s</button>
          <button
            aria-label={playing ? "Pause" : "Play"}
            onClick={() => play(idx)}
            className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-[#1db954] text-black shadow-lg transition hover:scale-105"
          >
            <PlayPauseIcon paused={!playing} className="h-6 w-6" />
          </button>
          <button aria-label="Forward 30s" onClick={() => skip(30)} className="text-xs text-zinc-300 hover:text-white">+30s</button>
          <button aria-label="Next" onClick={() => idx < episodes.length - 1 && play(idx + 1)} className="text-xl text-zinc-300 hover:text-white">⏭</button>
          {spotifyUrl && (
            <a href={spotifyUrl} target="_blank" rel="noopener noreferrer" aria-label="Open in Spotify" title="Open in Spotify"
               className="hidden text-zinc-300 hover:text-[#1db954] sm:block">
              <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden className="h-6 w-6">
                <path d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20Zm4.6 14.5a.62.62 0 0 1-.86.2c-2.36-1.44-5.33-1.76-8.82-.96a.62.62 0 1 1-.28-1.21c3.82-.88 7.1-.5 9.75 1.11.3.18.39.57.21.86Zm1.23-2.73a.78.78 0 0 1-1.07.26c-2.7-1.66-6.82-2.14-10.01-1.17a.78.78 0 1 1-.45-1.49c3.65-1.11 8.19-.57 11.27 1.33.37.22.48.7.26 1.07Zm.1-2.85C14.7 9 9.35 8.82 6.26 9.76a.93.93 0 1 1-.54-1.79c3.55-1.07 9.44-.86 13.16 1.35a.93.93 0 0 1-.95 1.6Z" />
              </svg>
            </a>
          )}
        </div>
      </div>

      {/* search + track list */}
      <div className="p-4 sm:p-5">
        <input
          type="search" value={q} onChange={(e) => { setQ(e.target.value); setPage(0); }} placeholder="Search episodes"
          className="w-full rounded-full border border-zinc-700 bg-zinc-900 px-4 py-2 text-sm text-white outline-none placeholder:text-zinc-500 focus:border-[#1db954]"
        />
        <div className="mt-2 overflow-y-auto" style={{ maxHeight: listHeight }}>
          {filtered.slice(page * PER_PAGE, (page + 1) * PER_PAGE).map(({ e, i }, n) => (
            <button
              key={e.audioUrl}
              onClick={() => play(i)}
              className={`group flex w-full items-center gap-3 rounded-md px-2 py-2.5 text-left text-sm hover:bg-white/10 ${i === idx ? "text-[#1db954]" : "text-zinc-200"}`}
            >
              <span className="w-7 shrink-0 text-center text-xs text-zinc-500">
                <span className="group-hover:hidden">{i === idx && playing ? "▮▮" : page * PER_PAGE + n + 1}</span>
                <span className="hidden group-hover:inline">
                  <PlayPauseIcon paused={!(i === idx && playing)} className="mx-auto h-3.5 w-3.5" />
                </span>
              </span>
              <span className={`line-clamp-1 flex-1 ${i === idx ? "font-semibold" : ""}`}>{e.title}</span>
              {e.duration && <span className="shrink-0 text-xs text-zinc-500">{e.duration}</span>}
            </button>
          ))}
        </div>
        {filtered.length > PER_PAGE && (
          <div className="mt-3 flex items-center justify-center gap-4 text-sm text-zinc-300">
            <button
              onClick={() => setPage(page - 1)}
              disabled={page === 0}
              className="rounded-full border border-zinc-700 px-4 py-1.5 font-semibold hover:border-white hover:text-white disabled:opacity-30 disabled:hover:border-zinc-700"
            >
              ← Prev
            </button>
            <span className="text-xs text-zinc-500">
              {page + 1} / {Math.ceil(filtered.length / PER_PAGE)} · {filtered.length} episodes
            </span>
            <button
              onClick={() => setPage(page + 1)}
              disabled={(page + 1) * PER_PAGE >= filtered.length}
              className="rounded-full border border-zinc-700 px-4 py-1.5 font-semibold hover:border-white hover:text-white disabled:opacity-30 disabled:hover:border-zinc-700"
            >
              Next →
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
