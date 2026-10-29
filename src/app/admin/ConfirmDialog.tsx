"use client";

import { useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Icon, type IconName } from "./icons";

/* The admin's confirmation modal, for every action that changes what readers
   see, throws something away, or cannot be taken back.

   - The tone (danger / warning / primary) sets the icon badge and the button colour.
   - `onConfirm` may be async: the modal stays open, shows a spinner and the
     pending label, and blocks closing until the request is done. A thrown
     error is shown inside the modal so the person can retry or cancel; the
     caller closes the modal (sets `open` false) when the work succeeds.
   - Focus moves in (to Cancel for dangerous actions, so Enter never destroys
     by accident), Tab cycles inside, Escape and the backdrop cancel, and focus
     returns to where it was. A bottom sheet on phones, a centred card above.
   - z-[200]: above the admin shell (z-100), the builder (z-110) and its menus. */

export type ConfirmTone = "danger" | "warning" | "primary";

export interface ConfirmDialogProps {
  open: boolean;
  title: string;
  body: React.ReactNode;
  confirmLabel: string;
  cancelLabel?: string;
  /** Shown on the confirm button while `onConfirm` runs, e.g. "Publishing…". */
  pendingLabel?: string;
  tone?: ConfirmTone;
  /** Old prop of the site's dialog; same as tone="danger". */
  destructive?: boolean;
  icon?: IconName;
  /** Extra content under the body: a summary of what will change. */
  details?: React.ReactNode;
  onConfirm: () => void | Promise<unknown>;
  onCancel: () => void;
}

const TONES: Record<ConfirmTone, { badge: string; button: string; icon: IconName }> = {
  danger: { badge: "bg-red-50 text-red-600 ring-red-50/60", button: "bg-red-600 hover:bg-red-700 focus-visible:ring-red-200 shadow-[0_10px_22px_-12px_rgba(220,38,38,0.9)]", icon: "trash" },
  warning: { badge: "bg-amber-50 text-amber-600 ring-amber-50/60", button: "bg-amber-600 hover:bg-amber-700 focus-visible:ring-amber-200 shadow-[0_10px_22px_-12px_rgba(217,119,6,0.9)]", icon: "info" },
  primary: { badge: "bg-violet-50 text-violet-600 ring-violet-50/60", button: "bg-[linear-gradient(90deg,#7c3aed,#6d28d9)] hover:brightness-110 focus-visible:ring-violet-200 shadow-[0_10px_22px_-12px_rgba(109,40,217,0.9)]", icon: "send" },
};

/** A failed fetch throws the browser's own words ("Failed to fetch" in Chrome,
    "NetworkError…" in Firefox, "Load failed" in Safari); say what happened instead. */
function problemText(problem: unknown): string {
  if (!(problem instanceof Error)) return "That did not work. Try again.";
  if (problem instanceof TypeError && /failed to fetch|networkerror|load failed/i.test(problem.message)) return "Could not reach the server. Check your connection and try again.";
  return problem.message;
}

function Spinner() {
  return <svg aria-hidden viewBox="0 0 24 24" className="h-4 w-4 animate-spin"><circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" strokeOpacity=".3" strokeWidth="3" /><path d="M21 12a9 9 0 00-9-9" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" /></svg>;
}

function Panel({ title, body, confirmLabel, cancelLabel = "Cancel", pendingLabel, tone: given, destructive, icon, details, onConfirm, onCancel }: Omit<ConfirmDialogProps, "open">) {
  const tone = given ?? (destructive ? "danger" : "primary");
  const look = TONES[tone];
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const panel = useRef<HTMLDivElement>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);
  const confirmRef = useRef<HTMLButtonElement>(null);
  const titleId = useId();
  const bodyId = useId();
  const busyRef = useRef(false);
  const cancelLatest = useRef(onCancel);
  useEffect(() => { cancelLatest.current = onCancel; });

  useEffect(() => {
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    (tone === "danger" ? cancelRef : confirmRef).current?.focus();
    const { overflow } = document.body.style;
    document.body.style.overflow = "hidden";
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !busyRef.current) { event.stopPropagation(); cancelLatest.current(); }
      if (event.key !== "Tab" || !panel.current) return;
      // keep Tab inside the modal
      const focusable = [...panel.current.querySelectorAll<HTMLElement>("button:not([disabled]), a[href], input, [tabindex]:not([tabindex='-1'])")];
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    };
    document.addEventListener("keydown", onKey, true);
    return () => { document.removeEventListener("keydown", onKey, true); document.body.style.overflow = overflow; previous?.focus?.(); };
  }, [tone]);

  async function confirm() {
    if (busyRef.current) return;
    setError("");
    const result = onConfirm();
    if (!(result instanceof Promise)) return;
    busyRef.current = true; setBusy(true);
    try { await result; } catch (problem) { setError(problemText(problem)); } finally { busyRef.current = false; setBusy(false); }
  }

  return <div className="fixed inset-0 z-[200] flex items-end justify-center sm:items-center sm:p-6">
    <div aria-hidden onClick={() => { if (!busyRef.current) onCancel(); }} className="absolute inset-0 bg-slate-950/50 backdrop-blur-[2px] transition-opacity duration-200 starting:opacity-0" />
    <div ref={panel} role="alertdialog" aria-modal="true" aria-labelledby={titleId} aria-describedby={bodyId} aria-busy={busy}
      className="relative w-full max-w-md rounded-t-3xl bg-white p-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))] shadow-[0_30px_80px_-20px_rgba(15,10,40,0.45)] ring-1 ring-slate-900/5 transition duration-200 ease-out starting:translate-y-6 starting:opacity-0 sm:rounded-2xl sm:p-6 sm:starting:translate-y-0 sm:starting:scale-95">
      <div className="mx-auto mb-4 h-1.5 w-10 rounded-full bg-slate-200 sm:hidden" aria-hidden />
      <div className="flex gap-4">
        <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full ring-8 ${look.badge}`}><Icon name={icon ?? look.icon} className="h-5 w-5" strokeWidth={2} /></span>
        <div className="min-w-0 flex-1 pt-0.5">
          <h2 id={titleId} className="text-[17px] font-bold leading-snug text-[#12093a]">{title}</h2>
          <div id={bodyId} className="mt-1.5 text-sm leading-relaxed text-slate-600">{body}</div>
        </div>
      </div>
      {details && <div className="mt-4 rounded-xl border border-slate-100 bg-slate-50/80 p-3 text-sm text-slate-700 sm:ml-[60px]">{details}</div>}
      {error && <p role="alert" className="mt-4 flex items-start gap-2 rounded-xl bg-red-50 px-3 py-2.5 text-sm text-red-700 sm:ml-[60px]"><Icon name="info" className="mt-0.5 h-4 w-4 shrink-0" />{error}</p>}
      <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <button ref={cancelRef} type="button" disabled={busy} onClick={onCancel} className="min-h-11 rounded-xl border border-slate-200 bg-white px-5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-violet-100 disabled:opacity-50">{cancelLabel}</button>
        <button ref={confirmRef} type="button" disabled={busy} onClick={() => void confirm()} className={`flex min-h-11 items-center justify-center gap-2 rounded-xl px-5 text-sm font-bold text-white transition focus-visible:outline-none focus-visible:ring-4 disabled:cursor-wait disabled:opacity-80 ${look.button}`}>
          {busy && <Spinner />}{busy ? pendingLabel ?? "Working…" : confirmLabel}
        </button>
      </div>
    </div>
  </div>;
}

export default function ConfirmDialog({ open, ...props }: ConfirmDialogProps) {
  if (!open || typeof document === "undefined") return null;
  return createPortal(<Panel {...props} />, document.body);
}
