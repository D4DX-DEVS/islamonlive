"use client";

import { useState } from "react";
import Image from "next/image";
import type { YTVideo } from "@/lib/youtube";

/* picking from the list swaps the player in place — no navigation */
export default function WatchPanel({ videos }: { videos: YTVideo[] }) {
  const [active, setActive] = useState(0);
  // autoplay only once the user has picked something, never on first paint
  const [picked, setPicked] = useState(false);

  const main = videos[active];
  if (!main) return null;
  const rest = videos.map((v, i) => ({ v, i })).filter(({ i }) => i !== active).slice(0, 4);

  return (
    <div className="grid gap-4 lg:grid-cols-3">
      <div className="lg:col-span-2">
        <div className="relative aspect-video w-full overflow-hidden rounded-lg">
          <iframe
            src={`https://www.youtube-nocookie.com/embed/${main.id}${picked ? "?autoplay=1" : ""}`}
            title={main.title}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
            className="absolute inset-0 h-full w-full"
          />
        </div>
        <h3 className="mt-3 line-clamp-2 text-sm font-bold text-white lg:text-base">{main.title}</h3>
      </div>
      {/* ponytail: flex-1 rows stretch to match the player height — no bottom gap */}
      <div className="flex h-full flex-col gap-3">
        <p className="border-b border-zinc-700 pb-2 text-xs font-semibold uppercase tracking-wide text-zinc-400">
          Our Videos <span className="text-zinc-500">· {videos.length} videos</span>
        </p>
        {rest.map(({ v, i }) => (
          <button
            key={v.id}
            type="button"
            onClick={() => { setActive(i); setPicked(true); }}
            className="group flex min-h-0 flex-1 items-center gap-3 rounded-lg p-2 text-left transition hover:bg-purple-900/50"
          >
            <div className="relative aspect-video w-32 shrink-0 self-stretch overflow-hidden rounded-md bg-zinc-800 sm:w-36">
              <Image src={v.thumbnail} alt="" fill sizes="144px" className="object-cover transition duration-500 group-hover:scale-105" />
            </div>
            <p className="line-clamp-3 text-sm font-medium text-zinc-200 group-hover:text-purple-300">{v.title}</p>
          </button>
        ))}
      </div>
    </div>
  );
}
