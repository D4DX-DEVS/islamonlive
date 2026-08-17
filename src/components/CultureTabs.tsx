"use client";

import { useState } from "react";
import SectionTabs from "@/components/SectionTabs";
import { OverlayCard, ListRow, PostItem } from "@/components/PostCards";
import type { Tab } from "@/components/TabbedSection";

/* Culture block: same pill tabs as Read, but the live site's two-column
   "big card + list" layout instead of the Read grid */
export default function CultureTabs({ title, tabs }: { title: string; tabs: Tab[] }) {
  const [active, setActive] = useState(0);
  const tab = tabs[active];
  if (!tab) return null;

  // cap at 14 (overlay + 6 rows per column) so this block ends level with the
  // right-hand sidebar instead of running past it into the footer
  const items = tab.items.slice(0, 14);
  // split into two balanced columns; a short tab keeps a single column instead
  // of leaving an empty half-row
  const half = Math.ceil(items.length / 2);
  const cols: PostItem[][] = [items.slice(0, half), items.slice(half)].filter((c) => c.length > 0);

  return (
    <section>
      <SectionTabs title={title} labels={tabs.map((t) => t.label)} active={active} onSelect={setActive} href={tab.href} />
      <div className={`grid gap-x-8 gap-y-6 [&>*]:min-w-0 ${cols.length > 1 ? "sm:grid-cols-2" : ""}`}>
        {cols.map((col, n) => {
          const [first, ...rest] = col;
          return (
            <div key={n}>
              <OverlayCard item={first} className="aspect-[16/10]" />
              {rest.length > 0 && (
                <div className="mt-3 space-y-3">
                  {rest.map((p) => <ListRow key={p.href} item={p} />)}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}
