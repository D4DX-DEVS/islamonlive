"use client";

import { useState, useSyncExternalStore } from "react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { SOCIAL, SocialIcon } from "@/components/social";

export interface NavPreviewItem {
  href: string;
  img: string | null;
  title: string;
  category: string;
  date: string;
}

type NavItem = { label: string; href: string; external?: boolean; children?: { label: string; href: string }[] };

// mirrors the live site's menu (islamonlive.in) exactly: Home, Read (mega),
// Infographics (mega), Watch, Listen — Infographics sits second, not last
const NAV: NavItem[] = [
  { label: "Home", href: "/" },
  {
    label: "Read", href: "/category/opinion", children: [
      { label: "Opinion", href: "/category/opinion" },
      { label: "Shari'ah", href: "/category/shariah" },
      { label: "Culture", href: "/category/culture" },
      { label: "Columns", href: "/category/columns" },
    ],
  },
  { label: "Infographics", href: "/category/infographics" },
  { label: "Watch", href: "/watch-videos" },
  { label: "Listen", href: "/listen" },
];

/* post previews shown while hovering a nav item — the live site's mega menu */
function MegaPanel({ item, posts }: { item: NavItem; posts: NavPreviewItem[] }) {
  return (
    <div className="invisible absolute inset-x-0 top-full z-50 translate-y-1 opacity-0 transition duration-200 group-hover:visible group-hover:translate-y-0 group-hover:opacity-100">
      <div className="mx-auto max-w-[1600px] px-3 sm:px-5">
        {/* capped so the panel can never run past the viewport on short screens */}
        <div className="max-h-[calc(100vh-9rem)] overflow-hidden rounded-b-xl bg-white p-4 shadow-2xl ring-1 ring-black/5">
          <div className={`grid gap-5 ${item.children ? "lg:grid-cols-[180px_1fr]" : ""}`}>
            {item.children && (
              <div className="flex flex-col gap-1 lg:border-r lg:border-zinc-100 lg:pr-5">
                {item.children.map((c) => (
                  <Link key={c.href} href={c.href} className="rounded-md px-2 py-1.5 text-sm font-semibold text-zinc-700 hover:bg-purple-50 hover:text-purple-900">
                    {c.label}
                  </Link>
                ))}
                <Link href={item.href} className="mt-1 px-2 text-xs font-semibold text-[#31094C] hover:underline">
                  See all →
                </Link>
              </div>
            )}
            <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
              {posts.map((p) => (
                <Link key={p.href} href={p.href} className="group/card">
                  <div className="relative aspect-[16/10] w-full overflow-hidden rounded-lg bg-zinc-100 ring-1 ring-inset ring-zinc-900/10">
                    {p.img && <Image src={p.img} alt="" fill sizes="220px" className="object-cover object-top transition duration-500 group-hover/card:scale-105" />}
                    {p.category && (
                      <span className="pill absolute bottom-2 left-2 inline-flex items-center justify-center rounded bg-[#693FE2] px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-white">{p.category}</span>
                    )}
                  </div>
                  <h3
                    className="mt-2 line-clamp-2 text-sm font-bold leading-snug text-zinc-900 group-hover/card:text-[#31094C]"
                    dangerouslySetInnerHTML={{ __html: p.title }}
                  />
                  <time className="mt-0.5 block text-xs text-zinc-500">{p.date}</time>
                </Link>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* Gregorian date, formatted in the reader's own timezone. Rendering this on the
   server printed the *server's* day (the host runs UTC), so the header could sit
   a day behind for readers in IST — the server snapshot is empty and the browser
   fills it in on hydration instead. */
let cachedToday: string | null = null;

const subscribeToday = () => () => {};
const serverToday = () => null;
function readToday(): string {
  // cached: useSyncExternalStore re-reads on every render and needs a stable value
  if (!cachedToday) {
    cachedToday = new Date().toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" });
  }
  return cachedToday;
}

function useToday() {
  return useSyncExternalStore(subscribeToday, readToday, serverToday);
}

function SearchIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden className={className}>
      <circle cx="11" cy="11" r="7" />
      <path d="m21 21-4.35-4.35" />
    </svg>
  );
}

export default function Header({ previews = {} }: { previews?: Record<string, NavPreviewItem[]> }) {
  const today = useToday();
  const pathname = usePathname();
  // phones: the live site's slide-down drawer behind the hamburger
  const [menuOpen, setMenuOpen] = useState(false);
  const [openGroup, setOpenGroup] = useState<string | null>(null);

  // navigating away must close the drawer — the header itself never unmounts.
  // adjusted during render, not in an effect, so the drawer never paints open on
  // the new page (https://react.dev/learn/you-might-not-need-an-effect)
  const [lastPath, setLastPath] = useState(pathname);
  if (lastPath !== pathname) {
    setLastPath(pathname);
    setMenuOpen(false);
    setOpenGroup(null);
  }

  return (
    // static, like the live site's masthead — it scrolls away with the page.
    // pt-safe: in the installed PWA (viewport-fit=cover) the page draws under the
    // status bar — without it the logo capsule sits under the clock.
    <header className="relative z-40 bg-white pt-[env(safe-area-inset-top)] print:hidden">
      {/* top row: date left, actions right — the middle is left empty for the
          logo capsule, which is positioned absolutely so it can straddle the bar */}
      <div className="mx-auto grid max-w-[1600px] grid-cols-[1fr_auto_1fr] items-center gap-2 px-3 py-2.5 sm:px-5 md:py-4">
        {/* min-h holds the row steady while the client fills the date in */}
        <div className="hidden min-h-[1.5rem] items-center md:flex">
          {/* nowrap: at ~768 the date wrapped to two lines and grew the whole row */}
          {today && <time className="whitespace-nowrap text-sm text-zinc-700">{today}</time>}
        </div>
        {/* reserves the centre track so the two side tracks never slide under the logo */}
        <div className="h-9 w-[190px] md:h-12 md:w-[320px]" aria-hidden />
        <div className="col-start-3 flex items-center justify-end gap-4">
          <div className="hidden items-center gap-4 text-zinc-600 lg:flex">
            {SOCIAL.map((s) => (
              <a key={s.label} href={s.href} target="_blank" rel="noopener noreferrer" aria-label={s.label} title={s.label} className="hover:text-[#31094C]">
                <SocialIcon path={s.path} />
              </a>
            ))}
          </div>
          {/* icon only, straight to the search page — the live header has no inline field */}
          <Link href="/search" prefetch aria-label="Search" className="hidden text-zinc-700 hover:text-[#31094C] md:block">
            <SearchIcon className="h-5 w-5" />
          </Link>
          <a
            href="https://rzp.io/rzp/5bOM6U7A"
            target="_blank"
            rel="noopener noreferrer"
            className="pill hidden whitespace-nowrap rounded-full bg-[#693FE2] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[#5a34c7] md:inline-block"
          >
            Support Us
          </a>
        </div>
      </div>

      {/* purple bar — desktop nav; phones get hamburger + search, as on the live site */}
      <div className="relative bg-[#31094C]">
        <nav className="mx-auto hidden max-w-[1600px] justify-center gap-1 px-3 sm:px-5 md:flex">
          {NAV.map((item) => (
            // `static`, not `relative` — the mega panel spans the whole nav width
            <div key={item.label} className={previews[item.label]?.length ? "group static" : "group relative"}>
              {item.external ? (
                <a href={item.href} target="_blank" rel="noopener noreferrer" className="flex items-center whitespace-nowrap px-4 py-3.5 text-[15px] font-medium text-white/90 hover:text-white">
                  {item.label}
                </a>
              ) : (
                <Link href={item.href} className="flex items-center gap-1 whitespace-nowrap px-4 py-3.5 text-[15px] font-medium text-white/90 hover:text-white">
                  {item.label}
                  {(item.children || previews[item.label]?.length) && <span className="text-[10px]">▾</span>}
                </Link>
              )}
              {previews[item.label]?.length ? (
                <MegaPanel item={item} posts={previews[item.label]} />
              ) : item.children ? (
                <div className="invisible absolute left-0 top-full z-50 min-w-48 rounded-b-lg bg-white opacity-0 shadow-lg transition group-hover:visible group-hover:opacity-100">
                  {item.children.map((c) => (
                    <Link key={c.href} href={c.href} className="block px-4 py-2 text-sm text-zinc-700 hover:bg-purple-50 hover:text-purple-900">
                      {c.label}
                    </Link>
                  ))}
                </div>
              ) : null}
            </div>
          ))}
        </nav>

        <div className="flex items-center justify-between px-4 py-3 md:hidden">
          <button
            type="button"
            aria-label="Menu"
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen((v) => !v)}
            className="-ml-1 flex h-11 w-11 touch-manipulation items-center justify-center text-white"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden className="h-6 w-6">
              {menuOpen ? <path d="M6 6l12 12M18 6L6 18" /> : <path d="M3 6h18M3 12h18M3 18h18" />}
            </svg>
          </button>
          <Link href="/search" prefetch aria-label="Search" className="-mr-1 flex h-11 w-11 touch-manipulation items-center justify-center text-white">
            <SearchIcon className="h-6 w-6" />
          </Link>
        </div>
      </div>

      {/* logo capsule — white, 30px radius, straddling the white row and the purple
          bar exactly as on the live site; z-10 keeps it above the bar */}
      <Link
        href="/"
        className="absolute left-1/2 top-[calc(env(safe-area-inset-top)+0.25rem)] z-10 -translate-x-1/2 rounded-[30px] bg-white px-6 py-1.5 md:top-[calc(env(safe-area-inset-top)+0.5rem)] md:px-10 md:py-2"
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/logo.png" alt="islamonlive" className="h-11 w-auto md:h-[68px]" />
      </Link>

      {/* phones: drawer under the purple bar */}
      {menuOpen && (
        <div className="border-b border-zinc-200 bg-white shadow-lg md:hidden">
          {NAV.map((item) => (
            <div key={item.label} className="border-b border-zinc-100 last:border-0">
              <div className="flex items-center">
                <Link href={item.href} className="flex-1 px-4 py-3 text-sm font-semibold text-zinc-800">
                  {item.label}
                </Link>
                {item.children && (
                  <button
                    type="button"
                    aria-label={`Toggle ${item.label}`}
                    aria-expanded={openGroup === item.label}
                    onClick={() => setOpenGroup((g) => (g === item.label ? null : item.label))}
                    className="px-4 py-3 text-zinc-500"
                  >
                    <span className="text-xs">{openGroup === item.label ? "▴" : "▾"}</span>
                  </button>
                )}
              </div>
              {item.children && openGroup === item.label && (
                <div className="bg-zinc-50 pb-1">
                  {item.children.map((c) => (
                    <Link key={c.href} href={c.href} className="block px-7 py-2 text-sm text-zinc-700">
                      {c.label}
                    </Link>
                  ))}
                </div>
              )}
            </div>
          ))}
          {/* the live drawer carries the actions the top row hides on phones */}
          <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-3">
            <div className="flex flex-wrap items-center gap-0.5 text-zinc-600">
              {SOCIAL.map((s) => (
                <a key={s.label} href={s.href} target="_blank" rel="noopener noreferrer" aria-label={s.label} className="flex h-11 w-11 items-center justify-center rounded-full hover:bg-purple-50 hover:text-[#31094C]">
                  <SocialIcon path={s.path} />
                </a>
              ))}
            </div>
            <a
              href="https://rzp.io/rzp/5bOM6U7A"
              target="_blank"
              rel="noopener noreferrer"
              className="pill inline-flex min-h-11 items-center whitespace-nowrap rounded-full bg-[#693FE2] px-4 py-2 text-xs font-semibold text-white"
            >
              Support Us
            </a>
          </div>
        </div>
      )}
    </header>
  );
}
