"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Image from "next/image";

export interface ReelItem {
  id: string;
  url: string;
  thumbnail: string;
  /** raw mp4 when the feed exposes one — plays with native controls */
  video?: string;
  title?: string;
}

/* Instagram-Reels-style viewer: tapping a tile opens a full-screen vertical
   snap feed — swipe up/down for next/previous. Only the on-screen slide
   mounts its player; the rest show thumbnails. */
export default function ReelsLightbox({ items, grid = false }: { items: ReelItem[]; grid?: boolean }) {
  const [open, setOpen] = useState<number | null>(null);
  const [active, setActive] = useState(0);
  const feedRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);

  const jump = useCallback((n: number) => {
    const i = Math.max(0, Math.min(items.length - 1, n));
    feedRef.current?.children[i]?.scrollIntoView({ behavior: "smooth" });
  }, [items.length]);

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
    setActive(open);
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

  /* Screen-off playback: the OS only keeps media alive for a tab that owns a
     media session, so publish one for the on-screen mp4 (Instagram feed items).
     YouTube-hosted reels play in an iframe and YouTube blocks background
     playback there — nothing this side can change that. */
  useEffect(() => {
    const ms = typeof navigator !== "undefined" ? navigator.mediaSession : undefined;
    const item = open === null ? null : items[active];
    if (!ms || !item?.video) return;
    ms.metadata = new MediaMetadata({
      title: item.title || "Reel",
      artist: "Islam Onlive",
      artwork: [{ src: item.thumbnail, sizes: "512x512" }],
    });
    const handlers: [MediaSessionAction, MediaSessionActionHandler][] = [
      ["play", () => videoRef.current?.play().catch(() => {})],
      ["pause", () => videoRef.current?.pause()],
      ["previoustrack", () => jump(active - 1)],
      ["nexttrack", () => jump(active + 1)],
    ];
    for (const [a, h] of handlers) { try { ms.setActionHandler(a, h); } catch {} }
    return () => { for (const [a] of handlers) { try { ms.setActionHandler(a, null); } catch {} } };
  }, [open, active, items, jump]);

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
            onClick={() => setOpen(n)}
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
            className="absolute right-3 top-3 z-10 rounded-full bg-white/10 px-3 py-1 text-xl text-white backdrop-blur-sm hover:bg-white/25"
          >✕</button>
          <span className="pill absolute left-3 top-4 z-10 text-xs font-semibold text-white/80">{active + 1} / {items.length}</span>

          <div ref={feedRef} className="h-full snap-y snap-mandatory overflow-y-auto overscroll-contain">
            {items.map((r, n) => (
              <div key={r.id} data-idx={n} className="relative flex h-full snap-start items-center justify-center">
                <div className="relative aspect-[9/16] max-h-full w-full max-w-[440px] bg-black sm:max-h-[92vh] sm:rounded-xl">
                  {n !== active ? (
                    <Image src={r.thumbnail} alt="" fill sizes="100vw" className="object-cover opacity-60 sm:rounded-xl" unoptimized />
                  ) : r.video ? (
                    <video
                      key={r.id}
                      ref={videoRef}
                      src={r.video}
                      poster={r.thumbnail}
                      controls
                      autoPlay
                      loop
                      playsInline
                      preload="auto"
                      className="h-full w-full object-contain"
                    />
                  ) : (
                    <iframe
                      key={r.id}
                      src={`https://www.youtube-nocookie.com/embed/${r.id}?autoplay=1&playsinline=1&rel=0`}
                      title={r.title ?? "Reel"}
                      allow="autoplay; encrypted-media; picture-in-picture"
                      allowFullScreen
                      className="h-full w-full border-0 sm:rounded-xl"
                    />
                  )}
                </div>
                <div className="pointer-events-none absolute bottom-6 left-4 right-16">
                  {r.title && <p className="line-clamp-2 text-sm font-semibold text-white drop-shadow">{r.title}</p>}
                  <a
                    href={r.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="pointer-events-auto mt-1 inline-block text-xs font-semibold text-purple-300 hover:text-white"
                  >
                    {r.url.includes("instagram.com") ? "Instagram" : "YouTube"} →
                  </a>
                </div>
              </div>
            ))}
          </div>

          {/* desktop convenience arrows; phones swipe */}
          <div className="absolute bottom-4 right-3 z-10 hidden flex-col gap-2 sm:flex">
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
