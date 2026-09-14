"use client";

import { useEffect, useRef, useState } from "react";

/* Copy-to-clipboard for a payment detail — a UPI id, an account number, an IFSC.
   Typing any of these off a phone screen into a banking app is where donations
   are lost, so every one of them is one tap from the clipboard.

   Two shapes for two placements: a labelled pill next to the UPI id, and a bare
   icon at the end of each row in the bank table. Both confirm with a tick that
   pops — on a panel the reader is scanning for digits, a shape change registers
   where a word swap does not. */
export default function CopyButton({
  value,
  label,
  variant = "pill",
}: {
  value: string;
  /** what is being copied, for the screen-reader name */
  label: string;
  variant?: "pill" | "icon";
}) {
  const [copied, setCopied] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);

  async function copy(): Promise<void> {
    try {
      await navigator.clipboard.writeText(value);
    } catch {
      // insecure context or a denied permission — the value is on screen anyway,
      // so say nothing and let the reader select it by hand
      return;
    }
    setCopied(true);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setCopied(false), 1800);
  }

  const tick = (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden className="h-3.5 w-3.5">
      <path d="m5 12 5 5L19 7" />
    </svg>
  );
  const sheets = (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden className="h-3.5 w-3.5">
      <rect x="9" y="9" width="11" height="11" rx="2.5" />
      <path d="M5 15V6.5A1.5 1.5 0 0 1 6.5 5H15" />
    </svg>
  );

  return (
    <>
      <button
        type="button"
        onClick={copy}
        aria-label={copied ? `${label} copied` : `Copy ${label}`}
        className={
          variant === "pill"
            ? `cta pill flex min-h-9 shrink-0 items-center gap-1.5 rounded-lg px-3 text-xs font-semibold transition-colors ${
                copied ? "bg-emerald-600 text-white" : "bg-[color:var(--brand)] text-white hover:bg-[#5a34c7]"
              }`
            : `flex h-8 w-8 shrink-0 items-center justify-center rounded-lg transition-colors ${
                copied ? "bg-emerald-50 text-emerald-600" : "text-zinc-400 hover:bg-[color:var(--lav)] hover:text-[color:var(--brand)]"
              }`
        }
      >
        <span key={copied ? "y" : "n"} className={`flex items-center gap-1.5 ${copied ? "copied" : ""}`}>
          {copied ? tick : sheets}
          {variant === "pill" && (copied ? "Copied" : "Copy")}
        </span>
      </button>
      <span role="status" aria-live="polite" className="sr-only">
        {copied ? `${label} copied` : ""}
      </span>
    </>
  );
}
