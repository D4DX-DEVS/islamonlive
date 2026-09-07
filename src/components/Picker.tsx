"use client";

import { useCallback, useEffect, useId, useRef, useState, type CSSProperties } from "react";
import { createPortal } from "react-dom";
import { useBackDismiss } from "@/lib/useBackDismiss";

export interface PickerOption<T extends string | number> {
  value: T;
  label: string;
  hint?: string;
  /** inline style for the option row (a font picker previews each face) */
  style?: CSSProperties;
}

interface PickerProps<T extends string | number> {
  value: T;
  options: PickerOption<T>[];
  onChange: (value: T) => void;
  label: string;
  disabled?: boolean;
}

function CheckIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden className={className}>
      <path d="m5 12.5 4.5 4.5L19 7.5" />
    </svg>
  );
}

/* The value picker on a settings row, drawn by us rather than the browser: a
   pill that opens a menu of options with a check on the current one. Phones
   get a bottom sheet (the pattern their own Settings app uses), wider screens
   a small card anchored under the pill. The native <select> looked like a 2005
   form control on desktop, and its popup can't be styled at all. */
export default function Picker<T extends string | number>({ value, options, onChange, label, disabled = false }: PickerProps<T>) {
  const [open, setOpen] = useState(false);
  const [closing, setClosing] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const listId = useId();
  const current = options.find((o) => o.value === value);

  const close = useCallback(() => {
    setClosing(true);
    window.setTimeout(() => {
      setOpen(false);
      setClosing(false);
    }, 160);
  }, []);

  useBackDismiss(open, close);

  // close on outside click / Escape; the sheet's backdrop handles phones
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && close();
    const onDown = (e: PointerEvent) => {
      const t = e.target as Element | null;
      // the phone sheet is portalled outside the wrapper — taps inside it
      // are picks, not outside clicks
      if (t?.closest?.("[data-picker-sheet]")) return;
      if (wrapRef.current && !wrapRef.current.contains(t)) close();
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", onDown);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("pointerdown", onDown);
    };
  }, [open, close]);

  const pick = (v: T) => {
    onChange(v);
    close();
  };

  const rows = (sheet: boolean) =>
    options.map((o) => {
      const on = o.value === value;
      return (
        <button
          key={String(o.value)}
          type="button"
          role="option"
          aria-selected={on}
          onClick={() => pick(o.value)}
          style={o.style}
          className={`flex w-full touch-manipulation items-center gap-3 text-left transition-colors ${
            sheet ? "min-h-[52px] px-5" : "min-h-11 rounded-xl px-3"
          } ${on ? "text-[#31094C]" : "text-zinc-800"} hover:bg-purple-50 active:bg-purple-100`}
        >
          <span className="min-w-0 flex-1">
            <span className={`block text-[15px] ${on ? "font-bold" : "font-medium"}`}>{o.label}</span>
            {o.hint && <span className="block text-xs text-zinc-500">{o.hint}</span>}
          </span>
          <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full ${on ? "bg-[#693FE2] text-white" : "text-transparent"}`}>
            <CheckIcon className="h-3.5 w-3.5" />
          </span>
        </button>
      );
    });

  const anim = closing ? "picker-out" : "picker-in";

  return (
    <div ref={wrapRef} className="relative shrink-0">
      <button
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listId}
        aria-label={label}
        disabled={disabled}
        onClick={() => (open ? close() : setOpen(true))}
        className={`flex min-h-9 max-w-[11rem] touch-manipulation items-center gap-1.5 rounded-full py-1.5 pl-3.5 pr-2.5 text-sm font-semibold transition disabled:cursor-not-allowed ${
          open ? "bg-[#693FE2] text-white" : "bg-zinc-100 text-zinc-800 hover:bg-zinc-200 active:bg-zinc-200"
        }`}
      >
        <span className="truncate">{current?.label ?? ""}</span>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden className={`h-3.5 w-3.5 shrink-0 transition-transform ${open ? "rotate-180" : ""}`}>
          <path d="m6 9 6 6 6-6" />
        </svg>
      </button>

      {open && (
        <>
          {/* phones: bottom sheet, portalled so a transformed ancestor can't trap it */}
          {createPortal(
            <div
              className={`fixed inset-0 z-[120] flex items-end justify-center sm:hidden ${closing ? "fade-out" : "fade-in"}`}
              onClick={close}
            >
              <div className="absolute inset-0 bg-black/45" aria-hidden />
              <div
                id={listId}
                data-picker-sheet
                role="listbox"
                aria-label={label}
                className={`relative w-full rounded-t-3xl bg-white pb-[env(safe-area-inset-bottom)] shadow-2xl ${closing ? "sheet-up-out" : "sheet-up-in"}`}
                onClick={(e) => e.stopPropagation()}
              >
                <div className="mx-auto mt-2.5 h-1.5 w-10 rounded-full bg-zinc-300" />
                <p className="px-5 pb-1 pt-3 text-xs font-semibold uppercase tracking-[0.08em] text-zinc-500">{label}</p>
                <div className="max-h-[60vh] overflow-y-auto pb-2">{rows(true)}</div>
              </div>
            </div>,
            document.body
          )}
          {/* wider screens: a card under the pill */}
          <div
            role="listbox"
            aria-label={label}
            className={`absolute right-0 top-full z-30 mt-2 hidden w-64 origin-top-right rounded-2xl bg-white p-1.5 shadow-[0_24px_48px_-16px_rgba(49,9,76,0.35)] ring-1 ring-black/5 sm:block ${anim}`}
          >
            {rows(false)}
          </div>
        </>
      )}
    </div>
  );
}
