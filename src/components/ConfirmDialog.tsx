"use client";

import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { useBackDismiss } from "@/lib/useBackDismiss";

/* A real confirmation, for the handful of actions that throw something away.

   Native confirm() blocks the whole tab, looks nothing like the rest of the
   site and is styled by the browser, so this stands in for it: a sheet that
   rises from the bottom on a phone and a centred card on a desktop, dismissed
   by the backdrop, by Escape, or by the phone's Back button.

   Nothing happens until the reader picks. The confirm button is focused on
   open so a keyboard reader can just press Enter, and the destructive wording
   lives in `confirmLabel` rather than a generic "OK". */
export default function ConfirmDialog({
  open,
  title,
  body,
  confirmLabel,
  cancelLabel = "Cancel",
  destructive = false,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  title: string;
  body: string;
  confirmLabel: string;
  cancelLabel?: string;
  destructive?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const confirmRef = useRef<HTMLButtonElement>(null);

  useBackDismiss(open, onCancel);

  useEffect(() => {
    if (!open) return;
    const { body: b } = document;
    const prev = b.style.overflow;
    b.style.overflow = "hidden";
    confirmRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCancel();
    };
    document.addEventListener("keydown", onKey);
    return () => {
      b.style.overflow = prev;
      document.removeEventListener("keydown", onKey);
    };
  }, [open, onCancel]);

  if (!open || typeof document === "undefined") return null;

  return createPortal(
    <div className="fixed inset-0 z-[130] flex items-end justify-center sm:items-center">
      <div aria-hidden onClick={onCancel} className="absolute inset-0 bg-black/45" />
      <div
        role="alertdialog"
        aria-modal="true"
        aria-label={title}
        className="sheet-up-in relative w-full max-w-sm rounded-t-3xl bg-white p-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))] shadow-2xl sm:rounded-3xl sm:pb-5"
      >
        <h2 className="text-[17px] font-extrabold leading-tight text-zinc-900">{title}</h2>
        <p className="mt-1.5 text-[14px] leading-relaxed text-zinc-600">{body}</p>
        <div className="mt-5 flex gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="min-h-11 flex-1 touch-manipulation rounded-full bg-zinc-100 px-4 text-[15px] font-semibold text-zinc-800 transition hover:bg-zinc-200 active:scale-[0.98]"
          >
            {cancelLabel}
          </button>
          <button
            ref={confirmRef}
            type="button"
            onClick={onConfirm}
            className={`min-h-11 flex-1 touch-manipulation rounded-full px-4 text-[15px] font-semibold text-white transition active:scale-[0.98] ${
              destructive ? "bg-red-600 hover:bg-red-700" : "bg-[#693FE2] hover:bg-[#5A34C7]"
            }`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
