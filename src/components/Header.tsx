"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
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

// Home, Read (mega), Watch, Listen, Infographics — Infographics sits last
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
  { label: "Watch", href: "/watch-videos" },
  { label: "Listen", href: "/listen" },
  { label: "Infographics", href: "/category/infographics" },
];

// the phone drawer behind the hamburger. The sections are one tap away in the
// bottom tab bar, so the drawer carries the site's own pages instead
const DRAWER: NavItem[] = [
  { label: "About Us", href: "/about" },
  { label: "Contact Us", href: "/contact" },
  { label: "Privacy Policy", href: "/privacy-policy" },
  { label: "Terms of Use", href: "/terms-of-use" },
  { label: "Support Us", href: "https://rzp.io/rzp/5bOM6U7A", external: true },
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

  // navigating away must close the drawer — the header itself never unmounts.
  // adjusted during render, not in an effect, so the drawer never paints open on
  // the new page (https://react.dev/learn/you-might-not-need-an-effect)
  const [lastPath, setLastPath] = useState(pathname);
  if (lastPath !== pathname) {
    setLastPath(pathname);
    setMenuOpen(false);
  }

  // the purple bar pins to the top of the viewport once the white masthead row
  // has scrolled past; the compact bar carries a small logo + the actions the
  // white row used to hold. Both numbers are measured rather than hard-coded —
  // the row's height changes with the breakpoint and the PWA safe-area inset.
  const barRef = useRef<HTMLDivElement | null>(null);
  const [pinned, setPinned] = useState(false);
  const [bar, setBar] = useState({ top: 0, height: 0 });

  useEffect(() => {
    const measure = () => {
      const el = barRef.current;
      // while pinned the bar is out of flow (rect.top is 0) — the last in-flow
      // measurement still stands, and the spacer holds its place in the page
      if (!el || pinned) return;
      const r = el.getBoundingClientRect();
      setBar({ top: r.top + window.scrollY, height: r.height });
    };
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, [pinned]);

  useEffect(() => {
    if (!bar.height) return;
    // no hysteresis needed: the spacer keeps the flow height identical either
    // way, so the threshold can't oscillate under the bar's own state change
    const onScroll = () => setPinned(window.scrollY > bar.top);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [bar.top, bar.height]);

  return (
    // the white masthead row scrolls away with the page, like the live site's;
    // only the purple bar below pins to the top (see `pinned`).
    // pt-safe: in the installed PWA (viewport-fit=cover) the page draws under the
    // status bar — without it the logo capsule sits under the clock.
    <header className={`relative z-40 bg-white md:block md:pt-[env(safe-area-inset-top)] print:hidden ${pathname === "/" ? "" : "hidden"}`}>
      {/* top row: date left, actions right — the middle is left empty for the
          logo capsule, which is positioned absolutely so it can straddle the bar */}
      <div className="mx-auto hidden max-w-[1600px] grid-cols-[1fr_auto_1fr] items-center gap-2 px-3 sm:px-5 md:grid md:py-4">
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

      {/* purple bar — desktop nav; phones get hamburger + search, as on the live site.
          Pins to the top once scrolled past, in a shorter form with the logo inline. */}
      <div
        ref={barRef}
        className={`bg-[#31094C] pt-[env(safe-area-inset-top)] md:pt-0 ${pinned ? "fixed inset-x-0 top-0 z-50 shadow-lg shadow-black/25 md:pt-[env(safe-area-inset-top)]" : "relative"}`}
      >
        {/* overlay row: the pinned bar's logo and actions. Absolute so the nav
            stays centred on the bar, and kept out of the nav's own element so it
            doesn't become the mega panel's containing block */}
        <div className="pointer-events-none absolute inset-y-0 left-1/2 hidden w-full max-w-[1600px] -translate-x-1/2 items-center justify-between px-3 sm:px-5 md:flex">
          <Link
            href="/"
            aria-label="islamonlive"
            className={`pointer-events-auto my-2 transition-opacity duration-200 ${pinned ? "opacity-100" : "pointer-events-none opacity-0"}`}
          >
            {/* the footer's white wordmark — it reads on the purple bar unaided, so no capsule */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo-white.png" alt="" className="h-7 w-auto" />
          </Link>
          <div className={`flex items-center gap-3 transition-opacity duration-200 ${pinned ? "pointer-events-auto opacity-100" : "opacity-0"}`}>
            <Link href="/search" prefetch aria-label="Search" className="text-white/90 hover:text-white">
              <SearchIcon className="h-5 w-5" />
            </Link>
            {/* lg only: at 768 the pill would run into the centred nav */}
            <a
              href="https://rzp.io/rzp/5bOM6U7A"
              target="_blank"
              rel="noopener noreferrer"
              className="pill hidden whitespace-nowrap rounded-full bg-[#693FE2] px-4 py-1.5 text-xs font-semibold text-white hover:bg-[#5a34c7] lg:inline-block"
            >
              Support Us
            </a>
          </div>
        </div>

        {/* pt-2 unpinned: the logo capsule hangs ~12px into this bar, and without
            it the capsule's bottom edge sat 2px off the nav labels */}
        <nav className={`mx-auto hidden max-w-[1600px] justify-center gap-1 px-3 sm:px-5 md:flex ${pinned ? "" : "pt-3"}`}>
          {NAV.map((item) => (
            // `static`, not `relative` — the mega panel spans the whole nav width
            <div key={item.label} className={previews[item.label]?.length ? "group static" : "group relative"}>
              {item.external ? (
                <a href={item.href} target="_blank" rel="noopener noreferrer" className={`flex items-center whitespace-nowrap px-4 text-[15px] font-medium text-white/90 hover:text-white ${pinned ? "py-3" : "py-4"}`}>
                  {item.label}
                </a>
              ) : (
                <Link href={item.href} className={`flex items-center gap-1 whitespace-nowrap px-4 text-[15px] font-medium text-white/90 hover:text-white ${pinned ? "py-3" : "py-4"}`}>
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

        <div className="relative z-10 flex items-center justify-between px-4 py-3 md:hidden">
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
          {/* phones have no white row at all — this bar is the header, so the
              wordmark sits between the two controls at every scroll position */}
          <Link href="/" aria-label="islamonlive">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo-white.png" alt="" className="h-7 w-auto" />
          </Link>
          <Link href="/search" prefetch aria-label="Search" className="-mr-1 flex h-11 w-11 touch-manipulation items-center justify-center text-white">
            <SearchIcon className="h-6 w-6" />
          </Link>
        </div>

        {/* drawer lives inside the bar so it follows it when the bar pins —
            rendered outside it, it would open back at the page's top */}
        {menuOpen && (
          <button
            type="button"
            aria-hidden
            tabIndex={-1}
            onClick={() => setMenuOpen(false)}
            className="fixed inset-0 cursor-default bg-black/40 md:hidden"
          />
        )}
        {menuOpen && (
          <div className="relative z-10 max-h-[calc(100vh-8rem)] overflow-y-auto border-b border-zinc-200 bg-white shadow-lg md:hidden">
            {DRAWER.map((item) => (
              <div key={item.label} className="border-b border-zinc-100 last:border-0">
                {item.external ? (
                  <a href={item.href} target="_blank" rel="noopener noreferrer" className="block px-4 py-2 text-[13px] font-semibold text-zinc-800">
                    {item.label}
                  </a>
                ) : (
                  <Link href={item.href} className="block px-4 py-2 text-[13px] font-semibold text-zinc-800">
                    {item.label}
                  </Link>
                )}
              </div>
            ))}
            {/* the live drawer carries the social row the bar has no space for */}
            <div className="flex flex-wrap items-center gap-0.5 px-3 py-1 text-zinc-600">
              {SOCIAL.map((s) => (
                <a key={s.label} href={s.href} target="_blank" rel="noopener noreferrer" aria-label={s.label} className="flex h-9 w-9 items-center justify-center rounded-full hover:bg-purple-50 hover:text-[#31094C]">
                  <SocialIcon path={s.path} />
                </a>
              ))}
            </div>
          </div>
        )}
      </div>
      {/* stands in for the bar's flow height while it is pinned, so the page
          below doesn't jump up at the moment it detaches */}
      {pinned && <div aria-hidden style={{ height: bar.height }} />}

      {/* logo capsule — white, 30px radius, straddling the white row and the purple
          bar exactly as on the live site; z-10 keeps it above the bar */}
      <Link
        href="/"
        className="absolute left-1/2 top-[calc(env(safe-area-inset-top)+0.5rem)] z-10 hidden -translate-x-1/2 rounded-[30px] bg-white px-10 py-2 md:block"
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/logo.png" alt="islamonlive" className="h-[68px] w-auto" />
      </Link>
    </header>
  );
}
