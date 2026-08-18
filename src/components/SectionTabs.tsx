"use client";

import Link from "next/link";

/* shared header for tabbed sections: title + category pills + "See all" */
export default function SectionTabs({
  title,
  labels,
  active,
  onSelect,
  href,
}: {
  title: string;
  labels: string[];
  active: number;
  onSelect: (n: number) => void;
  href: string;
}) {
  return (
    <div className="mb-4 flex flex-wrap items-center gap-x-4 gap-y-2 border-l-4 border-purple-800 pl-3 pr-2">
      <h2 className="text-xl font-extrabold text-zinc-900">{title}</h2>
      {/* pushed right of the title, like the live site's section menus */}
      {/* phones: one swipeable row under the title, never a vertical stack */}
      <div className="scrollbar-none -mx-1 order-last flex w-full flex-nowrap items-center gap-1 overflow-x-auto px-1 sm:order-none sm:w-auto sm:flex-1 sm:flex-wrap sm:justify-center sm:gap-2">
        {labels.map((label, n) => (
          <button
            key={label}
            type="button"
            onClick={() => onSelect(n)}
            aria-pressed={n === active}
            className={`pill whitespace-nowrap rounded-full px-4 py-2 text-xs font-semibold uppercase tracking-wide transition ${
              n === active ? "bg-purple-800 text-white" : "text-zinc-500 hover:bg-purple-50 hover:text-purple-800"
            }`}
          >
            {label}
          </button>
        ))}
      </div>
      <Link href={href} className="text-sm font-medium text-purple-800 hover:underline">
        See all →
      </Link>
    </div>
  );
}
