"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import Byline from "@/components/Byline";

import type { PostItem } from "@/components/PostCards";

/** the sliders render the same shape as the cards */
export type Slide = PostItem;

export default function HeroSlider({ slides }: { slides: Slide[] }) {
  const [i, setI] = useState(0);

  useEffect(() => {
    const t = setInterval(() => setI((v) => (v + 1) % slides.length), 6000);
    return () => clearInterval(t);
  }, [slides.length]);

  if (!slides.length) return null;
  const s = slides[i];

  return (
    <div className="relative h-full overflow-hidden rounded-xl bg-zinc-900">
      <Link href={s.href} className="block h-full">
        <div className="relative aspect-[16/10] w-full lg:aspect-auto lg:h-full lg:min-h-[540px]">
          {/* all slides stay mounted; crossfade via opacity — no grey flash while images load */}
          {slides.map((sl, n) => (
            sl.img && (
              <Image
                key={sl.img}
                src={sl.img}
                alt=""
                fill
                priority={n === 0}
                sizes="(max-width: 1024px) 100vw, 66vw"
                className={`object-cover object-top transition-opacity duration-700 ${n === i ? "opacity-100" : "opacity-0"}`}
              />
            )
          ))}
          <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/45 to-transparent" />
          {/* centred caption straight on the image — no white card */}
          <div className="absolute inset-x-6 bottom-8 flex flex-col items-center text-center sm:inset-x-12 lg:bottom-12">
            {s.category && (
              <span className="pill mb-3 inline-flex items-center justify-center rounded bg-purple-700 px-2.5 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-white">{s.category}</span>
            )}
            <h1
              className="line-clamp-3 max-w-3xl text-xl font-extrabold leading-snug text-white drop-shadow-lg sm:text-2xl lg:text-3xl"
              dangerouslySetInnerHTML={{ __html: s.title }}
            />
            <Byline className="mt-3 justify-center" light name={s.author} avatar={s.authorAvatar} date={s.date} />
          </div>
          <span className="absolute bottom-5 right-5 flex flex-col gap-1.5">
            {slides.map((_, n) => (
              <span key={n} className={`h-2 w-2 rounded-full ${n === i ? "bg-white" : "bg-white/40"}`} />
            ))}
          </span>
        </div>
      </Link>
      <button
        aria-label="Previous slide"
        onClick={() => setI((i - 1 + slides.length) % slides.length)}
        className="absolute left-3 top-[35%] z-10 rounded-full bg-black/40 px-3 py-1.5 text-white hover:bg-black/70"
      >‹</button>
      <button
        aria-label="Next slide"
        onClick={() => setI((i + 1) % slides.length)}
        className="absolute right-3 top-[35%] z-10 rounded-full bg-black/40 px-3 py-1.5 text-white hover:bg-black/70"
      >›</button>
    </div>
  );
}
