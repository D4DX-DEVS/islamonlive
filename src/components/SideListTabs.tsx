"use client";

import { useState } from "react";
import Link from "next/link";
import { OverlayCard, ListRow } from "@/components/PostCards";
import type { Tab } from "@/components/TabbedSection";

/* sidebar section whose topic is picked from a "…" menu — the sidebar column is
   too narrow for the pill tabs the main column uses */
export default function SideListTabs({ title, tabs, rows = 4 }: { title: string; tabs: Tab[]; rows?: number }) {
  const [active, setActive] = useState(0);
  const [open, setOpen] = useState(false);

  const tab = tabs[active];
  if (!tab) return null;
  const [first, ...rest] = tab.items.slice(0, rows);

  return (
    <aside>
      <div className="mb-3 flex items-center justify-between gap-2 border-l-4 border-purple-800 pl-3 pr-2 sm:mb-4">
        <h2 className="flex min-w-0 items-baseline gap-2 text-xl font-extrabold text-zinc-900">
          <span className="shrink-0">{title}</span>
          {/* the chosen topic, so the "…" menu's state is visible without opening it */}
          {active > 0 && <span className="truncate text-sm font-semibold text-purple-800">{tab.label}</span>}
        </h2>
        <div className="flex shrink-0 items-center gap-1">
          <Link href={tab.href} className="text-sm font-medium text-purple-800 hover:underline">See all →</Link>
          <div className="relative">
            <button
              type="button"
              aria-label={`Choose a ${title} topic`}
              aria-expanded={open}
              onClick={() => setOpen((o) => !o)}
              className={`flex h-11 w-11 items-center justify-center rounded-full transition sm:h-8 sm:w-8 ${open ? "bg-purple-100 text-purple-800" : "text-zinc-500 hover:bg-purple-50 hover:text-purple-800"}`}
            >
              <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden className="h-4 w-4">
                <circle cx="5" cy="12" r="1.8" />
                <circle cx="12" cy="12" r="1.8" />
                <circle cx="19" cy="12" r="1.8" />
              </svg>
            </button>
            {open && (
              <>
                {/* click-anywhere-else closes the menu */}
                <button type="button" aria-hidden tabIndex={-1} onClick={() => setOpen(false)} className="fixed inset-0 z-20 cursor-default" />
                <div className="absolute right-0 top-full z-30 mt-1 min-w-40 overflow-hidden rounded-lg border border-zinc-200 bg-white py-1 shadow-lg">
                  {tabs.map((t, n) => (
                    <button
                      key={t.label}
                      type="button"
                      onClick={() => { setActive(n); setOpen(false); }}
                      className={`block min-h-11 w-full whitespace-nowrap px-3 py-2 text-left text-sm sm:min-h-0 sm:py-1.5 ${n === active ? "bg-purple-50 font-semibold text-purple-800" : "text-zinc-700 hover:bg-zinc-50"}`}
                    >
                      {t.label}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>
      </div>
      {first && <OverlayCard item={first} className="mb-3 aspect-[16/10]" />}
      <div className="space-y-3">
        {/* phones: 2 rows under the card, the rest from sm up */}
        {rest.map((p, i) => (
          <div key={p.href} className={i >= 2 ? "hidden sm:block" : undefined}>
            <ListRow item={p} />
          </div>
        ))}
      </div>
    </aside>
  );
}
