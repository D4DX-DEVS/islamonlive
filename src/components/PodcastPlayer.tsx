"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties } from "react";
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

function SpotifyIcon({ className = "h-5 w-5" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden className={className}>
      <path d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20Zm4.6 14.5a.62.62 0 0 1-.86.2c-2.36-1.44-5.33-1.76-8.82-.96a.62.62 0 1 1-.28-1.21c3.82-.88 7.1-.5 9.75 1.11.3.18.39.57.21.86Zm1.23-2.73a.78.78 0 0 1-1.07.26c-2.7-1.66-6.82-2.14-10.01-1.17a.78.78 0 1 1-.45-1.49c3.65-1.11 8.19-.57 11.27 1.33.37.22.48.7.26 1.07Zm.1-2.85C14.7 9 9.35 8.82 6.26 9.76a.93.93 0 1 1-.54-1.79c3.55-1.07 9.44-.86 13.16 1.35a.93.93 0 0 1-.95 1.6Z" />
    </svg>
  );
}

function fmt(sec: number): string {
  if (!isFinite(sec) || sec <= 0) return "00:00";
  const m = Math.floor(sec / 60), s = Math.floor(sec % 60);
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

interface Props {
  episodes: Episode[];
  listHeight?: number;
  /** track rows per page — the homepage keeps a short list, /listen shows a full page */
  perPage?: number;
  /** stretch to the container instead of a fixed list height — the homepage column uses it to absorb the sidebar's extra height */
  fill?: boolean;
  spotifyUrl?: string;
  /** "card" is the embeddable dark panel the homepage drops into a column.
      "page" is the /listen layout: one stage (artwork + transport) that pins to
      the side on desktop and docks to a mini bar on phones, plus a light episode
      list beside it. Both share this component's single <audio> and media
      session, which is why /listen no longer carries a second embedded player. */
  variant?: "card" | "page";
}

/* Spotify-style dark player: gradient stage with big artwork, green play
   button, numbered track list. Same audio logic in both variants. */
export default function PodcastPlayer({ episodes, listHeight = 480, perPage = 20, fill = false, spotifyUrl, variant = "card" }: Props) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const stageRef = useRef<HTMLElement>(null);
  const [idx, setIdx] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [rate, setRate] = useState(1);
  const [time, setTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [q, setQ] = useState("");
  const [page, setPage] = useState(0);
  // dock only once the stage has actually scrolled away; true here so the bar
  // never flashes on first paint
  const [stageOnScreen, setStageOnScreen] = useState(true);

  const ep = episodes[idx];
  const filtered = useMemo(
    () => episodes.map((e, i) => ({ e, i })).filter(({ e }) => e.title.toLowerCase().includes(q.toLowerCase())),
    [episodes, q]
  );

  // side effects stay OUT of the state updater: StrictMode invokes updaters twice,
  // which turned one tap into play()+pause(). Plain body, idx read from scope.
  const play = useCallback((i: number) => {
    if (i === idx) {
      const a = audioRef.current;
      if (!a) return;
      if (a.paused) a.play().catch(() => {}); else a.pause();
      return;
    }
    setIdx(i);
    setTime(0);
    // let React swap the src, then start
    requestAnimationFrame(() => audioRef.current?.play().catch(() => {}));
  }, [idx]);

  const skip = useCallback((s: number) => {
    const a = audioRef.current;
    if (a) a.currentTime = Math.max(0, Math.min(a.duration || 0, a.currentTime + s));
  }, []);

  const cycleRate = () => {
    const next = RATES[(RATES.indexOf(rate) + 1) % RATES.length];
    setRate(next);
    if (audioRef.current) audioRef.current.playbackRate = next;
  };

  /* Lock-screen / notification controls. Without these the OS has no media
     session to attach to and both Android Chrome and iOS suspend the audio a
     few seconds after the screen sleeps; with them playback survives sleep and
     the user gets real transport buttons. */
  useEffect(() => {
    const ms = typeof navigator !== "undefined" ? navigator.mediaSession : undefined;
    if (!ms || !ep) return;
    ms.metadata = new MediaMetadata({
      title: ep.topic || ep.title,
      artist: ep.speaker || "Islam Onlive",
      album: "Islam Onlive Podcast",
      artwork: [
        { src: ep.image || "/icon-512.png", sizes: "512x512", type: "image/png" },
        { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
      ],
    });
    const handlers: [MediaSessionAction, MediaSessionActionHandler][] = [
      ["play", () => audioRef.current?.play().catch(() => {})],
      ["pause", () => audioRef.current?.pause()],
      ["previoustrack", () => idx > 0 && play(idx - 1)],
      ["nexttrack", () => idx < episodes.length - 1 && play(idx + 1)],
      ["seekbackward", (d) => skip(-(d.seekOffset || 10))],
      ["seekforward", (d) => skip(d.seekOffset || 30)],
      ["seekto", (d) => { if (audioRef.current && d.seekTime != null) audioRef.current.currentTime = d.seekTime; }],
    ];
    // an unsupported action throws rather than no-ops in some browsers
    for (const [a, h] of handlers) { try { ms.setActionHandler(a, h); } catch {} }
    return () => { for (const [a] of handlers) { try { ms.setActionHandler(a, null); } catch {} } };
  }, [ep, idx, episodes.length, play, skip]);

  // keeps the OS widget's play/pause glyph in step with the element
  useEffect(() => {
    if (typeof navigator !== "undefined" && navigator.mediaSession) {
      navigator.mediaSession.playbackState = playing ? "playing" : "paused";
    }
  }, [playing]);

  // phones dock a mini bar the moment the stage leaves the viewport, the way a
  // podcast app keeps its transport reachable while you browse the list
  useEffect(() => {
    const el = stageRef.current;
    if (variant !== "page" || !el || typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver(([entry]) => setStageOnScreen(entry.isIntersecting), { threshold: 0 });
    io.observe(el);
    return () => io.disconnect();
  }, [variant]);

  // the homepage player is the only one with a scroll box
  const boxed = variant === "card" && !fill;

  const onSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const t = Number(e.target.value);
    setTime(t);
    if (audioRef.current) audioRef.current.currentTime = t;
  };

  if (!ep) return null;

  const audio = (
    <audio
      ref={audioRef}
      src={ep.audioUrl}
      preload="none"
      onPlay={() => { setPlaying(true); if (audioRef.current) audioRef.current.playbackRate = rate; }}
      onPause={() => setPlaying(false)}
      onTimeUpdate={(e) => {
        setTime(e.currentTarget.currentTime);
        const ms = navigator.mediaSession;
        if (ms?.setPositionState && isFinite(e.currentTarget.duration)) {
          try {
            ms.setPositionState({ duration: e.currentTarget.duration, playbackRate: e.currentTarget.playbackRate, position: e.currentTarget.currentTime });
          } catch {}
        }
      }}
      onLoadedMetadata={(e) => setDuration(e.currentTarget.duration)}
      onEnded={() => idx < episodes.length - 1 && play(idx + 1)}
    />
  );

  const artwork = (sizes: string) =>
    ep.image ? (
      <Image src={ep.image} alt="" fill sizes={sizes} className="object-cover" unoptimized />
    ) : (
      /* eslint-disable-next-line @next/next/no-img-element */
      <img src="/icon-192.png" alt="" className="h-full w-full object-cover" />
    );

  /* one row renderer for both variants — the dark card and the light /listen
     list differ only in their palette */
  const rows = (dark: boolean) =>
    filtered.slice(page * perPage, (page + 1) * perPage).map(({ e, i }, n) => (
      <button
        key={e.audioUrl}
        onClick={() => play(i)}
        className={`group flex w-full items-center gap-3 px-2 text-left text-sm ${
          dark
            ? `rounded-md py-2 hover:bg-white/10 sm:py-2.5 ${i === idx ? "text-[#1db954]" : "text-zinc-200"}`
            : `rounded-xl py-2.5 transition hover:bg-zinc-100 ${i === idx ? "bg-purple-50 text-purple-900" : "text-zinc-800"}`
        }`}
      >
        <span className={`w-7 shrink-0 text-center text-xs ${dark ? "text-zinc-500" : i === idx ? "text-purple-500" : "text-zinc-400"}`}>
          <span className="group-hover:hidden">{i === idx && playing ? "▮▮" : page * perPage + n + 1}</span>
          <span className="hidden group-hover:inline">
            <PlayPauseIcon paused={!(i === idx && playing)} className="mx-auto h-3.5 w-3.5" />
          </span>
        </span>
        {/* full label, never clipped — speaker credited underneath */}
        <span className="min-w-0 flex-1">
          <span className={`block leading-snug ${i === idx ? "font-semibold" : ""}`}>{e.topic}</span>
          {e.speaker && <span className={`mt-0.5 block truncate text-xs ${dark ? "text-zinc-400" : "text-zinc-500"}`}>{e.speaker}</span>}
        </span>
        {e.duration && <span className={`shrink-0 self-start pt-0.5 text-xs ${dark ? "text-zinc-500" : "text-zinc-400"}`}>{e.duration}</span>}
      </button>
    ));

  const pagerBtn = (dark: boolean) =>
    `rounded-full border px-4 py-1.5 font-semibold disabled:opacity-30 ${
      dark
        ? "border-zinc-700 hover:border-white hover:text-white disabled:hover:border-zinc-700"
        : "border-zinc-300 hover:border-purple-700 hover:text-purple-800 disabled:hover:border-zinc-300"
    }`;

  const pager = (dark: boolean) =>
    filtered.length > perPage ? (
      <div className={`mt-3 flex items-center justify-center gap-4 text-sm ${dark ? "text-zinc-300" : "text-zinc-600"}`}>
        <button onClick={() => setPage(page - 1)} disabled={page === 0} className={pagerBtn(dark)}>
          ← Prev
        </button>
        <span className={`text-xs ${dark ? "text-zinc-500" : "text-zinc-400"}`}>
          {page + 1} / {Math.ceil(filtered.length / perPage)} · {filtered.length} episodes
        </span>
        <button onClick={() => setPage(page + 1)} disabled={(page + 1) * perPage >= filtered.length} className={pagerBtn(dark)}>
          Next →
        </button>
      </div>
    ) : null;

  /* ───────────────────────────── /listen ───────────────────────────── */
  if (variant === "page") {
    return (
      <div className="lg:grid lg:grid-cols-[minmax(0,21rem)_minmax(0,1fr)] lg:items-start lg:gap-8">
        {audio}

        {/* stage: full-bleed on phones so it reads as the app's now-playing
            screen, a pinned sidebar from lg up */}
        <section
          ref={stageRef}
          className="-mx-4 bg-[#141014] bg-gradient-to-b from-purple-800 via-purple-900 to-[#141014] px-5 pb-5 pt-6 text-white shadow-xl sm:mx-0 sm:rounded-3xl sm:px-6 sm:pb-6 lg:sticky lg:top-24 lg:max-h-[calc(100dvh-7rem)] lg:overflow-y-auto"
        >
          {/* phone and desktop sidebar stack artwork over the title; the tablet
              band in between is wide enough that stacking left a lot of empty
              purple, so it runs them side by side instead */}
          <div className="sm:flex sm:items-center sm:gap-6 lg:block">
            <div className="relative mx-auto aspect-square w-40 shrink-0 overflow-hidden rounded-2xl bg-zinc-800 shadow-2xl sm:mx-0 sm:w-44 lg:w-full">
              {artwork("(min-width: 1024px) 336px, 176px")}
            </div>

            <div className="mt-4 text-center sm:mt-0 sm:text-left lg:mt-4">
              <p className="text-[10px] font-semibold uppercase tracking-widest text-purple-200/90">
                Episode {idx + 1} of {episodes.length}
              </p>
              <h2 className="mt-1 line-clamp-3 text-lg font-extrabold leading-snug sm:text-xl">{ep.topic}</h2>
              {ep.speaker && <p className="mt-1 truncate text-xs text-purple-200/80">{ep.speaker}</p>}
            </div>
          </div>

          <div className="mx-auto mt-4 flex max-w-lg items-center gap-3 text-[11px] text-zinc-300 lg:max-w-none">
            <span className="w-10">{fmt(time)}</span>
            <input
              type="range" min={0} max={duration || 0} step={1} value={time}
              aria-label="Seek" onChange={onSeek}
              className="h-1 flex-1 accent-[#1db954]"
            />
            <span className="w-10 text-right">{ep.duration || fmt(duration)}</span>
          </div>

          {/* transport is a pure centred cluster — speed moved down to the footer
              row, because pinning it to the left edge of a 21rem sidebar column
              squeezed the cluster off centre */}
          <div className="mt-2 flex items-center justify-center gap-4">
            <button aria-label="Previous episode" onClick={() => play(idx - 1)} disabled={idx === 0} className="text-xl text-zinc-300 hover:text-white disabled:opacity-30">⏮</button>
            <button aria-label="Back 10 seconds" onClick={() => skip(-10)} className="text-xs text-zinc-300 hover:text-white">-10s</button>
            <button
              aria-label={playing ? "Pause" : "Play"}
              onClick={() => play(idx)}
              className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-[#1db954] text-black shadow-lg transition hover:scale-105"
            >
              <PlayPauseIcon paused={!playing} className="h-6 w-6" />
            </button>
            <button aria-label="Forward 30 seconds" onClick={() => skip(30)} className="text-xs text-zinc-300 hover:text-white">+30s</button>
            <button aria-label="Next episode" onClick={() => play(idx + 1)} disabled={idx >= episodes.length - 1} className="text-xl text-zinc-300 hover:text-white disabled:opacity-30">⏭</button>
          </div>

          {/* footer row: speed, and the only Spotify affordance left on the page —
              following, saving and resuming need an account, and all of that
              lives on Spotify's side */}
          <div className="mx-auto mt-4 flex max-w-lg items-center gap-2 lg:max-w-none">
            <button
              aria-label={`Playback speed, currently ${rate} times`}
              onClick={cycleRate}
              className="shrink-0 rounded-full border border-white/25 px-3 py-2 text-xs font-semibold text-zinc-100 transition hover:border-white hover:text-white"
            >
              {rate}x
            </button>
            {spotifyUrl && (
              <a
                href={spotifyUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex flex-1 items-center justify-center gap-2 rounded-full border border-white/25 py-2 text-xs font-semibold text-zinc-100 transition hover:border-[#1db954] hover:text-[#1db954]"
              >
                <SpotifyIcon className="h-4 w-4" /> Follow on Spotify
              </a>
            )}
          </div>
        </section>

        {/* episode list — the page's own scroll, no nested scroll box */}
        <section className="mt-6 rounded-2xl border border-zinc-200 bg-white p-3 pb-28 shadow-sm sm:p-5 sm:pb-28 lg:mt-0 lg:pb-5">
          <div className="mb-3 flex items-baseline justify-between gap-3">
            <h2 className="text-sm font-bold uppercase tracking-wide text-zinc-500">All episodes</h2>
            <span className="shrink-0 text-xs text-zinc-400">{filtered.length} of {episodes.length}</span>
          </div>
          <input
            type="search" value={q} onChange={(e) => { setQ(e.target.value); setPage(0); }} placeholder="Search episodes"
            className="w-full rounded-full border border-zinc-300 bg-zinc-50 px-4 py-2 text-sm outline-none placeholder:text-zinc-400 focus:border-purple-700 focus:bg-white"
          />
          <div className="mt-2">{rows(false)}</div>
          {filtered.length === 0 && <p className="py-8 text-center text-sm text-zinc-400">No episode matches that search.</p>}
          {pager(false)}
        </section>

        {/* mini dock. It stays parked above the tab bar's strip even while the
            chrome is auto-hidden — following the bar down would drop it onto the
            raised Home bubble that still pokes out of the hidden bar. The right
            padding is the lane BackToTop floats in (fixed, right-4, z-50): the
            dock is full-width, so without it the button sat on top of the
            transport. */}
        {!stageOnScreen && (
          <div className="fixed inset-x-0 bottom-0 z-40 pl-3 pr-[4.25rem] pb-[calc(3.5rem+env(safe-area-inset-bottom))] sm:pr-24 md:pb-[env(safe-area-inset-bottom)] lg:hidden">
            <div className="mb-2 rounded-2xl bg-[#1b1420]/95 p-2 shadow-[0_10px_30px_-8px_rgba(0,0,0,0.6)] ring-1 ring-white/10 backdrop-blur">
              <div className="flex items-center gap-3">
                <button
                  onClick={() => stageRef.current?.scrollIntoView({ behavior: "smooth", block: "start" })}
                  aria-label="Back to player"
                  className="relative h-11 w-11 shrink-0 overflow-hidden rounded-lg bg-zinc-800"
                >
                  {artwork("44px")}
                </button>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-xs font-semibold text-white">{ep.topic}</span>
                  <span className="block truncate text-[11px] text-zinc-400">{ep.speaker || "Islam Onlive"}</span>
                </span>
                {/* no room for the skips beside a Malayalam title on a 360px phone */}
                <button aria-label="Back 10 seconds" onClick={() => skip(-10)} className="hidden shrink-0 text-[11px] text-zinc-300 sm:block">-10s</button>
                <button
                  aria-label={playing ? "Pause" : "Play"}
                  onClick={() => play(idx)}
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#1db954] text-black"
                >
                  <PlayPauseIcon paused={!playing} className="h-5 w-5" />
                </button>
                <button aria-label="Forward 30 seconds" onClick={() => skip(30)} className="hidden shrink-0 text-[11px] text-zinc-300 sm:block">+30s</button>
              </div>
              <div className="mt-2 h-0.5 overflow-hidden rounded-full bg-white/15">
                <div className="h-full bg-[#1db954]" style={{ width: `${duration ? Math.min(100, (time / duration) * 100) : 0}%` }} />
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  /* ─────────────────────────── homepage card ─────────────────────────── */
  return (
    <div className={`overflow-hidden rounded-2xl bg-[#121212] text-white shadow-xl ${fill ? "lg:flex lg:h-full lg:min-h-0 lg:flex-col" : ""}`}>
      {audio}

      {/* gradient header: artwork + now playing */}
      <div className="shrink-0 bg-[#121212] bg-gradient-to-b from-purple-800 via-purple-950/80 to-[#121212] p-4 sm:p-6">
        <div className="flex items-end gap-3 sm:gap-5">
          <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-lg bg-zinc-800 shadow-2xl sm:h-36 sm:w-36">
            {artwork("144px")}
          </div>
          <div className="min-w-0 flex-1">
            <p className="pill text-[10px] font-semibold uppercase tracking-widest text-purple-200">Podcast · Episode {idx + 1}</p>
            <h3 className="mt-1 line-clamp-2 text-base font-extrabold leading-snug sm:line-clamp-3 sm:text-2xl">{ep.topic}</h3>
            <p className="mt-1 truncate text-xs text-purple-200/80">{ep.speaker ? `${ep.speaker} · ` : ""}Islam Onlive · {episodes.length} episodes</p>
          </div>
        </div>

        {/* progress */}
        <div className="mt-3 flex items-center gap-3 text-[11px] text-zinc-300 sm:mt-5">
          <span className="w-10">{fmt(time)}</span>
          <input
            type="range" min={0} max={duration || 0} step={1} value={time}
            aria-label="Seek" onChange={onSeek}
            className="h-1 flex-1 accent-[#1db954]"
          />
          <span className="w-10 text-right">{ep.duration || fmt(duration)}</span>
        </div>

        {/* transport — rate/Spotify pinned to the edges so the play cluster stays dead centre */}
        <div className="relative mt-2 flex items-center justify-center gap-3 sm:mt-3 sm:gap-5">
          <button aria-label="Playback speed" onClick={cycleRate} className="absolute left-0 w-10 rounded-full border border-zinc-600 px-2 py-1 text-xs text-zinc-300 hover:border-white hover:text-white">{rate}x</button>
          <button aria-label="Previous" onClick={() => idx > 0 && play(idx - 1)} className="text-xl text-zinc-300 hover:text-white">⏮</button>
          <button aria-label="Back 10s" onClick={() => skip(-10)} className="text-xs text-zinc-300 hover:text-white">-10s</button>
          <button
            aria-label={playing ? "Pause" : "Play"}
            onClick={() => play(idx)}
            className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-[#1db954] text-black shadow-lg transition hover:scale-105 sm:h-14 sm:w-14"
          >
            <PlayPauseIcon paused={!playing} className="h-5 w-5 sm:h-6 sm:w-6" />
          </button>
          <button aria-label="Forward 30s" onClick={() => skip(30)} className="text-xs text-zinc-300 hover:text-white">+30s</button>
          <button aria-label="Next" onClick={() => idx < episodes.length - 1 && play(idx + 1)} className="text-xl text-zinc-300 hover:text-white">⏭</button>
          {spotifyUrl && (
            <a href={spotifyUrl} target="_blank" rel="noopener noreferrer" aria-label="Open in Spotify" title="Open in Spotify"
               className="absolute right-0 hidden text-zinc-300 hover:text-[#1db954] sm:block">
              <SpotifyIcon className="h-6 w-6" />
            </a>
          )}
        </div>
      </div>

      {/* search + track list */}
      <div className={`p-3 sm:p-5 ${fill ? "lg:flex lg:min-h-0 lg:flex-1 lg:flex-col" : ""}`}>
        <input
          type="search" value={q} onChange={(e) => { setQ(e.target.value); setPage(0); }} placeholder="Search episodes"
          className="w-full shrink-0 rounded-full border border-zinc-700 bg-zinc-900 px-4 py-1.5 text-sm text-white outline-none placeholder:text-zinc-500 focus:border-[#1db954] sm:py-2"
        />
        <div
          className={`mt-2 overflow-y-auto ${fill ? "max-h-[320px] lg:max-h-none lg:min-h-0 lg:flex-1" : ""} ${boxed ? "max-h-[264px] sm:max-h-[var(--list-h)]" : ""}`}
          style={boxed ? ({ "--list-h": `${listHeight}px` } as CSSProperties) : undefined}
        >
          {rows(true)}
        </div>
        {pager(true)}
      </div>
    </div>
  );
}
