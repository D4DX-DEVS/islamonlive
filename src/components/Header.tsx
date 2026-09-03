"use client";

import { useEffect, useRef, useState, useSyncExternalStore, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { usePathname } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { SOCIAL, SocialIcon } from "@/components/social";
import { showChrome, useChromeVisible, usePageScrolled } from "@/lib/appChrome";

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
// bottom tab bar, so the drawer carries the site's own pages instead.
// Each row leads with an icon so the sheet scans as a list of *places* rather
// than a stack of legal text — Support Us is pulled out below as the one action.
const DRAWER: (NavItem & { icon: ReactNode })[] = [
  {
    label: "About Us",
    href: "/about",
    icon: (
      <>
        <circle cx="12" cy="12" r="9" />
        <path d="M12 11.5v4.5M12 8h.01" />
      </>
    ),
  },
  {
    label: "Contact Us",
    href: "/contact",
    icon: (
      <>
        <rect x="3" y="5" width="18" height="14" rx="3" />
        <path d="m3.8 7.6 7 4.8a2.2 2.2 0 0 0 2.4 0l7-4.8" />
      </>
    ),
  },
  {
    label: "Privacy Policy",
    href: "/privacy-policy",
    icon: (
      <>
        <path d="M12 3.2 5 5.9v5.4c0 4.2 2.9 7.6 7 9.5 4.1-1.9 7-5.3 7-9.5V5.9z" />
        <path d="m9.3 12.2 1.9 1.9 3.5-3.7" />
      </>
    ),
  },
  {
    label: "Terms of Use",
    href: "/terms-of-use",
    icon: (
      <>
        <path d="M14 3.2H7.5a2 2 0 0 0-2 2v13.6a2 2 0 0 0 2 2h9a2 2 0 0 0 2-2V8.2z" />
        <path d="M14 3.2v5h5" />
        <path d="M9 13h6M9 16.4h4" />
      </>
    ),
  },
];

const SUPPORT_HREF = "https://rzp.io/rzp/5bOM6U7A";

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

/* row affordances in the phone sheet: internal pages get a chevron, off-site
   links get the arrow that says "this leaves the app" */
function ChevronIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden className={className}>
      <path d="m9 5 7 7-7 7" />
    </svg>
  );
}

function HeartIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden className={className}>
      <path d="M12 20.7c-.3 0-.6-.1-.8-.3l-7-6.5A5.6 5.6 0 0 1 2.5 9.5 5.4 5.4 0 0 1 8 4.1a5.4 5.4 0 0 1 4 1.8 5.4 5.4 0 0 1 4-1.8 5.4 5.4 0 0 1 5.5 5.4c0 1.6-.7 3.1-1.7 4.4l-7 6.5c-.2.2-.5.3-.8.3z" />
    </svg>
  );
}

/* the drawer row itself — one shape for the internal and the external variant so
   the padding, the icon tile and the press state can never drift apart */
function DrawerRow({
  item,
  index,
  onNavigate,
}: {
  item: NavItem & { icon: ReactNode };
  index: number;
  onNavigate: () => void;
}) {
  const inner = (
    <>
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white/10 text-white transition-colors group-active:bg-[#693FE2]">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden className="h-[18px] w-[18px]">
          {item.icon}
        </svg>
      </span>
      <span className="flex-1 text-[15px] font-semibold text-white">{item.label}</span>
      <ChevronIcon className="h-4 w-4 text-white/35" />
    </>
  );
  const className =
    "drawer-item group flex min-h-12 touch-manipulation items-center gap-3 rounded-2xl px-2.5 py-2 transition active:scale-[0.985] active:bg-white/10";
  // 34ms apart: fast enough that the last row still lands inside the sheet's own
  // 280ms open, slow enough to read as a cascade rather than a single flash
  const style = { animationDelay: `${60 + index * 34}ms` };

  return item.external ? (
    <a href={item.href} target="_blank" rel="noopener noreferrer" onClick={onNavigate} className={className} style={style}>
      {inner}
    </a>
  ) : (
    <Link href={item.href} onClick={onNavigate} className={className} style={style}>
      {inner}
    </Link>
  );
}

export default function Header({ previews = {} }: { previews?: Record<string, NavPreviewItem[]> }) {
  const today = useToday();
  const pathname = usePathname();
  // phones: the live site's slide-down drawer behind the hamburger
  const [menuOpen, setMenuOpen] = useState(false);
  // `menuOpen` is the intent; `menuMounted` keeps the sheet in the tree for the
  // length of its close animation. Open and close are both keyframes rather than
  // transitions — a freshly mounted node has no "from" state to transition out of
  const [menuMounted, setMenuMounted] = useState(false);

  // navigating away must close the drawer — the header itself never unmounts.
  // adjusted during render, not in an effect, so the drawer never paints open on
  // the new page (https://react.dev/learn/you-might-not-need-an-effect)
  const [lastPath, setLastPath] = useState(pathname);
  if (lastPath !== pathname) {
    setLastPath(pathname);
    setMenuOpen(false);
  }

  // mounted during render, unmounted by the effect below — opening must paint
  // the sheet in the same commit that flips the button, or the first frame of
  // the open animation is missed
  if (menuOpen && !menuMounted) setMenuMounted(true);

  // phones: the header sticks to the top of the viewport on every route and
  // slides away while the reader scrolls down, the way Chrome's own toolbar
  // does. It used to be display:none off the home page, which left readers on
  // an article with no way back up short of the OS back gesture.
  const chromeVisible = useChromeVisible();
  const scrolled = usePageScrolled();
  // an open drawer pins the header down — sliding the bar out from under a menu
  // the reader is still looking at loses them the close button. Held through the
  // close animation too, so the bar doesn't shoot up while the sheet fades
  const chromeHidden = !chromeVisible && !menuMounted;

  useEffect(() => {
    showChrome();
  }, [pathname]);

  // closing plays an animation, so the sheet outlives the close by one beat
  useEffect(() => {
    if (menuOpen) return;
    // matches .sheet-out's duration in globals.css
    const id = setTimeout(() => setMenuMounted(false), 200);
    return () => clearTimeout(id);
  }, [menuOpen]);

  // an open sheet owns the screen: the page behind it must not scroll away under
  // the reader's thumb, and Escape closes it for anyone on a keyboard
  useEffect(() => {
    if (!menuOpen) return;
    const { body } = document;
    const prev = body.style.overflow;
    body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMenuOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => {
      body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [menuOpen]);

  // the out-of-flow purple bar below is a desktop affordance: on phones the
  // whole header is already sticky, and letting both fire stacked two copies of
  // the bar at the top of the screen
  const [desktop, setDesktop] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(min-width: 768px)");
    const sync = () => setDesktop(mq.matches);
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);

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
    const onScroll = () => setPinned(desktop && window.scrollY > bar.top);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [bar.top, bar.height, desktop]);

  return (
    // the white masthead row scrolls away with the page, like the live site's;
    // only the purple bar below pins to the top (see `pinned`).
    // pt-safe: in the installed PWA (viewport-fit=cover) the page draws under the
    // status bar — without it the logo capsule sits under the clock.
    <header
      // the slide is applied from JS rather than behind an `md:` variant because
      // a transform — or even a bare will-change:transform — makes the header the
      // containing block for position:fixed descendants, and the desktop purple
      // bar pins itself with exactly that. Left on at md it anchored to the
      // header instead of the viewport and scrolled off the top with the page.
      className={`sticky top-0 z-40 bg-white transition-transform duration-300 motion-reduce:transition-none md:relative md:pt-[env(safe-area-inset-top)] md:transition-none print:hidden ${
        desktop ? "" : `will-change-transform ${chromeHidden ? "-translate-y-full" : "translate-y-0"}`
      }`}
    >
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
        className={`bg-[#31094C] pt-[env(safe-area-inset-top)] transition-shadow duration-200 md:pt-0 ${
          pinned ? "fixed inset-x-0 top-0 z-50 md:pt-[env(safe-area-inset-top)]" : "relative"
        } ${
          // desktop shadows the bar once it detaches; phones shadow the sticky
          // header the moment the page leaves its top, so the bar always reads
          // as sitting above the content scrolling under it
          pinned || (scrolled && !desktop) ? "shadow-lg shadow-black/25" : ""
        }`}
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
          {/* three bars that fold into the X rather than swapping to it — the
              same gesture the sheet makes, and it reads as one control */}
          <button
            type="button"
            aria-label="Menu"
            aria-expanded={menuOpen}
            aria-controls="phone-menu"
            onClick={() => setMenuOpen((v) => !v)}
            className={`-ml-1 flex h-11 w-11 touch-manipulation items-center justify-center rounded-full text-white transition-colors ${
              menuOpen ? "bg-white/15" : "active:bg-white/10"
            }`}
          >
            <span aria-hidden className="relative block h-[15px] w-[19px]">
              <span
                className={`absolute left-0 block h-[2px] w-full rounded-full bg-current transition-all duration-300 ease-[cubic-bezier(.16,1,.3,1)] motion-reduce:transition-none ${
                  menuOpen ? "top-1/2 -translate-y-1/2 rotate-45" : "top-0"
                }`}
              />
              <span
                className={`absolute left-0 top-1/2 block h-[2px] w-full -translate-y-1/2 rounded-full bg-current transition-all duration-200 motion-reduce:transition-none ${
                  menuOpen ? "scale-x-0 opacity-0" : "scale-x-100 opacity-100"
                }`}
              />
              <span
                className={`absolute left-0 block h-[2px] w-full rounded-full bg-current transition-all duration-300 ease-[cubic-bezier(.16,1,.3,1)] motion-reduce:transition-none ${
                  menuOpen ? "top-1/2 -translate-y-1/2 -rotate-45" : "top-[13px]"
                }`}
              />
            </span>
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
        {/* portalled to the body: the header carries a transform now (it slides
            away as the reader scrolls), and a transformed ancestor becomes the
            containing block for position:fixed children — left in place the
            backdrop shrank to the height of the bar */}
        {menuMounted &&
          createPortal(
            <button
              type="button"
              aria-hidden
              tabIndex={-1}
              onClick={() => setMenuOpen(false)}
              className={`fixed inset-0 z-30 cursor-default bg-[#14022099] backdrop-blur-[3px] md:hidden ${menuOpen ? "fade-in" : "fade-out"}`}
            />,
            document.body
          )}
        {menuMounted && (
          // a card floating clear of the bar, not a slab welded to it: the inset,
          // the radius and the drop shadow are what make it read as an app sheet
          <div
            id="phone-menu"
            className={`absolute inset-x-0 top-full z-10 px-3 pt-2 md:hidden ${menuOpen ? "sheet-in" : "sheet-out"}`}
          >
            {/* the bar's own #31094C, so the sheet reads as the chrome extending
                downward; the gap, the radius and the ring keep it a card and not
                a taller bar */}
            <div className="max-h-[calc(100dvh-8.5rem)] overflow-y-auto overscroll-contain rounded-[26px] bg-[#31094C] p-2 shadow-[0_22px_45px_-12px_rgba(10,1,18,0.7)] ring-1 ring-white/10">
              <p className="pill px-3 pb-1 pt-1.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-white/40">More</p>
              {DRAWER.map((item, i) => (
                <DrawerRow key={item.label} item={item} index={i} onNavigate={() => setMenuOpen(false)} />
              ))}

              {/* Support Us is the one thing here worth asking for, so it stops
                  being a list row and becomes the sheet's single button */}
              <a
                href={SUPPORT_HREF}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => setMenuOpen(false)}
                style={{ animationDelay: `${60 + DRAWER.length * 34}ms` }}
                className="drawer-item mt-1.5 flex min-h-12 touch-manipulation items-center justify-center gap-2 rounded-2xl bg-[#693FE2] px-4 text-[15px] font-semibold text-white shadow-lg shadow-black/25 transition active:scale-[0.98] active:bg-[#5a34c7]"
              >
                <HeartIcon className="h-4 w-4" />
                Support Us
              </a>

              {/* the live drawer carries the social row the bar has no space for */}
              <div
                style={{ animationDelay: `${94 + DRAWER.length * 34}ms` }}
                className="drawer-item mt-1.5 rounded-2xl bg-white/[0.06] px-3 pb-2.5 pt-2"
              >
                <p className="pill pb-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-white/40">Follow us</p>
                <div className="flex items-center justify-between gap-1">
                  {SOCIAL.map((s) => (
                    <a
                      key={s.label}
                      href={s.href}
                      target="_blank"
                      rel="noopener noreferrer"
                      aria-label={s.label}
                      className="flex h-10 w-10 touch-manipulation items-center justify-center rounded-full bg-white/10 text-white/85 ring-1 ring-white/10 transition active:scale-90 active:bg-white active:text-[#31094C]"
                    >
                      <SocialIcon path={s.path} size={17} />
                    </a>
                  ))}
                </div>
              </div>
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
