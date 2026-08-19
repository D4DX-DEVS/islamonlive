"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import type { YTVideo } from "@/lib/youtube";

/* Instagram-Reels-style viewer: tapping a thumbnail opens a full-screen
   vertical snap feed — swipe up/down for next/previous video. Only the
   on-screen slide mounts its YouTube iframe (autoplay), the rest show
   thumbnails, so swiping stays cheap. */
export default function WatchReels({ videos }: { videos: YTVideo[] }) {
  const [open, setOpen] = useState<number | null>(null);
  const [active, setActive] = useState(0);
  const feedRef = useRef<HTMLDivElement>(null);

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

  return (
    <>
      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {videos.map((x, n) => (
          <button
            key={x.id}
            type="button"
            onClick={() => setOpen(n)}
            className="group overflow-hidden rounded-lg border border-zinc-200 bg-white text-left shadow-sm hover:shadow-md"
          >
            <div className="relative aspect-video w-full bg-zinc-100">
              <Image src={x.thumbnail} alt="" fill sizes="(max-width: 768px) 100vw, 33vw" className="object-cover transition group-hover:scale-105" />
              <span className="absolute inset-0 flex items-center justify-center">
                <span className="flex h-12 w-12 items-center justify-center rounded-full bg-black/50 text-white group-hover:bg-purple-700">
                  {/* centred SVG glyph — the ▶ text char renders off-centre in font fallback */}
                  <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden className="h-6 w-6">
                    <path d="M8 5v14l11-7z" />
                  </svg>
                </span>
              </span>
            </div>
            <p className="p-3 text-sm font-bold leading-snug group-hover:text-purple-800">{x.title}</p>
          </button>
        ))}
      </div>

      {open !== null && (
        <div className="fixed inset-0 z-[100] bg-black">
          <button
            type="button"
            aria-label="Close"
            onClick={() => setOpen(null)}
            className="absolute right-3 top-3 z-10 rounded-full bg-white/10 px-3 py-1 text-xl text-white backdrop-blur-sm hover:bg-white/25"
          >✕</button>
          <span className="pill absolute left-3 top-4 z-10 text-xs font-semibold text-white/80">{active + 1} / {videos.length}</span>

          <div ref={feedRef} className="h-full snap-y snap-mandatory overflow-y-auto overscroll-contain">
            {videos.map((x, n) => (
              <div key={x.id} data-idx={n} className="relative flex h-full snap-start items-center justify-center">
                {n === active ? (
                  <iframe
                    src={`https://www.youtube-nocookie.com/embed/${x.id}?autoplay=1&playsinline=1&rel=0`}
                    title={x.title}
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    allowFullScreen
                    className="aspect-video w-full max-w-[1000px] border-0 sm:rounded-xl"
                  />
                ) : (
                  <div className="relative aspect-video w-full max-w-[1000px] opacity-60">
                    <Image src={x.thumbnail} alt="" fill sizes="100vw" className="object-cover sm:rounded-xl" />
                  </div>
                )}
                {x.title && (
                  <p className="pointer-events-none absolute bottom-6 left-4 right-16 line-clamp-2 text-sm font-semibold text-white drop-shadow">
                    {x.title}
                  </p>
                )}
              </div>
            ))}
          </div>

          {/* swipe hint arrows, desktop convenience */}
          <div className="absolute bottom-4 right-3 z-10 flex flex-col gap-2">
            <button type="button" aria-label="Previous video" onClick={() => feedRef.current?.children[Math.max(0, active - 1)]?.scrollIntoView({ behavior: "smooth" })}
              className="rounded-full bg-white/10 p-2 text-white backdrop-blur-sm hover:bg-white/25">▲</button>
            <button type="button" aria-label="Next video" onClick={() => feedRef.current?.children[Math.min(videos.length - 1, active + 1)]?.scrollIntoView({ behavior: "smooth" })}
              className="rounded-full bg-white/10 p-2 text-white backdrop-blur-sm hover:bg-white/25">▼</button>
          </div>
        </div>
      )}
    </>
  );
}
