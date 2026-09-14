"use client";

import { useState } from "react";
import CopyButton from "@/components/support/CopyButton";
import { BANK } from "@/lib/support";

/* The bank transfer block. On a phone it is a disclosure, collapsed by default:
   five rows of account details between the QR and the rest of the page is a lot
   of scrolling for the minority who want them. From md it is simply open —
   there is room, and a reader on a desktop is more likely to be the one making
   a NEFT transfer.

   The open state is only ever *raised* by the breakpoint, never lowered: the
   desktop branch ignores `open` rather than setting it, so a reader who
   collapses the block and then rotates their phone doesn't find it reopened. */
export default function BankPanel() {
  const [open, setOpen] = useState(false);

  const rows = (
    <dl className="divide-y divide-[color:var(--line)]">
      {BANK.map((d) => (
        <div key={d.label} className="flex items-center gap-2 py-1.5">
          <dt className="pill shrink-0 text-[12px] text-zinc-500">{d.label}</dt>
          <dd className="pill ml-auto min-w-0 break-all text-right text-[12.5px] font-bold text-[color:var(--ink)]">{d.value}</dd>
          <CopyButton value={d.value} label={d.label} variant="icon" />
        </div>
      ))}
    </dl>
  );

  return (
    <section id="bank-panel" className="order-3 scroll-mt-28 rounded-2xl border border-[color:var(--line)] bg-white p-4 sm:p-5 lg:order-none">
      {/* phone: a real disclosure button */}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-controls="bank-rows"
        className="flex w-full items-center gap-3 text-left md:hidden"
      >
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[color:var(--lav)] text-[color:var(--brand)]">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden className="h-[18px] w-[18px]">
            <path d="M3.5 9.5 12 4.5l8.5 5" />
            <path d="M5.5 9.5v8M10 9.5v8M14 9.5v8M18.5 9.5v8M3 19.5h18" />
          </svg>
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-[15px] font-extrabold leading-tight text-[color:var(--ink)]">Bank Transfer Details</span>
          <span className="block text-[12.5px] leading-tight text-zinc-500">You can also support us by direct transfer.</span>
        </span>
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden
          className={`h-4 w-4 shrink-0 text-zinc-400 transition-transform duration-300 ${open ? "rotate-180" : ""}`}
        >
          <path d="m6 9 6 6 6-6" />
        </svg>
      </button>

      {/* desktop: no disclosure, just the heading */}
      <div className="hidden items-center gap-3 md:flex">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[color:var(--lav)] text-[color:var(--brand)]">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden className="h-[18px] w-[18px]">
            <path d="M3.5 9.5 12 4.5l8.5 5" />
            <path d="M5.5 9.5v8M10 9.5v8M14 9.5v8M18.5 9.5v8M3 19.5h18" />
          </svg>
        </span>
        <span>
          <span className="block text-[15px] font-extrabold leading-tight text-[color:var(--ink)]">Bank Transfer Details</span>
          <span className="block text-[12.5px] leading-tight text-zinc-500">You can also support us by direct transfer.</span>
        </span>
      </div>

      <div id="bank-rows" className={`mt-2 ${open ? "disclose" : "hidden"} md:mt-3 md:block`}>
        {rows}
      </div>
    </section>
  );
}
