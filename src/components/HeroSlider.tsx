"use client";

import { useEffect, useState } from "react";
import type { ElementType } from "react";
import Link from "next/link";
import Image from "next/image";
import Byline from "@/components/Byline";

import type { PostItem } from "@/components/PostCards";

/** the sliders render the same shape as the cards */
export type Slide = PostItem;

export default function HeroSlider({ slides }: { slides: Slide[] }) {
  const [i, setI] = useState(0);

  useEffect(() => {
    if (slides.length < 2) return;
    const t = setInterval(() => setI((v) => (v + 1) % slides.length), 6000);
    return () => clearInterval(t);
  }, [slides.length]);

  if (!slides.length) return null;

  return (
    // live-site hero: a 887×400 image with a white caption card offset over its
    // bottom-left corner, hanging past the image — not a caption on the image.
    // min-w-0: the card's headline is in normal flow now, and grid items default
    // to min-width:auto — one long Malayalam word would widen the whole row
    <div className="relative min-w-0">
      <div className="relative aspect-[16/10] w-full overflow-hidden sm:aspect-[887/400]">
        {/* all slides stay mounted; crossfade via opacity — no grey flash while images load */}
        {slides.map((sl, n) => (
          sl.img && (
            <Image
              key={n}
              src={sl.img}
              alt=""
              fill
              priority={n === 0}
              sizes="(max-width: 1024px) 100vw, 62vw"
              className={`object-cover object-top transition-opacity duration-700 ${n === i ? "opacity-100" : "opacity-0"}`}
            />
          )
        ))}
        {/* dots sit centred in the strip of image the card leaves uncovered */}
        {slides.length > 1 && (
          <span className="absolute inset-x-0 bottom-24 flex justify-center gap-2 sm:bottom-[34%]">
            {slides.map((_, n) => (
              <button
                key={n}
                type="button"
                aria-label={`Slide ${n + 1}`}
                onClick={() => setI(n)}
                className={`h-2.5 w-2.5 rounded-full transition ${n === i ? "bg-white" : "bg-white/50 hover:bg-white/80"}`}
              />
            ))}
          </span>
        )}
      </div>

      {/* the card: 81% of the image's width, inset 9.6% from its left edge, and
          overlapping its bottom 31% — the live proportions.
          Every slide's card is mounted into the same grid cell, so the *row* is
          always as tall as the tallest of them and the hero never resizes on an
          advance — the side column takes its height from this row, and a 1-line
          headline followed by a 3-line one used to jump the whole section.
          `items-end` is what keeps that stable row from stretching each card to
          fill it: every card keeps its own content height and hangs from the
          row's bottom edge, so a short headline gets a short plate instead of a
          tall one with a canyon of white between the headline and the byline.
          The waiting cards use `invisible`, not `opacity-0`: visibility:hidden
          still reserves the height but drops them from the a11y tree. */}
      <div className="relative z-10 mx-4 -mt-20 grid items-end sm:mx-0 sm:-mt-[14%] sm:ml-[9.6%] sm:w-[81%]">
        {slides.map((s, n) => {
          const live = n === i;
          // only the slide on screen is the page's h1; the four waiting behind it
          // would otherwise stack up as duplicate headings in the markup
          const Heading: ElementType = live ? "h1" : "div";
          return (
            <div
              key={n}
              className={`col-start-1 row-start-1 flex flex-col bg-white p-5 shadow-[0_0_10px_rgba(0,0,0,0.35)] sm:p-7 lg:p-[30px] ${live ? "" : "invisible"}`}
            >
              {/* w-fit: the pill is a flex item now, and a flex column stretches
                  its children to full width unless told not to */}
              {s.category ? (
                <span className="pill inline-flex w-fit items-center justify-center bg-[#693FE2] px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-white">
                  {s.category}
                </span>
              ) : (
                // an uncategorised post still reserves the pill's line, so the
                // headline starts at the same height on every slide
                <span aria-hidden className="pill invisible inline-flex w-fit px-2.5 py-1 text-[11px]">
                  &nbsp;
                </span>
              )}
              <Link href={s.href} className="group block" tabIndex={live ? undefined : -1}>
                <Heading
                  className="mt-3 line-clamp-3 [overflow-wrap:anywhere] text-xl font-semibold leading-snug text-black transition-colors group-hover:text-[#31094C] sm:text-2xl lg:text-[34px] lg:leading-tight"
                  dangerouslySetInnerHTML={{ __html: s.title }}
                />
              </Link>
              {/* no mt-auto: with `items-end` on the stack each plate is exactly as
                  tall as its own content, so there is no slack left to push the
                  byline down — it sits directly under the headline */}
              <div className="flex items-end justify-between gap-4 pt-4">
                {/* min-w-0 so the author name can truncate instead of pushing the row wide */}
                <Byline className="min-w-0" name={s.author} avatar={s.authorAvatar} date={s.date} />
                {slides.length > 1 && (
                  // the live card's purple disc — it advances the slider
                  <button
                    type="button"
                    aria-label="Next slide"
                    tabIndex={live ? undefined : -1}
                    onClick={() => setI((i + 1) % slides.length)}
                    className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#693FE2] text-white transition hover:bg-[#5a34c7]"
                  >
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden className="h-4 w-4">
                      <path d="M5 12h14M13 6l6 6-6 6" />
                    </svg>
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
