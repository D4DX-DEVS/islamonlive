"use client";

import { useState } from "react";
import Image from "next/image";
import type { YTVideo } from "@/lib/youtube";

/* picking from the list swaps the player in place — no navigation */
export default function WatchPanel({ videos }: { videos: YTVideo[] }) {
  const [active, setActive] = useState(0);
  /* The player is a facade until the reader asks for it: YouTube's embed alone
     is ~700 KB of script plus its own requests, and on a phone it was loading
     alongside the first screen of the home page. A still of the video with a
     play button costs one image; the iframe (with autoplay, so the tap that
     opened it also starts it) is created on that tap and never on first paint. */
  const [playing, setPlaying] = useState(false);

  const main = videos[active];
  if (!main) return null;
  const rest = videos.map((v, i) => ({ v, i })).filter(({ i }) => i !== active).slice(0, 4);

  return (
    // player beside the list only from xl: the panel sits in the homepage's 2/3
    // column now, and below xl that left a 200px-wide list of clipped thumbnails
    <div className="grid gap-4 xl:grid-cols-3">
      <div className="xl:col-span-2">
        <div className="relative aspect-video w-full overflow-hidden rounded-xl bg-zinc-900">
          {playing ? (
            <iframe
              src={`https://www.youtube.com/embed/${main.id}?playsinline=1&rel=0&autoplay=1`}
              title={main.title}
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
              // YouTube "error 153": embeds without a Referer are refused
              referrerPolicy="strict-origin-when-cross-origin"
              allowFullScreen
              className="absolute inset-0 h-full w-full"
            />
          ) : (
            <button
              type="button"
              onClick={() => setPlaying(true)}
              aria-label={`Play: ${main.title}`}
              className="group absolute inset-0 h-full w-full cursor-pointer"
            >
              <Image src={main.thumbnail} alt="" fill sizes="(min-width: 1280px) 720px, 100vw" className="object-cover" />
              <span className="absolute inset-0 flex items-center justify-center bg-black/10 transition group-hover:bg-black/20">
                <span className="flex h-16 w-16 items-center justify-center rounded-full bg-black/60 text-white ring-2 ring-white/80 transition group-hover:scale-105 group-hover:bg-[#ff0000]">
                  <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden className="ml-1 h-8 w-8">
                    <path d="M8 5v14l11-7z" />
                  </svg>
                </span>
              </span>
            </button>
          )}
        </div>
        <h3 className="mt-3 line-clamp-2 text-sm font-bold text-white xl:text-base">{main.title}</h3>
      </div>
      {/* ponytail: flex-1 rows stretch to match the player height — no bottom gap */}
      <div className="flex h-full flex-col gap-3">
        <p className="border-b border-zinc-700 pb-2 text-xs font-semibold uppercase tracking-wide text-zinc-400">
          Our Videos <span className="text-zinc-500">· {videos.length} videos</span>
        </p>
        {rest.map(({ v, i }, n) => (
          <button
            key={v.id}
            type="button"
            onClick={() => {
              setActive(i);
              setPlaying(true);
            }}
            // stacked layouts show only the first 2 suggestions
            className={`group min-h-0 flex-1 items-center gap-3 rounded-lg p-2 text-left transition hover:bg-purple-900/50 ${n >= 2 ? "hidden xl:flex" : "flex"}`}
          >
            <div className="relative aspect-video w-32 shrink-0 self-stretch overflow-hidden rounded-lg bg-zinc-800 sm:w-36">
              <Image src={v.thumbnail} alt="" fill sizes="144px" className="object-cover transition duration-500 group-hover:scale-105" />
            </div>
            <p className="line-clamp-3 text-sm font-medium text-zinc-200 group-hover:text-purple-300">{v.title}</p>
          </button>
        ))}
      </div>
    </div>
  );
}
