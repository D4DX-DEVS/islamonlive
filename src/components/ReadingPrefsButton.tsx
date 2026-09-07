"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { useBackDismiss } from "@/lib/useBackDismiss";
import { FONTS, TEXT_SIZES, TEXT_SIZE_LABELS, setReadingPrefs, useReadingPrefs, type FontKey } from "@/lib/reader";

/* "Aa" button in the article's action row: a quick sheet for text size and
   font, so the reader doesn't have to leave the page for /settings. Same store
   as the settings page — whatever is picked here shows there too. */
export default function ReadingPrefsButton({ className = "" }: { className?: string }) {
  const [open, setOpen] = useState(false);
  const prefs = useReadingPrefs();

  useBackDismiss(open, () => setOpen(false));

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  const step = (d: number) => setReadingPrefs({ size: Math.max(0, Math.min(TEXT_SIZES.length - 1, prefs.size + d)) });

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Text size and font"
        title="Text size and font"
        className={`flex h-9 w-9 items-center justify-center rounded-full bg-zinc-100 text-zinc-600 transition hover:bg-purple-800 hover:text-white ${className}`}
      >
        <span className="pill text-[15px] font-bold leading-none">Aa</span>
      </button>

      {open &&
        createPortal(
          <div className="fixed inset-0 z-[110] flex items-end justify-center bg-black/50 sm:items-center sm:p-6" onClick={() => setOpen(false)}>
            <div
              role="dialog"
              aria-label="Reading settings"
              className="w-full max-w-sm rounded-t-3xl bg-white p-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))] shadow-2xl sm:rounded-3xl sm:pb-5"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="mx-auto mb-4 h-1.5 w-10 rounded-full bg-zinc-300 sm:hidden" />
              <div className="flex items-center justify-between">
                <p className="text-base font-extrabold text-zinc-900">Reading</p>
                <button type="button" onClick={() => setOpen(false)} aria-label="Close" className="flex h-9 w-9 items-center justify-center rounded-full text-zinc-500 hover:bg-zinc-100">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden className="h-4 w-4">
                    <path d="M6 6l12 12M18 6 6 18" />
                  </svg>
                </button>
              </div>

              <p className="mt-4 text-xs font-semibold uppercase tracking-[0.08em] text-zinc-500">Text size</p>
              <div className="mt-2 flex items-center gap-2 rounded-2xl bg-zinc-100 p-1.5">
                <button
                  type="button"
                  onClick={() => step(-1)}
                  disabled={prefs.size === 0}
                  aria-label="Smaller text"
                  className="flex h-11 w-14 items-center justify-center rounded-xl bg-white text-sm font-bold text-zinc-800 shadow-sm transition active:scale-95 disabled:opacity-40"
                >
                  A<span className="text-[10px]">−</span>
                </button>
                <span className="flex-1 text-center text-sm font-semibold text-zinc-700">{TEXT_SIZE_LABELS[prefs.size]}</span>
                <button
                  type="button"
                  onClick={() => step(1)}
                  disabled={prefs.size === TEXT_SIZES.length - 1}
                  aria-label="Larger text"
                  className="flex h-11 w-14 items-center justify-center rounded-xl bg-white text-lg font-bold text-zinc-800 shadow-sm transition active:scale-95 disabled:opacity-40"
                >
                  A<span className="text-xs">+</span>
                </button>
              </div>

              <p className="mt-4 text-xs font-semibold uppercase tracking-[0.08em] text-zinc-500">Font</p>
              <div className="mt-2 grid grid-cols-2 gap-2">
                {FONTS.map((f) => (
                  <button
                    key={f.key}
                    type="button"
                    onClick={() => setReadingPrefs({ font: f.key as FontKey })}
                    aria-pressed={prefs.font === f.key}
                    style={{ fontFamily: f.var }}
                    className={`min-h-11 rounded-xl border px-3 text-sm transition ${
                      prefs.font === f.key ? "border-[#693FE2] bg-[#693FE2] text-white" : "border-zinc-200 text-zinc-700 hover:border-purple-300 hover:bg-purple-50"
                    }`}
                  >
                    {f.label}
                  </button>
                ))}
              </div>

              <p className="reader-body mt-4 rounded-xl bg-zinc-50 px-3 py-2 leading-relaxed text-zinc-700">ഖുർആൻ പഠനത്തിന്റെ വഴികൾ</p>

              <Link href="/settings" onClick={() => setOpen(false)} className="mt-3 block text-center text-xs font-semibold text-[#693FE2] hover:underline">
                All settings →
              </Link>
            </div>
          </div>,
          document.body
        )}
    </>
  );
}
