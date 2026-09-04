"use client";

import { toggleSave, useIsSaved, type SavedItem } from "@/lib/reader";

/* Bookmark toggle. Shares ShareRow's button shape so the two sit in one row
   without the padding drifting apart. */
export default function SaveButton({ item, className = "" }: { item: Omit<SavedItem, "at">; className?: string }) {
  const saved = useIsSaved(item.id);

  return (
    <button
      type="button"
      onClick={() => toggleSave(item)}
      aria-pressed={saved}
      aria-label={saved ? "Remove from saved" : "Save for later"}
      title={saved ? "Saved" : "Save for later"}
      className={`flex h-9 w-9 items-center justify-center rounded-full transition ${
        saved ? "bg-purple-800 text-white" : "bg-zinc-100 text-zinc-600 hover:bg-purple-800 hover:text-white"
      } ${className}`}
    >
      <svg
        viewBox="0 0 24 24"
        fill={saved ? "currentColor" : "none"}
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden
        className="h-[18px] w-[18px]"
      >
        <path d="M6 4.5h12a1 1 0 0 1 1 1v14.2a.5.5 0 0 1-.77.42L12 16.3l-6.23 3.82A.5.5 0 0 1 5 19.7V5.5a1 1 0 0 1 1-1Z" />
      </svg>
    </button>
  );
}
