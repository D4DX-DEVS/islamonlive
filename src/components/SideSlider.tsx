"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import Byline from "@/components/Byline";
import type { Slide } from "@/components/HeroSlider";

/* overlay card that crossfades through a few posts — hero's small siblings.
   20px radius and a white advance disc, like the live site's right column. */
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
    <div className={`group relative overflow-hidden rounded-[20px] bg-zinc-900 ${className}`}>
      <Link href={s.href} className="relative block h-full">
        {/* all frames stay mounted so the crossfade never flashes grey */}
        {slides.map((sl, n) => (
          sl.img && (
            <Image
              key={sl.img}
              src={sl.img}
              alt=""
              fill
              priority={n === 0}
              sizes="(max-width: 1024px) 50vw, 35vw"
              className={`object-cover object-top transition-opacity duration-700 ${n === i ? "opacity-100" : "opacity-0"}`}
            />
          )
        ))}
        <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/25 to-transparent" />
        {/* right padding clears the advance disc so long titles never run under it */}
        <div className="absolute inset-x-0 bottom-0 p-5 pr-16">
          {s.category && (
            <span className="pill mb-2 inline-flex items-center justify-center bg-[#693FE2] px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-white">{s.category}</span>
          )}
          <h3 className="line-clamp-2 text-base font-bold leading-snug text-white lg:text-lg" dangerouslySetInnerHTML={{ __html: s.title }} />
          <Byline className="mt-1.5" light name={s.author} avatar={s.authorAvatar} date={s.date} />
        </div>
      </Link>
      {slides.length > 1 && (
        <button
          type="button"
          aria-label="Next post"
          onClick={() => setI((i + 1) % slides.length)}
          className="absolute bottom-5 right-5 flex h-10 w-10 items-center justify-center rounded-full bg-white text-zinc-900 shadow transition hover:bg-zinc-100"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden className="h-4 w-4">
            <path d="M5 12h14M13 6l6 6-6 6" />
          </svg>
        </button>
      )}
    </div>
  );
}
