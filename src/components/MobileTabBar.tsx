"use client";

import { useCallback, useEffect, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useChromeVisible } from "@/lib/appChrome";

interface PanelLink {
  label: string;
  href: string;
  hint?: string;
  external?: boolean;
}

interface Tab {
  label: string;
  href: string;
  icon: ReactNode;
  /** when present the tab opens a chooser instead of navigating */
  children?: PanelLink[];
  /** extra path prefixes that should light this tab up (Reels lives under Watch) */
  match?: string[];
}

// the Menu drop-up: the reader's own pages first, then the four subsites, which
// are separate WordPress installs and leave the app entirely
const MENU: PanelLink[] = [
  { label: "Saved articles", href: "/saved", hint: "Everything you bookmarked" },
  { label: "Continue reading", href: "/saved?tab=recent", hint: "Pick up where you left off" },
  { label: "Settings", href: "/settings", hint: "Text size, font, daily reminder" },
  { label: "Hajj & Umra", href: "https://hajj.islamonlive.in/", external: true },
  { label: "Muhammed Nabi", href: "https://mohammednabi.islamonlive.in/", external: true },
  { label: "Fatwa", href: "https://fatwa.islamonlive.in/", external: true },
  { label: "Ramadan", href: "https://ramadan.islamonlive.in/", external: true },
];

// tapping Read used to drop straight into Opinion, which made the other three
// sections look like they weren't in the app at all. Order matches the website's
// own section order down the homepage.
const READ_SECTIONS: PanelLink[] = [
  { label: "Shari'ah", href: "/category/shariah", hint: "Quran, Faith, Fiqh, Sunnah" },
  { label: "Opinion", href: "/category/opinion", hint: "India, Kerala, Palestine, World" },
  { label: "Columns", href: "/category/columns", hint: "Regular writers" },
  { label: "Culture", href: "/category/culture", hint: "History, Civilization, Art, Travel" },
];

const TABS: Tab[] = [
  {
    label: "Home",
    href: "/",
    icon: (
      <>
        <path d="M3 10a2 2 0 0 1 .7-1.5l7-6a2 2 0 0 1 2.6 0l7 6A2 2 0 0 1 21 10v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
        <path d="M9.5 21v-6.5a1 1 0 0 1 1-1h3a1 1 0 0 1 1 1V21" />
      </>
    ),
  },
  {
    label: "Read",
    href: "/category/opinion",
    match: ["/category"],
    children: READ_SECTIONS,
    icon: (
      <>
        <path d="M12 7v14" />
        <path d="M3 18a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h5a4 4 0 0 1 4 4 4 4 0 0 1 4-4h5a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1h-6a3 3 0 0 0-3 3 3 3 0 0 0-3-3z" />
      </>
    ),
  },
  {
    // no chooser: the feed pages carry their own Reels/YouTube switch, so a
    // drop-up here would ask the same question twice. Land on Reels, switch on top.
    label: "Watch",
    href: "/reels",
    match: ["/watch-videos"],
    icon: (
      <>
        <circle cx="12" cy="12" r="9.5" />
        <path d="m10 8.5 6 3.5-6 3.5z" />
      </>
    ),
  },
  {
    label: "Listen",
    href: "/listen",
    icon: (
      <path d="M3 14h3a2 2 0 0 1 2 2v3a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-7a9 9 0 0 1 18 0v7a2 2 0 0 1-2 2h-1a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h3" />
    ),
  },
];

function ChevronIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden className="h-4 w-4 shrink-0 text-purple-400/70">
      <path d="m9 5 7 7-7 7" />
    </svg>
  );
}

/* app-style bottom navigation, phones only */
export default function MobileTabBar() {
  const pathname = usePathname();
  const router = useRouter();
  // the panel is open only for the route it was opened on, so navigating anywhere
  // closes it for free — an effect that reset state on pathname change would cost
  // an extra render (and trip react-hooks/set-state-in-effect). It carries which
  // tab owns the panel now that Read and Watch open one too.
  const [opened, setOpened] = useState<{ tab: string; path: string } | null>(null);
  const openTab = opened && opened.path === pathname ? opened.tab : null;
  const panelOpen = openTab !== null;

  // slides down out of the way while the reader scrolls into the page and comes
  // back the moment they scroll up, in step with the header (same store). An
  // open drop-up holds it in place — the panel is anchored to the bar
  const hidden = !useChromeVisible() && !panelOpen;

  /* Android back should close the panel, not leave the site, so opening pushes a
     throwaway history entry. Everything that closes the panel unwinds that entry
     first — navigating on top of it would leave a duplicate the user has to back
     through twice. */
  const close = useCallback(
    (href?: string) => {
      setOpened(null);
      if (!history.state?.iolMenu) {
        if (href) router.push(href);
        return;
      }
      const after = () => {
        window.removeEventListener("popstate", after);
        if (href) router.push(href);
      };
      window.addEventListener("popstate", after);
      history.back();
    },
    [router]
  );

  useEffect(() => {
    if (!panelOpen) return;
    history.pushState({ ...history.state, iolMenu: true }, "");
    const onPop = () => setOpened(null);
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, [panelOpen]);

  const active = (t: Tab) => {
    if (t.href === "/") return pathname === "/";
    const prefixes = [t.href.split("/").slice(0, 2).join("/"), ...(t.match ?? [])];
    return prefixes.some((p) => pathname.startsWith(p));
  };

  const panelLinks: PanelLink[] =
    openTab === "Menu" ? MENU : TABS.find((t) => t.label === openTab)?.children ?? [];

  const rowClass =
    "flex touch-manipulation items-center gap-3 border-b border-purple-900/60 py-3 text-left transition-colors last:border-0 active:bg-purple-900";

  return (
    <nav
      aria-label="Bottom navigation"
      className={`fixed inset-x-0 bottom-0 z-50 grid grid-cols-5 border-t border-purple-900 bg-purple-950 pb-[env(safe-area-inset-bottom)] shadow-[0_-4px_12px_rgba(0,0,0,0.25)] transition-transform duration-300 will-change-transform motion-reduce:transition-none md:hidden print:hidden ${
        hidden ? "translate-y-full" : "translate-y-0"
      }`}
    >
      {/* tap-anywhere-else dismissal; it stops at the bar so the bar itself stays
          un-dimmed. Portalled to the body because the bar now carries a transform
          to slide out of view, and that makes it the containing block for any
          position:fixed descendant — the backdrop would cover only the bar. */}
      {panelOpen &&
        createPortal(
          <div
            aria-hidden
            onClick={() => close()}
            className="fixed inset-x-0 top-0 bottom-[calc(3.5rem+env(safe-area-inset-bottom))] z-40 bg-black/40"
          />,
          document.body
        )}
      {/* drop-up panel, sits on top of the bar. One panel for every tab that has
          a chooser — Read, Watch and Menu all render through it */}
      {panelOpen && (
        <div className="absolute inset-x-0 bottom-full max-h-[70vh] overflow-y-auto border-t border-purple-900 bg-purple-950 px-4 py-1 shadow-[0_-4px_12px_rgba(0,0,0,0.25)]">
          {panelLinks.map((m) =>
            m.external ? (
              <a
                key={m.href}
                href={m.href}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => close()}
                className={rowClass}
              >
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-semibold text-purple-100">{m.label}</span>
                  {m.hint && <span className="block truncate text-xs text-purple-300/70">{m.hint}</span>}
                </span>
                <ChevronIcon />
              </a>
            ) : (
              <Link
                key={m.href}
                href={m.href}
                onClick={(e) => {
                  e.preventDefault();
                  close(m.href);
                }}
                className={rowClass}
              >
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-semibold text-purple-100">{m.label}</span>
                  {m.hint && <span className="block truncate text-xs text-purple-300/70">{m.hint}</span>}
                </span>
                <ChevronIcon />
              </Link>
            )
          )}
        </div>
      )}
      {TABS.map((t) => {
        const isOpen = openTab === t.label;
        const cls = `relative flex min-h-14 touch-manipulation flex-col items-center justify-center gap-0.5 text-[10px] font-medium transition-colors active:bg-purple-900 ${
          active(t) || isOpen ? "text-white" : "text-purple-300"
        }`;
        const inner = (
          <>
            {(active(t) || isOpen) && <span aria-hidden className="absolute top-0 h-0.5 w-8 rounded-full bg-purple-400" />}
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden className="h-5 w-5">
              {t.icon}
            </svg>
            <span className="pill">{t.label}</span>
          </>
        );
        // a tab with a chooser is a button, not a link: it opens the panel rather
        // than guessing which of its sections the reader wanted
        return t.children ? (
          <button
            key={t.label}
            type="button"
            aria-expanded={isOpen}
            onClick={() => (isOpen ? close() : setOpened({ tab: t.label, path: pathname }))}
            className={cls}
          >
            {inner}
          </button>
        ) : (
          <Link
            key={t.label}
            href={t.href}
            // with a panel open, route through close() so its history entry is
            // unwound before the push — otherwise back lands on a phantom entry
            onClick={panelOpen ? (e) => { e.preventDefault(); close(t.href); } : undefined}
            className={cls}
          >
            {inner}
          </Link>
        );
      })}
      <button
        type="button"
        aria-label="Menu"
        aria-expanded={openTab === "Menu"}
        onClick={() => (openTab === "Menu" ? close() : setOpened({ tab: "Menu", path: pathname }))}
        className={`relative flex min-h-14 touch-manipulation flex-col items-center justify-center gap-0.5 text-[10px] font-medium transition-colors active:bg-purple-900 ${openTab === "Menu" ? "text-white" : "text-purple-300"}`}
      >
        {openTab === "Menu" && <span aria-hidden className="absolute top-0 h-0.5 w-8 rounded-full bg-purple-400" />}
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden className="h-5 w-5">
          <path d="M4 6h16M4 12h16M4 18h16" />
        </svg>
        <span className="pill">Menu</span>
      </button>
    </nav>
  );
}
