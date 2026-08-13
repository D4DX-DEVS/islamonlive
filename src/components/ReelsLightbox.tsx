"use client";

import { useCallback, useEffect, useState } from "react";
import Image from "next/image";

export interface ReelItem {
  id: string;
  url: string;
  thumbnail: string;
  /** raw mp4 when the feed exposes one — plays with native controls */
  video?: string;
  title?: string;
}

export default function ReelsLightbox({ items }: { items: ReelItem[] }) {
  const [open, setOpen] = useState<number | null>(null);

  const step = useCallback(
    (d: number) => setOpen((v) => (v === null ? v : (v + d + items.length) % items.length)),
    [items.length]
  );

  useEffect(() => {
    if (open === null) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(null);
      if (e.key === "ArrowRight") step(1);
      if (e.key === "ArrowLeft") step(-1);
    };
    window.addEventListener("keydown", onKey);
    // don't let the page scroll behind the overlay
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open, step]);

  const active = open === null ? null : items[open];

  return (
    <>
      {/* phones swipe a single row; 6 stacked 9:16 tiles would be ~950px of scroll */}
      <div className="-mx-1 flex snap-x snap-mandatory gap-4 overflow-x-auto px-1 pb-1 sm:mx-0 sm:grid sm:grid-cols-3 sm:overflow-visible sm:px-0 lg:grid-cols-6">
        {items.map((r, n) => (
          <button
            key={r.id}
            type="button"
            onClick={() => setOpen(n)}
            aria-label={r.title ?? "Play reel"}
            className="group relative block w-40 shrink-0 snap-start overflow-hidden rounded-lg bg-zinc-200 shadow-sm transition hover:shadow-md sm:w-auto sm:shrink"
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

      {active && (
        <div
          role="dialog"
          aria-modal="true"
          onClick={() => setOpen(null)}
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/85 p-4 backdrop-blur-sm"
        >
          <button
            type="button"
            aria-label="Previous reel"
            onClick={(e) => { e.stopPropagation(); step(-1); }}
            className="absolute left-2 top-1/2 z-10 -translate-y-1/2 px-3 text-4xl text-white/70 hover:text-white sm:left-6"
          >‹</button>
          <button
            type="button"
            aria-label="Next reel"
            onClick={(e) => { e.stopPropagation(); step(1); }}
            className="absolute right-2 top-1/2 z-10 -translate-y-1/2 px-3 text-4xl text-white/70 hover:text-white sm:right-6"
          >›</button>
          <button
            type="button"
            aria-label="Close"
            onClick={() => setOpen(null)}
            className="absolute right-3 top-3 z-10 rounded-full bg-white/10 px-3 py-1 text-xl text-white hover:bg-white/25"
          >✕</button>

          <div onClick={(e) => e.stopPropagation()} className="flex max-h-full w-full max-w-[440px] flex-col items-center">
            {active.video ? (
              <video
                key={active.id}
                src={active.video}
                poster={active.thumbnail}
                controls
                autoPlay
                playsInline
                className="max-h-[78vh] w-auto rounded-lg bg-black"
              />
            ) : (
              <div className="aspect-[9/16] max-h-[78vh] w-full overflow-hidden rounded-lg bg-black">
                <iframe
                  key={active.id}
                  src={`https://www.youtube-nocookie.com/embed/${active.id}?autoplay=1`}
                  title={active.title ?? "Reel"}
                  allow="autoplay; encrypted-media; picture-in-picture"
                  allowFullScreen
                  className="h-full w-full border-0"
                />
              </div>
            )}
            {active.title && <p className="mt-3 line-clamp-3 w-full text-sm text-white">{active.title}</p>}
            <div className="mt-2 flex w-full items-center gap-4 text-xs text-zinc-300">
              <span>{(open ?? 0) + 1} / {items.length}</span>
              <a href={active.url} target="_blank" rel="noopener noreferrer" className="font-semibold text-white hover:text-purple-300">
                {active.url.includes("instagram.com") ? "Instagram" : "YouTube"} →
              </a>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
