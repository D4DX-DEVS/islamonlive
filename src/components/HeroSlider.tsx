"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";

export interface Slide {
  href: string;
  img: string | null;
  title: string;
  excerpt: string;
  category: string;
  author?: string;
  date: string;
}

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
        <div className="relative aspect-[16/10] w-full lg:aspect-auto lg:h-full lg:min-h-[420px]">
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
                className={`object-cover transition-opacity duration-700 ${n === i ? "opacity-100" : "opacity-0"}`}
              />
            )
          ))}
          <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent" />
          {/* floating card, live-site style */}
          <div className="absolute bottom-5 left-5 right-14 max-w-xl rounded-lg bg-white/95 p-4 shadow-lg backdrop-blur sm:p-5">
            {s.category && (
              <span className="mb-2 inline-block rounded bg-purple-700 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-white">{s.category}</span>
            )}
            <h1 className="line-clamp-2 text-lg font-extrabold leading-snug text-zinc-900 lg:text-xl" dangerouslySetInnerHTML={{ __html: s.title }} />
            <p className="mt-2 text-xs text-zinc-500">
              {s.author && <span className="font-medium text-zinc-700">{s.author}</span>}
              {s.author && " · "}
              {s.date}
            </p>
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
