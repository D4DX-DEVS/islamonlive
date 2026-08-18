"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  {
    label: "Home",
    href: "/",
    icon: <path d="M3 10.5 12 3l9 7.5M5 9.5V21h5v-6h4v6h5V9.5" />,
  },
  {
    label: "Read",
    href: "/category/opinion",
    icon: <path d="M4 6a2 2 0 0 1 2-2h5v16H6a2 2 0 0 0-2 2V6Zm16 0a2 2 0 0 0-2-2h-5v16h5a2 2 0 0 1 2 2V6Z" />,
  },
  {
    label: "Watch",
    href: "/watch-videos",
    icon: (
      <>
        <rect x="2.5" y="5" width="19" height="14" rx="3" />
        <path d="M10.5 9.5v5l4.5-2.5z" />
      </>
    ),
  },
  {
    label: "Listen",
    href: "/listen",
    icon: <path d="M4 13a8 8 0 0 1 16 0M4 13v4a2 2 0 0 0 2 2h1v-6H6m14 0v4a2 2 0 0 1-2 2h-1v-6h1" />,
  },
  {
    label: "Search",
    href: "/search",
    icon: (
      <>
        <circle cx="11" cy="11" r="7" />
        <path d="m21 21-4.35-4.35" />
      </>
    ),
  },
];

/* app-style bottom navigation, phones only */
export default function MobileTabBar() {
  const pathname = usePathname();
  const active = (href: string) =>
    href === "/" ? pathname === "/" : pathname.startsWith(href.split("/").slice(0, 2).join("/"));

  return (
    <nav
      aria-label="Bottom navigation"
      className="fixed inset-x-0 bottom-0 z-50 grid grid-cols-5 border-t border-purple-900 bg-purple-950 pb-[env(safe-area-inset-bottom)] md:hidden print:hidden"
    >
      {TABS.map((t) => (
        <Link
          key={t.href}
          href={t.href}
          className={`relative flex min-h-14 flex-col items-center justify-center gap-0.5 text-[10px] font-medium ${
            active(t.href) ? "text-white" : "text-purple-300"
          }`}
        >
          {active(t.href) && <span aria-hidden className="absolute top-0 h-0.5 w-8 rounded-full bg-purple-400" />}
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden className="h-5 w-5">
            {t.icon}
          </svg>
          <span className="pill">{t.label}</span>
        </Link>
      ))}
    </nav>
  );
}
