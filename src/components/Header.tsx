"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
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

// mirrors the live site's menu (islamonlive.in): Home, Read (mega), Watch, Listen,
// Infographics — the live nav carries no Hajj & Umrah entry, and Infographics sits last
const NAV: NavItem[] = [
  { label: "Home", href: "/" },
  {
    label: "Read", href: "/category/opinion", children: [
      { label: "Opinion", href: "/category/opinion" },
      { label: "India Today", href: "/category/indian-politics-opinion" },
      { label: "Kerala Voice", href: "/category/kerala-politics-opinion" },
      { label: "Shari'ah", href: "/category/shariah" },
      { label: "Quran", href: "/category/quran" },
      { label: "Culture", href: "/category/culture" },
      { label: "Columns", href: "/category/columns" },
    ],
  },
  { label: "Watch", href: "/watch-videos" },
  { label: "Listen", href: "/listen" },
  { label: "Infographics", href: "/category/infographics" },
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
                <Link href={item.href} className="mt-1 px-2 text-xs font-semibold text-purple-800 hover:underline">
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
                      <span className="pill absolute bottom-2 left-2 inline-flex items-center justify-center rounded bg-purple-700 px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-white">{p.category}</span>
                    )}
                  </div>
                  <h3
                    className="mt-2 line-clamp-2 text-sm font-bold leading-snug text-zinc-900 group-hover/card:text-purple-800"
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

export interface TickerItem {
  href: string;
  title: string;
  category: string;
}

/* Gregorian + Hijri, formatted in the reader's own timezone. Rendering these on
   the server printed the *server's* day (the host runs UTC), so the header could
   sit a day behind for readers in IST — the server snapshot is empty and the
   browser fills both in on hydration instead. */
type Today = { greg: string; hijri: string };
let cachedToday: Today | null = null;

const subscribeToday = () => () => {};
const serverToday = () => null;
function readToday(): Today {
  // cached: useSyncExternalStore re-reads on every render and needs a stable value
  if (!cachedToday) {
    const now = new Date();
    let hijri = "";
    try {
      hijri = new Intl.DateTimeFormat("en-US-u-ca-islamic-umalqura", { day: "numeric", month: "long", year: "numeric" })
        .format(now)
        .replace(/\s*AH$/, "");
    } catch {
      // Intl without the umalqura calendar — the Gregorian date alone still reads fine
    }
    cachedToday = {
      greg: now.toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" }),
      hijri,
    };
  }
  return cachedToday;
}

function useToday() {
  return useSyncExternalStore(subscribeToday, readToday, serverToday);
}

export default function Header({ previews = {}, ticker = [] }: { previews?: Record<string, NavPreviewItem[]>; ticker?: TickerItem[] }) {
  const today = useToday();
  // ponytail: single boolean drives the shrink — no scroll-linked animation lib
  const [shrunk, setShrunk] = useState(false);
  // phones: header only on the home page — inner pages keep just the bottom tab bar
  const isHome = usePathname() === "/";
  useEffect(() => {
    // hysteresis: shrink past 120, expand only under 40 — the gap must exceed the
    // header's height change (~50px) or shrinking shifts scrollY back across the
    // threshold and the header oscillates (the "jerk")
    const onScroll = () => {
      const y = window.scrollY;
      setShrunk((prev) => (prev ? y > 40 : y > 120));
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    // phones: brand-purple rule under the header (desktop gets the purple nav bar instead)
    // pt-safe: in the installed PWA (viewport-fit=cover) the page draws under the
    // status bar — without it, scrolled content shows through above the header
    <header className={`sticky top-0 z-50 border-b-2 border-purple-800 bg-white pt-[env(safe-area-inset-top)] shadow-md md:border-b-0 ${isHome ? "" : "hidden md:block"}`}>
      {/* top bar: date | centered logo | socials + search + support — mirrors live site */}
      <div className={`mx-auto grid max-w-[1600px] grid-cols-[1fr_auto_1fr] items-center gap-2 px-3 transition-[padding] duration-300 sm:px-5 ${shrunk ? "py-1.5" : "py-2 sm:py-3"}`}>
        {/* the date is display:none on mobile, so pin the logo to the middle column
            explicitly — otherwise it collapses into the first track and sits left.
            min-h holds the row steady while the client fills the date in. */}
        <div className="hidden min-h-[2.25rem] items-center gap-2 sm:flex">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden className="h-4 w-4 shrink-0 text-purple-800">
            <rect x="3" y="5" width="18" height="16" rx="2" />
            <path d="M8 3v4M16 3v4M3 10h18" />
          </svg>
          {today && (
            <span className="leading-tight">
              <time className="block text-xs font-semibold text-zinc-700">{today.greg}</time>
              {today.hijri && <span className="block text-[11px] text-purple-800">{today.hijri} AH</span>}
            </span>
          )}
        </div>
        {/* phones: logo left; desktop keeps it centred */}
        <Link href="/" className="col-start-1 justify-self-start sm:col-start-2 sm:justify-self-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo.png" alt="islamonlive" className={`w-auto transition-all duration-300 ${shrunk ? "h-9" : "h-12 sm:h-16"}`} />
        </Link>
        <div className="col-start-3 flex items-center justify-end gap-3">
          <div className="hidden items-center gap-3 text-zinc-500 lg:flex">
            {SOCIAL.map((s) => (
              <a key={s.label} href={s.href} target="_blank" rel="noopener noreferrer" aria-label={s.label} title={s.label} className="hover:text-purple-800">
                <SocialIcon path={s.path} />
              </a>
            ))}
          </div>
          {/* phones: icon only, straight to the search page — the dummy field read as
              a real input and swallowed the first tap while the page loaded */}
          <Link
            href="/search"
            prefetch
            aria-label="Search"
            className="flex h-9 w-9 touch-manipulation items-center justify-center rounded-full text-zinc-600 transition-colors active:bg-purple-100 active:text-purple-800 md:hidden"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden className="h-5 w-5">
              <circle cx="11" cy="11" r="7" />
              <path d="m21 21-4.35-4.35" />
            </svg>
          </Link>
          {/* desktop: real inline search field */}
          <form action="/search" className="relative hidden items-center md:flex">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"
              className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-zinc-400">
              <circle cx="11" cy="11" r="7" />
              <path d="m21 21-4.35-4.35" />
            </svg>
            <input
              type="search" name="q" placeholder="Search…" aria-label="Search"
              className="h-7 w-24 rounded-full border border-zinc-300 py-0 pl-8 pr-3 text-xs leading-none outline-none transition-[width] [font-family:system-ui,sans-serif] focus:w-36 focus:border-purple-700 sm:w-28 sm:focus:w-48"
            />
          </form>
          {/* compact heart chip on phones, full pill on ≥sm — the app-header donate pattern */}
          <a href="https://rzp.io/rzp/5bOM6U7A" target="_blank" rel="noopener noreferrer" aria-label="Support Us" className="pill inline-flex items-center justify-center gap-1.5 whitespace-nowrap rounded-full bg-purple-800 px-2.5 py-1.5 text-xs font-semibold text-white hover:bg-purple-700 sm:px-4 sm:py-2">
            <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden className="h-3.5 w-3.5">
              <path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.6l-1-1a5.5 5.5 0 0 0-7.8 7.8l1 1L12 21l7.8-7.6 1-1a5.5 5.5 0 0 0 0-7.8z" />
            </svg>
            <span className="hidden sm:inline">Support Us</span>
            <span className="sm:hidden">Support</span>
          </a>
        </div>
      </div>
      {/* desktop only — phones use the bottom tab bar */}
      <nav className="relative hidden bg-purple-950 md:block">
        <div className="mx-auto flex max-w-[1600px] justify-center gap-1 px-3 sm:px-5">
          {NAV.map((item) => (
            // `static`, not `relative` — the mega panel spans the whole nav width
            <div key={item.label} className={previews[item.label]?.length ? "group static" : "group relative"}>
              {item.external ? (
                <a href={item.href} target="_blank" rel="noopener noreferrer" className={`flex items-center whitespace-nowrap px-4 text-sm font-medium text-purple-100 transition-[padding] duration-300 hover:bg-purple-800 hover:text-white ${shrunk ? "py-2" : "py-3"}`}>
                  {item.label}
                </a>
              ) : (
                <Link href={item.href} className={`flex items-center gap-1 whitespace-nowrap px-4 text-sm font-medium text-purple-100 transition-[padding] duration-300 hover:bg-purple-800 hover:text-white ${shrunk ? "py-2" : "py-3"}`}>
                  {item.label}
                  {item.children && <span className="text-[10px]">▾</span>}
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
        </div>
      </nav>
      {/* latest-headlines strip — the live site stops at the nav bar; this is the one
          addition, kept in the same purple/white palette so it still reads as masthead */}
      {ticker.length > 0 && (
        <div className={`border-b border-zinc-200 bg-white ${shrunk ? "hidden md:block" : ""}`}>
          <div className="mx-auto flex max-w-[1600px] items-center gap-3 px-3 sm:px-5">
            <span className="pill z-10 -ml-3 inline-flex shrink-0 items-center gap-1.5 bg-purple-800 py-2 pl-3 pr-3 text-[11px] font-bold uppercase tracking-wide text-white sm:-ml-5 sm:pl-5">
              <span className="inline-block h-1.5 w-1.5 rounded-full bg-red-400" />
              Latest
            </span>
            {/* two identical runs so the loop has no visible seam; the second is
                aria-hidden so screen readers don't hear every headline twice */}
            <div className="ticker-mask group relative flex-1 overflow-hidden py-2">
              <div className="ticker-track flex w-max gap-8 group-hover:[animation-play-state:paused]">
                {[0, 1].map((run) => (
                  <div key={run} className="flex gap-8" aria-hidden={run === 1}>
                    {ticker.map((t) => (
                      <Link key={`${run}-${t.href}`} href={t.href} className="flex items-center gap-2 whitespace-nowrap text-sm text-zinc-700 hover:text-purple-800">
                        {t.category && <span className="pill rounded bg-purple-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-purple-800">{t.category}</span>}
                        <span dangerouslySetInnerHTML={{ __html: t.title }} />
                      </Link>
                    ))}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </header>
  );
}
