"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import Byline from "@/components/Byline";
import type { Slide } from "@/components/HeroSlider";

/* overlay card that crossfades through a few posts — hero's small siblings */
export default function SideSlider({ slides, interval = 6000, className = "" }: { slides: Slide[]; interval?: number; className?: string }) {
  const [i, setI] = useState(0);

  useEffect(() => {
    if (slides.length < 2) return;
    const t = setInterval(() => setI((v) => (v + 1) % slides.length), interval);
    return () => clearInterval(t);
  }, [slides.length, interval]);

  if (!slides.length) return null;
  const s = slides[i];

  return (
    <div className={`group relative overflow-hidden rounded-xl bg-zinc-900 ${className}`}>
      <Link href={s.href} className="relative block h-full">
        {/* all frames stay mounted so the crossfade never flashes grey */}
        {slides.map((sl, n) => (
          sl.img && (
            <Image
              key={sl.img}
              src={sl.img}
              alt=""
              fill
              sizes="(max-width: 1024px) 50vw, 25vw"
              className={`object-cover object-top transition-opacity duration-700 ${n === i ? "opacity-100" : "opacity-0"}`}
            />
          )
        ))}
        <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/25 to-transparent" />
        <div className="absolute inset-x-0 bottom-0 p-4">
          {s.category && (
            <span className="pill mb-1.5 inline-flex items-center justify-center rounded bg-purple-700 px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-white">{s.category}</span>
          )}
          <h3 className="line-clamp-2 text-base font-bold leading-snug text-white lg:text-lg" dangerouslySetInnerHTML={{ __html: s.title }} />
          <Byline className="mt-1.5" light name={s.author} avatar={s.authorAvatar} date={s.date} />
        </div>
      </Link>
      {slides.length > 1 && (
        <span className="absolute right-3 top-3 flex gap-1.5">
          {slides.map((_, n) => (
            <button
              key={n}
              aria-label={`Slide ${n + 1}`}
              onClick={() => setI(n)}
              className={`h-1.5 w-1.5 rounded-full transition ${n === i ? "bg-white" : "bg-white/40 hover:bg-white/70"}`}
            />
          ))}
        </span>
      )}
    </div>
  );
}
