"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

/* Segmented control tying the two video feeds together. Both are their own route
   (a YouTube embed page and a vertical reels feed are different enough that one
   page with a tab would just be two pages in a trench coat), so this is a pair of
   links styled as one control — the switch the old native app put over its feed. */
const FEEDS = [
  { label: "Reels", href: "/reels" },
  { label: "YouTube", href: "/watch-videos" },
];

export default function WatchSwitch() {
  const pathname = usePathname();

  return (
    <div className="inline-flex rounded-full bg-zinc-100 p-1" role="tablist" aria-label="Video feed">
      {FEEDS.map((f) => {
        const active = pathname.startsWith(f.href);
        return (
          <Link
            key={f.href}
            href={f.href}
            role="tab"
            aria-selected={active}
            prefetch
            className={`min-h-10 rounded-full px-5 text-sm font-semibold leading-10 transition ${
              active ? "bg-white text-purple-900 shadow-sm" : "text-zinc-500 hover:text-purple-800"
            }`}
          >
            {f.label}
          </Link>
        );
      })}
    </div>
  );
}
