"use client";

import { Suspense, useState, type ReactNode } from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  clearRecent,
  clearSaved,
  removeRecent,
  removeSaved,
  setNote,
  useRecent,
  useSaved,
  type RecentItem,
  type SavedItem,
} from "@/lib/reader";
import ConfirmDialog from "@/components/ConfirmDialog";

/* The reader's library: the posts they bookmarked and the ones they were in
   the middle of. Both live in localStorage, so this page renders empty on the
   server and fills in after mount — see lib/reader.ts.

   Two tabs behind one segmented control, and the tab is in the URL
   (?tab=recent) so the drawer's "Continue reading" row lands on the right one
   and a reload keeps it. */

type TabKey = "saved" | "recent";

function BookmarkIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden className={className}>
      <path d="M6 4.5h12a1 1 0 0 1 1 1v14.2a.5.5 0 0 1-.77.42L12 16.3l-6.23 3.82A.5.5 0 0 1 5 19.7V5.5a1 1 0 0 1 1-1Z" />
    </svg>
  );
}

function ClockIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden className={className}>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 7.5V12l3 2" />
    </svg>
  );
}

function Empty({ icon, title, hint }: { icon: ReactNode; title: string; hint: string }) {
  return (
    <div className="rounded-2xl border border-dashed border-zinc-300 bg-white/60 px-6 py-12 text-center">
      <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-purple-50 text-[#693FE2]">{icon}</span>
      <p className="mt-4 text-[15px] font-bold text-zinc-800">{title}</p>
      <p className="mx-auto mt-1 max-w-xs text-sm text-zinc-500">{hint}</p>
      <Link href="/" className="mt-5 inline-flex min-h-11 items-center rounded-full bg-[#693FE2] px-5 text-sm font-semibold text-white hover:bg-[#5a34c7]">
        Browse articles
      </Link>
    </div>
  );
}

/* one row for both lists: square thumb on the left, title and a single
   meta line on the right, then a full-width strip for progress (recent) or
   the note (bookmarks). Remove is the small × in the corner on both. */
function Card({
  item,
  onRemove,
  children,
  progress,
}: {
  item: SavedItem | RecentItem;
  onRemove: () => void;
  children?: ReactNode;
  /** 0..1 — the recent list shows a bar and reopens the post at that place */
  progress?: number;
}) {
  // "#continue" tells ReadTracker on the post to scroll back to the saved place
  const resume = progress !== undefined && progress > 0.05 && progress < 0.98;
  const finished = progress !== undefined && progress >= 0.98;
  const href = resume ? `${item.href}#continue` : item.href;
  const pct = progress === undefined ? 0 : Math.round(Math.max(0.04, progress) * 100);
  return (
    <li className="relative rounded-2xl bg-white p-3 shadow-[0_1px_2px_rgba(0,0,0,0.06),0_0_0_1px_rgba(0,0,0,0.04)] transition hover:shadow-md">
      <Link href={href} className="group flex items-start gap-3">
        <span className="relative h-20 w-20 shrink-0 overflow-hidden rounded-xl bg-zinc-100">
          {item.img && <Image src={item.img} alt="" fill sizes="80px" className="object-cover transition duration-500 group-hover:scale-105" />}
        </span>
        <span className="min-w-0 flex-1 pr-7">
          <span className="line-clamp-2 block text-[15px] font-bold leading-snug text-zinc-900 [overflow-wrap:anywhere] group-hover:text-[#31094C]">{item.title}</span>
          <span className="mt-1.5 flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-[11px] text-zinc-500">
            {item.category && <span className="pill font-bold uppercase tracking-wide text-[#693FE2]">{item.category}</span>}
            {item.category && <span aria-hidden>·</span>}
            <span className="pill">{item.date}</span>
          </span>
        </span>
      </Link>
      <button
        type="button"
        onClick={onRemove}
        aria-label={`Remove ${item.title}`}
        className="absolute right-1.5 top-1.5 flex h-8 w-8 touch-manipulation items-center justify-center rounded-full text-zinc-400 transition hover:bg-red-50 hover:text-red-600 active:bg-red-50"
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden className="h-4 w-4">
          <path d="M6 6l12 12M18 6 6 18" />
        </svg>
      </button>

      {progress !== undefined && (
        <div className="mt-3 flex items-center gap-3">
          <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-zinc-200">
            <span className={`block h-full rounded-full ${finished ? "bg-emerald-500" : "bg-[#693FE2]"}`} style={{ width: `${pct}%` }} />
          </span>
          <span className="pill w-10 shrink-0 text-right text-[11px] font-semibold text-zinc-500">
            {finished ? "Done" : progress > 0.05 ? `${Math.round(progress * 100)}%` : "New"}
          </span>
          <Link
            href={href}
            className={`pill inline-flex min-h-8 shrink-0 items-center rounded-full px-3.5 text-xs font-semibold transition ${
              resume ? "bg-[#693FE2] text-white hover:bg-[#5a34c7]" : "bg-zinc-100 text-zinc-700 hover:bg-zinc-200"
            }`}
          >
            {resume ? "Resume" : finished ? "Read again" : "Open"}
          </Link>
        </div>
      )}
      {children}
    </li>
  );
}

function NoteEditor({ item }: { item: SavedItem }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(item.note ?? "");

  if (!editing) {
    return (
      <button
        type="button"
        onClick={() => { setDraft(item.note ?? ""); setEditing(true); }}
        className="mt-2.5 flex min-h-9 w-full items-center gap-2 rounded-xl bg-zinc-50 px-3 text-left text-xs transition hover:bg-purple-50"
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden className="h-3.5 w-3.5 shrink-0 text-zinc-400">
          <path d="M4 20h4l10.5-10.5a2 2 0 0 0 0-2.8l-1.2-1.2a2 2 0 0 0-2.8 0L4 16z" />
        </svg>
        {item.note ? <span className="text-zinc-700">{item.note}</span> : <span className="text-zinc-400">Add a note…</span>}
      </button>
    );
  }

  return (
    <div className="mt-2.5">
      <textarea
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        rows={2}
        autoFocus
        placeholder="Why you saved this…"
        className="w-full rounded-xl border border-purple-200 p-2.5 text-sm outline-none focus-visible:border-[#693FE2]"
      />
      <div className="mt-1 flex justify-end gap-2">
        <button type="button" onClick={() => setEditing(false)} className="min-h-9 rounded-lg px-3 text-xs font-semibold text-zinc-500 hover:text-zinc-800">
          Cancel
        </button>
        <button
          type="button"
          onClick={() => { setNote(item.id, draft); setEditing(false); }}
          className="min-h-9 rounded-lg bg-[#693FE2] px-3 text-xs font-semibold text-white hover:bg-[#5a34c7]"
        >
          Save note
        </button>
      </div>
    </div>
  );
}

/* useSearchParams forces a Suspense boundary in the App Router — without one the
   build refuses to prerender the route */
export default function SavedPage() {
  return (
    <Suspense fallback={<div className="mx-auto h-64 max-w-2xl" />}>
      <Library />
    </Suspense>
  );
}

function Library() {
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const tab: TabKey = params.get("tab") === "recent" ? "recent" : "saved";
  const saved = useSaved();
  const recent = useRecent();
  const [confirmClear, setConfirmClear] = useState(false);
  const [q, setQ] = useState("");

  const select = (t: TabKey) => {
    setConfirmClear(false);
    setQ("");
    router.replace(t === "recent" ? `${pathname}?tab=recent` : pathname, { scroll: false });
  };

  const tabs: { key: TabKey; label: string; count: number; icon: ReactNode }[] = [
    { key: "saved", label: "Bookmarks", count: saved.length, icon: <BookmarkIcon className="h-4 w-4" /> },
    { key: "recent", label: "Continue reading", count: recent.length, icon: <ClockIcon className="h-4 w-4" /> },
  ];

  const all = tab === "saved" ? saved : recent;
  const clear = tab === "saved" ? clearSaved : clearRecent;
  // one box filters whichever list is showing — title, section and the note
  const needle = q.trim().toLowerCase();
  const match = (i: SavedItem | RecentItem) =>
    !needle ||
    i.title.toLowerCase().includes(needle) ||
    i.category.toLowerCase().includes(needle) ||
    ("note" in i && (i.note ?? "").toLowerCase().includes(needle));
  const list = all.filter(match);

  return (
    <div className="mx-auto max-w-2xl">
      <div className="mb-3 flex items-center justify-between gap-3 px-1">
        <h1 className="text-[26px] font-extrabold leading-none tracking-tight">My Library</h1>
        <Link
          href="/settings"
          aria-label="Settings"
          className="flex h-10 w-10 items-center justify-center rounded-full bg-white text-zinc-600 shadow-[0_1px_2px_rgba(0,0,0,0.06),0_0_0_1px_rgba(0,0,0,0.04)] transition hover:text-[#31094C]"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden className="h-5 w-5">
            <circle cx="12" cy="12" r="3.2" />
            <path d="M19.4 14a1.6 1.6 0 0 0 .32 1.77l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.6 1.6 0 0 0-1.77-.32 1.6 1.6 0 0 0-1 1.46V20a2 2 0 1 1-4 0v-.1a1.6 1.6 0 0 0-1.05-1.46 1.6 1.6 0 0 0-1.77.32l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.6 1.6 0 0 0 .32-1.77 1.6 1.6 0 0 0-1.46-1H4a2 2 0 1 1 0-4h.1a1.6 1.6 0 0 0 1.46-1.05 1.6 1.6 0 0 0-.32-1.77l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.6 1.6 0 0 0 1.77.32H10a1.6 1.6 0 0 0 1-1.46V4a2 2 0 1 1 4 0v.1a1.6 1.6 0 0 0 1 1.46 1.6 1.6 0 0 0 1.77-.32l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.6 1.6 0 0 0-.32 1.77V10a1.6 1.6 0 0 0 1.46 1H20a2 2 0 1 1 0 4h-.1a1.6 1.6 0 0 0-1.46 1Z" />
          </svg>
        </Link>
      </div>

      {/* search: filters whichever tab is open */}
      <label className="relative mb-3 block">
        <span className="sr-only">Search your library</span>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400">
          <circle cx="11" cy="11" r="7" />
          <path d="m21 21-4.35-4.35" />
        </svg>
        <input
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={tab === "saved" ? "Search bookmarks" : "Search reading history"}
          enterKeyHint="search"
          autoComplete="off"
          className="min-h-11 w-full rounded-2xl bg-white pl-10 pr-10 text-[15px] shadow-[0_1px_2px_rgba(0,0,0,0.06),0_0_0_1px_rgba(0,0,0,0.04)] outline-none transition placeholder:text-zinc-400 focus-visible:ring-2 focus-visible:ring-[#693FE2]"
        />
        {q && (
          <button
            type="button"
            onClick={() => setQ("")}
            aria-label="Clear search"
            className="absolute right-2 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden className="h-4 w-4">
              <path d="M6 6l12 12M18 6 6 18" />
            </svg>
          </button>
        )}
      </label>

      {/* segmented control */}
      <div role="tablist" aria-label="Library" className="mb-4 grid grid-cols-2 gap-1 rounded-2xl bg-zinc-200/70 p-1">
        {tabs.map((t) => {
          const on = tab === t.key;
          return (
            <button
              key={t.key}
              type="button"
              role="tab"
              aria-selected={on}
              onClick={() => select(t.key)}
              className={`flex min-h-11 touch-manipulation items-center justify-center gap-2 rounded-xl text-sm font-semibold transition ${
                on ? "bg-white text-[#31094C] shadow-sm" : "text-zinc-600 hover:text-zinc-900"
              }`}
            >
              {t.icon}
              <span>{t.key === "recent" ? <><span className="sm:hidden">Reading</span><span className="hidden sm:inline">Continue reading</span></> : t.label}</span>
              {t.count > 0 && (
                <span className={`pill rounded-full px-1.5 py-0.5 text-[11px] font-bold ${on ? "bg-[#693FE2] text-white" : "bg-zinc-300/80 text-zinc-700"}`}>{t.count}</span>
              )}
            </button>
          );
        })}
      </div>

      {list.length === 0 && all.length > 0 ? (
        <p className="rounded-2xl bg-white px-6 py-10 text-center text-sm text-zinc-500 shadow-[0_0_0_1px_rgba(0,0,0,0.04)]">
          Nothing matches “{q.trim()}”.
        </p>
      ) : list.length === 0 ? (
        tab === "saved" ? (
          <Empty
            icon={<BookmarkIcon className="h-7 w-7" />}
            title="No bookmarks yet"
            hint="Tap the bookmark icon at the top of any article and it will wait for you here."
          />
        ) : (
          <Empty
            icon={<ClockIcon className="h-7 w-7" />}
            title="Nothing in progress"
            hint="Articles you open show up here with how far you got, so you can pick one back up."
          />
        )
      ) : (
        <>
          <ul className="space-y-3">
            {tab === "saved"
              ? (list as SavedItem[]).map((s) => (
                  <Card key={s.id} item={s} onRemove={() => removeSaved(s.id)}>
                    <NoteEditor item={s} />
                  </Card>
                ))
              : (list as RecentItem[]).map((r) => <Card key={r.id} item={r} progress={r.progress ?? 0} onRemove={() => removeRecent(r.id)} />)}
          </ul>

          {/* wiping the list asks first — one stray tap on a text link used to
              empty it with no way back. Same dialog as Settings uses, so the
              destructive gesture always looks the same wherever it appears. */}
          {!needle && (
            <div className="mt-6 flex justify-center">
              <button type="button" onClick={() => setConfirmClear(true)} className="min-h-10 text-xs font-semibold text-zinc-500 hover:text-red-600">
                {tab === "saved" ? "Clear all bookmarks" : "Clear reading history"}
              </button>
            </div>
          )}

          <ConfirmDialog
            open={confirmClear}
            title={tab === "saved" ? "Clear all bookmarks?" : "Clear reading history?"}
            body={
              tab === "saved"
                ? `All ${all.length} saved ${all.length === 1 ? "article" : "articles"} and any notes on them are removed from this device. This can't be undone.`
                : `Your reading history of ${all.length} ${all.length === 1 ? "article" : "articles"} is removed from this device, along with where you had got to in each. This can't be undone.`
            }
            confirmLabel="Clear"
            cancelLabel="Keep"
            destructive
            onConfirm={() => {
              clear();
              setConfirmClear(false);
            }}
            onCancel={() => setConfirmClear(false)}
          />
        </>
      )}
    </div>
  );
}
