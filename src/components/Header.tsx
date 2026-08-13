"use client";

import { useEffect, useState } from "react";
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

// mirrors the live site's menu: Read (mega), Infographics, Watch, Listen, Hajj & Umrah
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
  { label: "Hajj & Umrah", href: "https://hajj.islamonlive.in/", external: true },
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
                      <span className="absolute bottom-2 left-2 rounded bg-purple-700 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white">{p.category}</span>
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

export default function Header({ previews = {} }: { previews?: Record<string, NavPreviewItem[]> }) {
  const today = new Date().toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" });
  // ponytail: single boolean drives the shrink — no scroll-linked animation lib
  const [shrunk, setShrunk] = useState(false);
  useEffect(() => {
    const onScroll = () => setShrunk(window.scrollY > 60);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header className="sticky top-0 z-50 bg-white shadow">
      {/* top bar: date | centered logo | socials + search + support — mirrors live site */}
      <div className={`mx-auto grid max-w-[1600px] grid-cols-[1fr_auto_1fr] items-center gap-2 px-3 transition-[padding] duration-300 sm:px-5 ${shrunk ? "py-1.5" : "py-2 sm:py-3"}`}>
        {/* the date is display:none on mobile, so pin the logo to the middle column
            explicitly — otherwise it collapses into the first track and sits left */}
        <time suppressHydrationWarning className="hidden text-xs text-zinc-500 sm:block">{today}</time>
        <Link href="/" className="col-start-2 justify-self-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo.png" alt="islamonlive" className={`w-auto transition-all duration-300 ${shrunk ? "h-9" : "h-10 sm:h-14"}`} />
        </Link>
        <div className="flex items-center justify-end gap-3">
          <div className="hidden items-center gap-3 text-zinc-500 lg:flex">
            {SOCIAL.map((s) => (
              <a key={s.label} href={s.href} target="_blank" rel="noopener noreferrer" aria-label={s.label} title={s.label} className="hover:text-purple-800">
                <SocialIcon path={s.path} />
              </a>
            ))}
          </div>
          <form action="/search" className="hidden items-center md:flex">
            <input
              type="search" name="q" placeholder="Search…" aria-label="Search"
              className="w-24 rounded-full border border-zinc-300 px-3 py-1 text-xs outline-none transition-[width] focus:w-44 focus:border-purple-700"
            />
          </form>
          <a href="https://rzp.io/rzp/5bOM6U7A" target="_blank" rel="noopener noreferrer" className="inline-flex items-center justify-center whitespace-nowrap rounded-full bg-purple-800 px-3 py-1.5 text-xs font-semibold text-white hover:bg-purple-700">
            Support Us
          </a>
        </div>
      </div>
      <nav className="relative bg-purple-950">
        <div className="mx-auto hidden max-w-[1600px] justify-center gap-1 px-3 sm:px-5 md:flex">
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
        {/* one row per top-level item; sub-items stay folded until tapped */}
        <details className="group/menu md:hidden">
          <summary className="flex min-h-12 cursor-pointer list-none items-center gap-2 px-4 text-sm font-medium text-purple-100">
            <span className="text-base leading-none">☰</span> Menu
          </summary>
          <div className="border-t border-purple-900">
            {NAV.map((item) =>
              item.children ? (
                <details key={item.label} className="border-b border-purple-900/60">
                  <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between px-4 text-sm font-medium text-purple-100">
                    {item.label}
                    <span className="text-[10px]">▾</span>
                  </summary>
                  <div className="bg-purple-900/40">
                    {item.children.map((c) => (
                      <Link key={c.href} href={c.href} className="flex min-h-11 items-center px-6 text-sm text-purple-200 hover:text-white">
                        {c.label}
                      </Link>
                    ))}
                  </div>
                </details>
              ) : item.external ? (
                <a
                  key={item.label}
                  href={item.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex min-h-12 items-center border-b border-purple-900/60 px-4 text-sm font-medium text-purple-100"
                >
                  {item.label}
                </a>
              ) : (
                <Link
                  key={item.label}
                  href={item.href}
                  className="flex min-h-12 items-center border-b border-purple-900/60 px-4 text-sm font-medium text-purple-100"
                >
                  {item.label}
                </Link>
              )
            )}
          </div>
        </details>
      </nav>
    </header>
  );
}
