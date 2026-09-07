"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Image from "next/image";
import { useBackDismiss } from "@/lib/useBackDismiss";

export interface ReelItem {
  id: string;
  url: string;
  thumbnail: string;
  /** signed CDN mp4 — plays inline */
  video?: string;
  title?: string;
}

function isInstagram(r: ReelItem): boolean {
  return r.url.includes("instagram.com");
}

/* the YouTube embed needs a Referer to accept the request — a missing one is
   YouTube's "error 153" — and installed PWAs / in-app browsers sometimes drop
   it, so the policy is spelled out on the iframe rather than left to defaults */
function YouTubeFrame({ id, title }: { id: string; title: string }) {
  return (
    <iframe
      src={`https://www.youtube.com/embed/${id}?autoplay=1&playsinline=1&rel=0&modestbranding=1`}
      title={title}
      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
      referrerPolicy="strict-origin-when-cross-origin"
      allowFullScreen
      className="h-full w-full border-0 sm:rounded-xl"
    />
  );
}

/* Last resort only. Instagram's own embed always plays, but it is a white card
   with its own header, caption and Like button — nothing like a reel — so the
   player reaches for it only after asking the server for a fresh link. */
function InstagramFrame({ id, title }: { id: string; title: string }) {
  return (
    <iframe
      src={`https://www.instagram.com/reel/${id}/embed/`}
      title={title}
      allow="autoplay; encrypted-media; picture-in-picture; web-share"
      referrerPolicy="strict-origin-when-cross-origin"
      allowFullScreen
      scrolling="no"
      className="h-full w-full border-0 bg-white sm:rounded-xl"
    />
  );
}

function PlayGlyph() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden className="h-9 w-9 drop-shadow-lg">
      <path d="M7 4.5v15l12-7.5z" />
    </svg>
  );
}

/* The reel player: one video filling the screen, tap to pause, a hairline of
   progress at the bottom and a sound toggle — the shape Instagram's own reels
   have. Native controls are deliberately off; a scrubber and a filename bar
   across a vertical video is what made this feel like an embedded file. */
function ReelVideo({
  item,
  onDead,
  muted,
  onToggleMute,
}: {
  item: ReelItem;
  /** every source for this reel failed — show the embed instead */
  onDead: () => void;
  muted: boolean;
  onToggleMute: () => void;
}) {
  const ref = useRef<HTMLVideoElement>(null);
  const [src, setSrc] = useState(item.video ?? "");
  const [paused, setPaused] = useState(false);
  const [progress, setProgress] = useState(0);
  // a stale CDN signature is worth exactly one round trip to /api/reel
  const refreshed = useRef(false);

  const fail = useCallback(async () => {
    if (refreshed.current) {
      onDead();
      return;
    }
    refreshed.current = true;
    try {
      const res = await fetch(`/api/reel?id=${encodeURIComponent(item.id)}`);
      const { video } = (await res.json()) as { video?: string | null };
      if (video) setSrc(video);
      else onDead();
    } catch {
      onDead();
    }
  }, [item.id, onDead]);

  // no source at all (the feed never carried one) — go straight for a fresh link
  useEffect(() => {
    if (!src && !refreshed.current) void fail();
  }, [src, fail]);

  const toggle = () => {
    const v = ref.current;
    if (!v) return;
    if (v.paused) void v.play().catch(() => {});
    else v.pause();
  };

  if (!src) {
    return (
      <div className="flex h-full w-full items-center justify-center">
        <Image src={item.thumbnail} alt="" fill sizes="100vw" className="object-cover opacity-40 sm:rounded-xl" unoptimized />
        <span className="relative h-8 w-8 animate-spin rounded-full border-2 border-white/30 border-t-white" />
      </div>
    );
  }

  return (
    <div className="relative h-full w-full" onClick={toggle}>
      <video
        key={src}
        ref={ref}
        src={src}
        poster={item.thumbnail}
        autoPlay
        loop
        playsInline
        muted={muted}
        preload="auto"
        onError={() => void fail()}
        onPlay={() => setPaused(false)}
        onPause={() => setPaused(true)}
        onTimeUpdate={(e) => {
          const v = e.currentTarget;
          if (v.duration) setProgress(v.currentTime / v.duration);
        }}
        className="h-full w-full object-cover sm:rounded-xl"
      />

      {/* the pause glyph, the way Reels shows it: only while paused */}
      {paused && (
        <span className="pointer-events-none absolute inset-0 flex items-center justify-center text-white/90">
          <PlayGlyph />
        </span>
      )}

      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); onToggleMute(); }}
        aria-label={muted ? "Unmute" : "Mute"}
        className="absolute right-3 top-14 z-10 flex h-9 w-9 touch-manipulation items-center justify-center rounded-full bg-black/45 text-white backdrop-blur-sm transition active:scale-90"
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden className="h-[18px] w-[18px]">
          <path d="M11 5 6.5 9H3v6h3.5L11 19z" />
          {muted ? <path d="m16 9.5 4 5M20 9.5l-4 5" /> : <path d="M15.5 8.5a5 5 0 0 1 0 7M18 6a8.5 8.5 0 0 1 0 12" />}
        </svg>
      </button>

      {/* progress hairline, bottom edge */}
      <span className="pointer-events-none absolute inset-x-0 bottom-0 h-0.5 bg-white/20 sm:rounded-b-xl">
        <span className="block h-full bg-white/90" style={{ width: `${Math.round(progress * 100)}%` }} />
      </span>
    </div>
  );
}

/* Instagram-Reels-style viewer: tapping a tile opens a full-screen vertical
   snap feed — swipe up/down for next/previous. Only the on-screen slide
   mounts its player; the rest show thumbnails. */
export default function ReelsLightbox({ items, grid = false }: { items: ReelItem[]; grid?: boolean }) {
  const [open, setOpen] = useState<number | null>(null);
  const [active, setActive] = useState(0);
  // reels whose video is unrecoverable — they fall back to Instagram's embed
  const [dead, setDead] = useState<Set<string>>(() => new Set());
  // one sound setting for the session, like a real reels feed. Starts muted:
  // a browser blocks an unmuted autoplay and the reel would just sit there
  const [muted, setMuted] = useState(true);
  const feedRef = useRef<HTMLDivElement>(null);

  const jump = useCallback((n: number) => {
    const i = Math.max(0, Math.min(items.length - 1, n));
    feedRef.current?.children[i]?.scrollIntoView({ behavior: "smooth" });
  }, [items.length]);

  const markDead = useCallback((id: string) => {
    setDead((prev) => {
      if (prev.has(id)) return prev;
      const next = new Set(prev);
      next.add(id);
      return next;
    });
  }, []);

  // Back puts the reel away instead of leaving the page
  useBackDismiss(open !== null, () => setOpen(null));

  // lock page scroll + Esc to close while the feed is open
  useEffect(() => {
    if (open === null) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(null);
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open]);

  // jump to the tapped slide, then track which slide is on screen
  useEffect(() => {
    if (open === null) return;
    const feed = feedRef.current;
    if (!feed) return;
    feed.children[open]?.scrollIntoView();
    const io = new IntersectionObserver(
      (entries) => {
        for (const en of entries) {
          if (en.isIntersecting) setActive(Number((en.target as HTMLElement).dataset.idx));
        }
      },
      { root: feed, threshold: 0.6 }
    );
    Array.from(feed.children).forEach((c) => io.observe(c));
    return () => io.disconnect();
  }, [open]);

  const player = (r: ReelItem) => {
    const title = r.title ?? "Reel";
    if (!isInstagram(r)) return <YouTubeFrame id={r.id} title={title} />;
    if (dead.has(r.id)) return <InstagramFrame id={r.id} title={title} />;
    // keyed on the reel: a fresh player per reel, so no state (its link, its
    // progress, whether it already retried) can leak from the previous one
    return <ReelVideo key={r.id} item={r} onDead={() => markDead(r.id)} muted={muted} onToggleMute={() => setMuted((m) => !m)} />;
  };

  return (
    <>
      {/* homepage: phones swipe a single row; /reels page: plain grid */}
      <div className={grid
        ? "grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6"
        : "-mx-1 flex snap-x snap-mandatory gap-4 overflow-x-auto px-1 pb-1 sm:mx-0 sm:grid sm:grid-cols-3 sm:overflow-visible sm:px-0 lg:grid-cols-6"}>
        {items.map((r, n) => (
          <button
            key={r.id}
            type="button"
            onClick={() => { setActive(n); setOpen(n); }}
            aria-label={r.title ?? "Play reel"}
            className={`group relative block overflow-hidden rounded-xl bg-zinc-200 shadow-sm transition hover:shadow-md ${grid ? "w-auto" : "w-40 shrink-0 snap-start sm:w-auto sm:shrink"}`}
          >
            <div className="relative aspect-[9/16] w-full">
              <Image
                src={r.thumbnail}
                alt=""
                fill
                sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 17vw"
                className="object-cover transition duration-500 group-hover:scale-105"
                unoptimized
              />
            </div>
            <span className="absolute inset-0 flex items-center justify-center">
              <span className="flex h-12 w-12 items-center justify-center rounded-full bg-black/50 text-white backdrop-blur-sm transition group-hover:scale-110 group-hover:bg-purple-700">
                {/* path is centred on the 24x24 box (x 7-17, y 5-19) so no margin nudge is needed */}
                <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden className="h-6 w-6">
                  <path d="M7 5v14l10-7z" />
                </svg>
              </span>
            </span>
          </button>
        ))}
      </div>

      {open !== null && (
        <div role="dialog" aria-modal="true" className="fixed inset-0 z-[100] bg-black">
          <button
            type="button"
            aria-label="Close"
            onClick={() => setOpen(null)}
            className="absolute right-3 top-3 z-20 flex h-9 w-9 items-center justify-center rounded-full bg-black/45 text-xl text-white backdrop-blur-sm transition active:scale-90"
          >✕</button>
          <span className="pill absolute left-4 top-5 z-20 text-xs font-semibold text-white/80">{active + 1} / {items.length}</span>

          <div ref={feedRef} className="h-full snap-y snap-mandatory overflow-y-auto overscroll-contain">
            {items.map((r, n) => (
              <div key={r.id} data-idx={n} className="relative flex h-full snap-start items-center justify-center">
                <div className="relative aspect-[9/16] max-h-full w-full max-w-[440px] bg-black sm:max-h-[92vh] sm:rounded-xl">
                  {n !== active ? (
                    <Image src={r.thumbnail} alt="" fill sizes="100vw" className="object-cover opacity-60 sm:rounded-xl" unoptimized />
                  ) : (
                    player(r)
                  )}
                </div>
                {/* the caption sits over our own player; the Instagram embed
                    paints its own and would be covered by ours */}
                {!(isInstagram(r) && dead.has(r.id)) && (
                  <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent px-4 pb-6 pt-10">
                    {r.title && <p className="line-clamp-2 pr-14 text-sm font-semibold text-white drop-shadow">{r.title}</p>}
                    <a
                      href={r.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={(e) => e.stopPropagation()}
                      className="pointer-events-auto mt-1 inline-block text-xs font-semibold text-white/70 hover:text-white"
                    >
                      {isInstagram(r) ? "Open on Instagram" : "Open on YouTube"} →
                    </a>
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* desktop convenience arrows; phones swipe */}
          <div className="absolute bottom-4 right-3 z-20 hidden flex-col gap-2 sm:flex">
            <button type="button" aria-label="Previous reel" onClick={() => jump(active - 1)}
              className="rounded-full bg-white/10 p-2 text-white backdrop-blur-sm hover:bg-white/25">▲</button>
            <button type="button" aria-label="Next reel" onClick={() => jump(active + 1)}
              className="rounded-full bg-white/10 p-2 text-white backdrop-blur-sm hover:bg-white/25">▼</button>
          </div>
        </div>
      )}
    </>
  );
}
