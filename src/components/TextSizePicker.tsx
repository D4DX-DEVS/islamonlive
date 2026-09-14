"use client";

import { SIZE_BANDS, setReadingPrefs, useReadingPrefs } from "@/lib/reader";

/* Small / Medium / Large, the way a phone's Display settings offers it.

   One control, two homes: the /settings row and the article's own "Aa" sheet.
   They were drifting apart — the sheet walked all seven stored steps and named
   them Small…Maximum while settings banded the same seven into three — so a
   reader who picked "Large" in the sheet came to settings and was told they
   were on "Medium". Same store, contradictory vocabulary.

   The stored value is still an index into TEXT_SIZES, so nobody's existing
   choice is lost: each segment stands for a band of those steps, whichever band
   the current step falls in is the one lit, and tapping a segment moves to the
   middle of it. */
export default function TextSizePicker({ className = "" }: { className?: string }) {
  const { size } = useReadingPrefs();

  return (
    <div role="radiogroup" aria-label="Text size" className={`flex gap-1 rounded-full bg-zinc-100 p-1 ${className}`}>
      {SIZE_BANDS.map((b) => {
        const on = size >= b.from && size <= b.to;
        return (
          <button
            key={b.label}
            type="button"
            role="radio"
            aria-checked={on}
            onClick={() => setReadingPrefs({ size: b.set })}
            className={`min-h-9 flex-1 touch-manipulation rounded-full px-3 text-[13px] font-semibold transition sm:min-h-8 ${
              on ? "bg-[#693FE2] text-white shadow-sm" : "text-zinc-600 hover:text-zinc-900"
            }`}
          >
            {b.label}
          </button>
        );
      })}
    </div>
  );
}
