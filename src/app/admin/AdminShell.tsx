"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import Image from "next/image";
import type { Tab } from "./ui";

const iconProps = { "aria-hidden": true, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.7, strokeLinecap: "round", strokeLinejoin: "round" } as const;

function NavIcon({ tab, className = "h-[22px] w-[22px]" }: { tab: Tab; className?: string }) {
  if (tab === "overview") return <svg {...iconProps} className={className}><path d="M3.5 11.2L12 4l8.5 7.2V19a1.5 1.5 0 01-1.5 1.5h-4v-5.5h-6v5.5H5A1.5 1.5 0 013.5 19z" /></svg>;
  if (tab === "articles") return <svg {...iconProps} className={className}><rect x="4.5" y="3.5" width="15" height="17" rx="2.5" /><path d="M8.5 8h7M8.5 12h7M8.5 16h4" /></svg>;
  if (tab === "new") return <svg {...iconProps} className={className}><circle cx="12" cy="12" r="8.5" /><path d="M12 8v8M8 12h8" /></svg>;
  return <svg {...iconProps} className={className}><circle cx="9" cy="8.5" r="3.2" /><path d="M3 20c0-3.3 2.7-5.5 6-5.5s6 2.2 6 5.5M16 5.6a3.2 3.2 0 010 5.8M18 14.8c1.8.7 3 2.4 3 5.2" /></svg>;
}

const items: { key: Tab; label: string }[] = [{ key: "overview", label: "Overview" }, { key: "articles", label: "Articles" }, { key: "new", label: "New article" }, { key: "authors", label: "Authors" }];

function UserMenu({ username, onLogout }: { username: string; onLogout: () => void }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const close = (event: MouseEvent | KeyboardEvent) => { if (event instanceof KeyboardEvent ? event.key === "Escape" : !ref.current?.contains(event.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", close);
    return () => { document.removeEventListener("mousedown", close); document.removeEventListener("keydown", close); };
  }, [open]);
  return <div ref={ref} className="relative">
    <button type="button" aria-haspopup="menu" aria-expanded={open} onClick={() => setOpen((current) => !current)} className="flex min-h-11 items-center gap-2 rounded-xl px-1.5 text-sm font-semibold text-slate-800 transition hover:bg-slate-50 sm:pr-2.5">
      <span className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-200 text-slate-400"><svg {...iconProps} strokeWidth={1.8} className="h-5 w-5"><circle cx="12" cy="8.5" r="3.6" /><path d="M4.5 20c.6-3.6 3.6-5.5 7.5-5.5s6.9 1.9 7.5 5.5" /></svg></span>
      <span className="hidden max-w-32 truncate sm:block">{username}</span>
      <svg {...iconProps} strokeWidth={2} className={`hidden h-4 w-4 text-slate-500 transition sm:block ${open ? "rotate-180" : ""}`}><path d="M6 9l6 6 6-6" /></svg>
    </button>
    {open && <div role="menu" className="absolute right-0 top-full z-30 mt-2 w-56 overflow-hidden rounded-xl border border-slate-200 bg-white p-1.5 shadow-xl">
      <p className="px-3 py-2 text-xs text-slate-500">Signed in as<span className="mt-0.5 block truncate text-sm font-semibold text-slate-900">{username}</span></p>
      <a role="menuitem" href="/" target="_blank" rel="noopener noreferrer" className="block rounded-lg px-3 py-2.5 text-sm font-medium text-slate-700 hover:bg-violet-50 hover:text-violet-800">View website</a>
      <button type="button" role="menuitem" onClick={onLogout} className="block w-full rounded-lg px-3 py-2.5 text-left text-sm font-medium text-slate-700 hover:bg-violet-50 hover:text-violet-800">Log out</button>
    </div>}
  </div>;
}

function SearchBar({ onSearch }: { onSearch: (query: string) => void }) {
  const [query, setQuery] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    const focusOnShortcut = (event: KeyboardEvent) => { if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") { event.preventDefault(); inputRef.current?.focus(); } };
    document.addEventListener("keydown", focusOnShortcut);
    return () => document.removeEventListener("keydown", focusOnShortcut);
  }, []);
  function submit(event: FormEvent) { event.preventDefault(); onSearch(query.trim()); inputRef.current?.blur(); }
  return <form role="search" onSubmit={submit} className="relative hidden min-w-0 max-w-[480px] flex-1 sm:block">
    <svg {...iconProps} className="pointer-events-none absolute left-3.5 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-slate-400"><circle cx="11" cy="11" r="6.5" /><path d="M20 20l-4-4" /></svg>
    <input ref={inputRef} type="search" aria-label="Search articles" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search articles…" className="block min-h-11 w-full rounded-xl border border-slate-200 bg-white pl-10 pr-16 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus-visible:border-violet-500 focus-visible:ring-4 focus-visible:ring-violet-100 [&::-webkit-search-cancel-button]:hidden" />
    <kbd aria-hidden className="pill pointer-events-none absolute right-3 top-1/2 hidden -translate-y-1/2 rounded-md border border-slate-200 bg-slate-50 px-2 py-1.5 text-[11px] font-semibold text-slate-500 md:block">⌘ K</kbd>
  </form>;
}

export default function AdminShell({ children, tab, setTab, username, onLogout, onSearch }: { children: React.ReactNode; tab: Tab; setTab: (tab: Tab) => void; username: string; onLogout: () => void; onSearch: (query: string) => void }) {
  const activeTab = tab === "edit" ? "articles" : tab;
  return <div className="fixed inset-0 z-[100] flex bg-[#f7f6fc] text-slate-900">
    <aside className="relative z-30 hidden w-64 shrink-0 flex-col overflow-y-auto bg-white shadow-[10px_0_32px_-14px_rgba(76,29,149,0.3)] lg:flex">
      <div className="flex h-[68px] shrink-0 items-center border-b border-slate-200/70 px-6"><Image src="/logo.png" alt="Islamonlive" width={132} height={36} priority className="h-9 w-auto object-contain" /></div>
      <nav aria-label="Admin navigation" className="space-y-3 p-4">
        {items.map((item) => {
          const active = activeTab === item.key;
          return <button key={item.key} type="button" aria-current={active ? "page" : undefined} onClick={() => setTab(item.key)} className={`flex min-h-14 w-full items-center gap-3.5 rounded-2xl border p-2 pr-4 text-left text-[15px] font-semibold transition ${active ? "border-transparent bg-[linear-gradient(90deg,#6d28d9,#8b5cf6)] text-white shadow-[0_14px_24px_-12px_rgba(109,40,217,0.8)]" : "border-violet-100 bg-white text-[#12093a] shadow-[0_6px_16px_-8px_rgba(76,29,149,0.28)] hover:-translate-y-px hover:border-violet-200 hover:shadow-[0_10px_20px_-8px_rgba(76,29,149,0.34)]"}`}>
            <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${active ? "bg-white/20 text-white" : "bg-violet-50 text-[#1c1147]"}`}><NavIcon tab={item.key} /></span>
            <span className="min-w-0 flex-1 truncate">{item.label}</span>
            <svg {...iconProps} strokeWidth={2} className={`h-4 w-4 shrink-0 ${active ? "text-white/80" : "text-slate-400"}`}><path d="M9 6l6 6-6 6" /></svg>
          </button>;
        })}
      </nav>
      <div className="mt-auto space-y-3 p-4">
        <div className="rounded-2xl bg-[linear-gradient(135deg,#f1ecff,#e9e2ff)] px-4 py-5"><Image src="/logo.png" alt="" width={132} height={36} className="h-9 w-auto object-contain" /><p className="mt-2 text-[11px] text-slate-500">Knowledge · Community · Impact</p></div>
        <div className="rounded-2xl border border-violet-100 bg-[#faf8ff] p-4">
          <span className="flex h-9 w-9 items-center justify-center rounded-full bg-violet-100 text-violet-600"><svg {...iconProps} strokeWidth={1.8} className="h-5 w-5"><path d="M4 18.5L3 8l5 4 4-7 4 7 5-4-1 10.5z" /></svg></span>
          <div className="mt-3 flex items-end justify-between gap-3"><p className="text-sm font-bold leading-snug text-[#1c1147]">Create impactful content for a better tomorrow.</p>
            <button type="button" aria-label="Write a new article" onClick={() => setTab("new")} className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[linear-gradient(135deg,#7c3aed,#6d28d9)] text-white shadow-[0_8px_16px_-6px_rgba(109,40,217,0.8)] transition hover:brightness-110"><svg {...iconProps} strokeWidth={2} className="h-[18px] w-[18px]"><path d="M5 12h14M13 6l6 6-6 6" /></svg></button></div>
        </div>
      </div>
    </aside>

    <div className="flex min-w-0 flex-1 flex-col">
      <header className="z-20 flex h-[60px] shrink-0 items-center gap-3 border-b border-slate-200/70 bg-white px-4 sm:h-[68px] sm:gap-4 sm:px-6 lg:px-7">
        <Image src="/logo.png" alt="Islamonlive" width={132} height={36} priority className="h-8 w-auto object-contain sm:h-9 lg:hidden" />
        <SearchBar onSearch={onSearch} />
        <div className="ml-auto flex items-center gap-1.5 sm:gap-3">
          <UserMenu username={username} onLogout={onLogout} />
          <button type="button" onClick={onLogout} className="flex min-h-11 items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-800 transition hover:bg-slate-50 sm:px-4"><svg {...iconProps} className="h-[18px] w-[18px]"><path d="M14 4h3.5A2.5 2.5 0 0120 6.5v11a2.5 2.5 0 01-2.5 2.5H14M10 16.5L14.5 12 10 7.5M14.5 12H4" /></svg>Log out</button>
        </div>
      </header>
      <main className="min-h-0 flex-1 overflow-y-auto">
        <div className="mx-auto max-w-[1400px] p-4 pb-[calc(5.5rem+env(safe-area-inset-bottom))] sm:p-6 sm:pb-[calc(5.5rem+env(safe-area-inset-bottom))] lg:p-7 lg:pb-7">{children}</div>
      </main>
    </div>

    <nav aria-label="Admin navigation" className="fixed inset-x-0 bottom-0 z-50 grid grid-cols-4 border-t border-slate-200 bg-white/95 pb-[env(safe-area-inset-bottom)] shadow-[0_-4px_16px_rgba(15,23,42,0.08)] backdrop-blur lg:hidden">
      {items.map((item) => <button key={item.key} type="button" aria-current={activeTab === item.key ? "page" : undefined} onClick={() => setTab(item.key)} className={`flex min-h-16 flex-col items-center justify-center gap-0.5 px-1 text-[11px] font-semibold transition ${activeTab === item.key ? "text-violet-700" : "text-slate-500"}`}><span className="flex h-6 items-center justify-center"><NavIcon tab={item.key} className="h-5 w-5" /></span><span>{item.key === "new" ? "New" : item.label}</span><span className={`mt-0.5 block h-1 w-8 rounded-full ${activeTab === item.key ? "bg-violet-700" : "bg-transparent"}`} /></button>)}
    </nav>
  </div>;
}
