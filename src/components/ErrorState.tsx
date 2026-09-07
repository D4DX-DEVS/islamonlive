import Link from "next/link";
import type { ReactNode } from "react";

/* The one panel every failure lands on — a dead WordPress origin, a 404 slug,
   a crash in the tree. Readers get plain sentences and something to press;
   the stack trace goes to the console, never onto the page. Same card shape
   as the empty states in /saved so a bad moment still looks like the site. */
export default function ErrorState({
  icon,
  title,
  hint,
  action,
  secondary,
  digest,
}: {
  icon: ReactNode;
  title: string;
  hint: string;
  /** the primary button — "Try again" reloads, so it has to be a client button */
  action?: ReactNode;
  secondary?: { href: string; label: string };
  /** Next's error id; only worth showing so a reader can quote it to us */
  digest?: string;
}) {
  return (
    <div className="mx-auto max-w-lg rounded-2xl border border-dashed border-zinc-300 bg-white/60 px-6 py-12 text-center">
      <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-purple-50 text-[#693FE2]">{icon}</span>
      <h1 className="mt-4 text-[17px] font-bold text-zinc-800">{title}</h1>
      <p className="mx-auto mt-2 max-w-sm text-sm leading-relaxed text-zinc-500">{hint}</p>

      <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
        {action}
        {secondary && (
          <Link
            href={secondary.href}
            className="pill inline-flex min-h-11 items-center rounded-full px-5 text-sm font-semibold text-zinc-600 ring-1 ring-zinc-300 transition hover:bg-zinc-100"
          >
            {secondary.label}
          </Link>
        )}
      </div>

      {digest && <p className="mt-6 text-[11px] text-zinc-400">Reference {digest}</p>}
    </div>
  );
}

/* shared between the boundaries so the two panels never drift apart */
export function RetryButton({ onClick, children = "Try again" }: { onClick: () => void; children?: ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="pill min-h-11 touch-manipulation rounded-full bg-[#693FE2] px-6 text-sm font-semibold text-white transition active:scale-[0.98] active:bg-[#5a34c7] hover:bg-[#5a34c7]"
    >
      {children}
    </button>
  );
}

export function CloudIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden className="h-7 w-7">
      <path d="M6.5 18a4 4 0 0 1-.4-7.98A5.5 5.5 0 0 1 16.9 9.2 3.9 3.9 0 0 1 17.5 17" />
      <path d="m3 3 18 18" />
    </svg>
  );
}

export function CompassIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden className="h-7 w-7">
      <circle cx="12" cy="12" r="9" />
      <path d="m15.5 8.5-2 5-5 2 2-5z" />
    </svg>
  );
}
