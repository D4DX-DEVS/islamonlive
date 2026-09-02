"use client";

import { useState } from "react";
import Link from "next/link";
import Byline from "@/components/Byline";
import SectionTabs from "@/components/SectionTabs";
import { OverlayCard, ListRow, PostItem } from "@/components/PostCards";

export interface Tab {
  label: string;
  href: string;
  items: PostItem[];
}

/* section whose content swaps between category tabs, like the live site's Read block */
export default function TabbedSection({ title, tabs }: { title: string; tabs: Tab[] }) {
  const [active, setActive] = useState(0);
  const tab = tabs[active];
  if (!tab) return null;

  const [featured, ...rest] = tab.items;
  const row = rest.slice(0, 4);

  return (
    <section>
      <SectionTabs title={title} labels={tabs.map((t) => t.label)} active={active} onSelect={setActive} href={tab.href} />

      {/* top row: image + headline side by side, cards in a full-width row under it.
          The image takes its height from the text column (sm:h-full, no aspect), so
          neither side is left with dead space whatever the excerpt length is. */}
      <div className="grid gap-x-8 gap-y-4 sm:grid-cols-2 [&>*]:min-w-0">
        {featured && <OverlayCard item={featured} className="aspect-[16/11] sm:aspect-auto sm:h-full sm:min-h-[280px]" />}
        {featured && (
          <div className="rounded-xl border border-zinc-200/80 bg-white p-4 shadow-sm">
            <Byline name={featured.author} avatar={featured.authorAvatar} date={featured.date} />
            <Link href={featured.href} className="group">
              <h3
                className="mt-2 text-xl font-extrabold leading-snug text-zinc-900 group-hover:text-purple-800"
                dangerouslySetInnerHTML={{ __html: featured.title }}
              />
            </Link>
            {featured.excerpt && (
              <p className="mt-3 line-clamp-7 text-sm leading-relaxed text-zinc-600">{featured.excerpt}</p>
            )}
            <Link href={featured.href} className="mt-3 inline-flex items-center gap-1 text-sm font-semibold text-purple-800 hover:underline">
              Read more →
            </Link>
          </div>
        )}
        {row.length > 0 && (
          <div className="grid gap-4 sm:col-span-2 sm:grid-cols-2 sm:gap-x-8 [&>*]:min-w-0">
            {/* phones: 4 posts max per section — featured + 3 rows */}
            {row.map((p, i) => (
              <div key={p.href} className={i >= 3 ? "hidden sm:block" : undefined}>
                <ListRow item={p} />
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
