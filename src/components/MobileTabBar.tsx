"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";

// links the tab bar doesn't carry — shown in the Menu drop-up
const MENU = [
  { label: "Infographics", href: "/category/infographics" },
  { label: "About Us", href: "/about" },
  { label: "Contact Us", href: "/contact" },
  { label: "Privacy Policy", href: "/privacy-policy" },
  { label: "Terms of Use", href: "/terms-of-use" },
];

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
];

/* app-style bottom navigation, phones only */
export default function MobileTabBar() {
  const pathname = usePathname();
  const router = useRouter();
  // the panel is open only for the route it was opened on, so navigating anywhere
  // closes it for free — an effect that reset a boolean on pathname change would
  // cost an extra render (and trip react-hooks/set-state-in-effect)
  const [openedOn, setOpenedOn] = useState<string | null>(null);
  const menuOpen = openedOn === pathname;

  /* Android back should close the panel, not leave the site, so opening pushes a
     throwaway history entry. Everything that closes the panel unwinds that entry
     first — navigating on top of it would leave a duplicate the user has to back
     through twice. */
  const close = useCallback(
    (href?: string) => {
      setOpenedOn(null);
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
    if (!menuOpen) return;
    history.pushState({ ...history.state, iolMenu: true }, "");
    const onPop = () => setOpenedOn(null);
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, [menuOpen]);

  const active = (href: string) =>
    href === "/" ? pathname === "/" : pathname.startsWith(href.split("/").slice(0, 2).join("/"));

  return (
    <nav
      aria-label="Bottom navigation"
      className="fixed inset-x-0 bottom-0 z-50 grid grid-cols-5 border-t border-purple-900 bg-purple-950 pb-[env(safe-area-inset-bottom)] shadow-[0_-4px_12px_rgba(0,0,0,0.25)] md:hidden print:hidden"
    >
      {/* tap-anywhere-else dismissal. First child so it paints under the panel and
          the tabs; it stops at the bar so the bar itself stays un-dimmed. */}
      {menuOpen && (
        <div
          aria-hidden
          onClick={() => close()}
          className="fixed inset-x-0 top-0 bottom-[calc(3.5rem+env(safe-area-inset-bottom))] bg-black/40"
        />
      )}
      {/* drop-up menu panel, sits on top of the bar */}
      {menuOpen && (
        <div
          className="absolute inset-x-0 bottom-full border-t border-purple-900 bg-purple-950 px-4 py-1 shadow-[0_-4px_12px_rgba(0,0,0,0.25)]"
        >
          {MENU.map((m) => (
            <Link
              key={m.href}
              href={m.href}
              onClick={(e) => {
                e.preventDefault();
                close(m.href);
              }}
              className="block touch-manipulation border-b border-purple-900/60 py-3 text-sm font-medium text-purple-100 transition-colors last:border-0 active:bg-purple-900 active:text-white"
            >
              {m.label}
            </Link>
          ))}
        </div>
      )}
      {TABS.map((t) => (
        <Link
          key={t.href}
          href={t.href}
          // with the panel open, route through close() so its history entry is
          // unwound before the push — otherwise back lands on a phantom entry
          onClick={menuOpen ? (e) => { e.preventDefault(); close(t.href); } : undefined}
          className={`relative flex min-h-14 touch-manipulation flex-col items-center justify-center gap-0.5 text-[10px] font-medium transition-colors active:bg-purple-900 ${
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
      <button
        type="button"
        aria-label="Menu"
        aria-expanded={menuOpen}
        onClick={() => (menuOpen ? close() : setOpenedOn(pathname))}
        className={`relative flex min-h-14 touch-manipulation flex-col items-center justify-center gap-0.5 text-[10px] font-medium transition-colors active:bg-purple-900 ${menuOpen ? "text-white" : "text-purple-300"}`}
      >
        {menuOpen && <span aria-hidden className="absolute top-0 h-0.5 w-8 rounded-full bg-purple-400" />}
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden className="h-5 w-5">
          <path d="M4 7h16M4 12h16M4 17h16" />
        </svg>
        <span className="pill">Menu</span>
      </button>
    </nav>
  );
}
