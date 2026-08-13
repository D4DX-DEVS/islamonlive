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

export default function PodcastPlayer({ episodes, listHeight = 480, spotifyUrl }: { episodes: Episode[]; listHeight?: number; spotifyUrl?: string }) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [idx, setIdx] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [rate, setRate] = useState(1);
  const [time, setTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [q, setQ] = useState("");
  const [visible, setVisible] = useState(20);

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
    <div className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm">
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
      {/* main player */}
      <div className="flex gap-4">
        {ep.image && (
          <div className="relative hidden h-28 w-28 shrink-0 overflow-hidden rounded-lg bg-zinc-100 sm:block">
            <Image src={ep.image} alt="" fill sizes="112px" className="object-cover" unoptimized />
          </div>
        )}
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <h3 className="truncate text-base font-bold">{ep.title}</h3>
            {spotifyUrl && (
              <a href={spotifyUrl} target="_blank" rel="noopener noreferrer"
                 className="inline-flex shrink-0 items-center justify-center rounded-full border border-purple-700 px-3 py-1 text-xs font-semibold text-purple-800 transition hover:bg-purple-800 hover:text-white">
                Listen on Spotify
              </a>
            )}
          </div>
          <p className="text-xs text-zinc-500">Islam Onlive · {episodes.length} episodes</p>
          <div className="mt-3 flex items-center gap-3">
            <button
              aria-label={playing ? "Pause" : "Play"}
              onClick={() => play(idx)}
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-purple-800 text-white shadow-sm transition hover:bg-purple-700"
            >
              <PlayPauseIcon paused={!playing} className="h-5 w-5" />
            </button>
            <button aria-label="Previous" onClick={() => idx > 0 && play(idx - 1)} className="text-zinc-500 hover:text-purple-800">⏮</button>
            <button aria-label="Back 10s" onClick={() => skip(-10)} className="rounded-full border border-zinc-300 px-2 py-1 text-xs text-zinc-600 hover:border-purple-700">-10</button>
            <button aria-label="Playback speed" onClick={cycleRate} className="rounded-full border border-zinc-300 px-2 py-1 text-xs text-zinc-600 hover:border-purple-700">{rate}x</button>
            <button aria-label="Forward 30s" onClick={() => skip(30)} className="rounded-full border border-zinc-300 px-2 py-1 text-xs text-zinc-600 hover:border-purple-700">+30</button>
            <button aria-label="Next" onClick={() => idx < episodes.length - 1 && play(idx + 1)} className="text-zinc-500 hover:text-purple-800">⏭</button>
          </div>
        </div>
      </div>
      {/* progress */}
      <div className="mt-3 flex items-center gap-3 text-xs text-zinc-500">
        <span className="w-10">{fmt(time)}</span>
        <input
          type="range" min={0} max={duration || 0} step={1} value={time}
          onChange={(e) => { const t = Number(e.target.value); setTime(t); if (audioRef.current) audioRef.current.currentTime = t; }}
          className="h-1 flex-1 accent-purple-700"
        />
        <span className="w-10 text-right">{ep.duration || fmt(duration)}</span>
      </div>
      {/* search */}
      <input
        type="search" value={q} onChange={(e) => { setQ(e.target.value); setVisible(20); }} placeholder="Search Episodes"
        className="mt-4 w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm outline-none focus:border-purple-700"
      />
      {/* episode list */}
      <div className="mt-2 divide-y divide-zinc-100 overflow-y-auto" style={{ maxHeight: listHeight }}>
        {filtered.slice(0, visible).map(({ e, i }) => (
          <button
            key={e.audioUrl}
            onClick={() => play(i)}
            className={`flex w-full items-center gap-3 px-2 py-3 text-left text-sm hover:bg-purple-50 ${i === idx ? "bg-purple-50 font-semibold text-purple-900" : "text-zinc-700"}`}
          >
            <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full border ${i === idx && playing ? "border-purple-700 bg-purple-700 text-white" : "border-zinc-300 text-zinc-500"}`}>
              <PlayPauseIcon paused={!(i === idx && playing)} className="h-3.5 w-3.5" />
            </span>
            <span className="line-clamp-1 flex-1">{e.title}</span>
            {e.duration && <span className="shrink-0 text-xs text-zinc-400">{e.duration}</span>}
          </button>
        ))}
        {filtered.length > visible && (
          <button
            onClick={() => setVisible(visible + 20)}
            className="w-full rounded-b-lg bg-purple-50 py-3 text-sm font-semibold text-purple-800 hover:bg-purple-100"
          >
            Load more ({visible} of {filtered.length})
          </button>
        )}
      </div>
    </div>
  );
}
