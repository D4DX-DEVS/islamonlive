"use client";

import { Suspense, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
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

/* The reader's own two lists. Both live in localStorage, so this page renders
   empty on the server and fills in after mount — see lib/reader.ts. */

function Empty({ title, hint }: { title: string; hint: string }) {
  return (
    <div className="rounded-2xl border border-dashed border-zinc-300 p-10 text-center">
      <p className="text-[15px] font-semibold text-zinc-700">{title}</p>
      <p className="mt-1 text-sm text-zinc-500">{hint}</p>
      <Link href="/" className="mt-4 inline-flex min-h-11 items-center rounded-full bg-purple-800 px-5 text-sm font-semibold text-white hover:bg-purple-700">
        Browse articles
      </Link>
    </div>
  );
}

function Card({
  item,
  onRemove,
  children,
}: {
  item: SavedItem | RecentItem;
  onRemove: () => void;
  children?: React.ReactNode;
}) {
  return (
    <li className="rounded-xl border border-zinc-200/80 bg-white p-3 shadow-sm transition hover:border-purple-200 hover:shadow-md">
      <div className="flex gap-3">
        <Link href={item.href} className="group flex min-w-0 flex-1 gap-3">
          {item.img && (
            <span className="relative h-16 w-24 shrink-0 overflow-hidden rounded-lg bg-zinc-100">
              <Image src={item.img} alt="" fill sizes="96px" className="object-cover transition duration-500 group-hover:scale-105" />
            </span>
          )}
          <span className="min-w-0">
            {item.category && <span className="pill mb-1 inline-block rounded bg-purple-100 px-1.5 py-0.5 text-[10px] font-bold uppercase text-purple-800">{item.category}</span>}
            <span className="line-clamp-2 block text-[15px] font-bold leading-snug text-zinc-900 group-hover:text-purple-800">{item.title}</span>
            <span className="mt-0.5 block text-xs text-zinc-500">{item.date}</span>
          </span>
        </Link>
        <button
          type="button"
          onClick={onRemove}
          aria-label={`Remove ${item.title}`}
          className="flex h-9 w-9 shrink-0 items-center justify-center self-start rounded-full text-zinc-400 transition hover:bg-red-50 hover:text-red-600"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden className="h-4 w-4">
            <path d="M6 6l12 12M18 6 6 18" />
          </svg>
        </button>
      </div>
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
        className="mt-2 block w-full rounded-lg bg-zinc-50 px-3 py-2 text-left text-xs transition hover:bg-purple-50"
      >
        {item.note ? <span className="text-zinc-700">{item.note}</span> : <span className="text-zinc-400">Add a note…</span>}
      </button>
    );
  }

  return (
    <div className="mt-2">
      <textarea
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        rows={2}
        autoFocus
        placeholder="Why you saved this…"
        className="w-full rounded-lg border border-purple-200 p-2 text-sm outline-none focus-visible:border-purple-500"
      />
      <div className="mt-1 flex justify-end gap-2">
        <button type="button" onClick={() => setEditing(false)} className="min-h-9 rounded-lg px-3 text-xs font-semibold text-zinc-500 hover:text-zinc-800">
          Cancel
        </button>
        <button
          type="button"
          onClick={() => { setNote(item.id, draft); setEditing(false); }}
          className="min-h-9 rounded-lg bg-purple-800 px-3 text-xs font-semibold text-white hover:bg-purple-700"
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
      <SavedLists />
    </Suspense>
  );
}

function SavedLists() {
  const params = useSearchParams();
  const [tab, setTab] = useState(params.get("tab") === "recent" ? 1 : 0);
  const saved = useSaved();
  const recent = useRecent();

  const tabs = [
    { label: "Saved", count: saved.length },
    { label: "Continue reading", count: recent.length },
  ];

  return (
    <div className="mx-auto max-w-2xl">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3 border-l-4 border-purple-800 pl-3">
        <h1 className="text-2xl font-extrabold">My reading</h1>
        <Link href="/settings" className="text-sm font-medium text-purple-800 hover:underline">Settings →</Link>
      </div>

      <div className="mb-5 flex gap-2">
        {tabs.map((t, n) => (
          <button
            key={t.label}
            type="button"
            onClick={() => setTab(n)}
            aria-pressed={tab === n}
            className={`min-h-11 rounded-full px-4 text-sm font-semibold transition ${
              tab === n ? "bg-purple-800 text-white" : "bg-white text-zinc-600 ring-1 ring-zinc-200 hover:bg-purple-50"
            }`}
          >
            {t.label}
            {t.count > 0 && <span className="pill ml-1.5 opacity-70">{t.count}</span>}
          </button>
        ))}
      </div>

      {tab === 0 ? (
        saved.length === 0 ? (
          <Empty title="Nothing saved yet" hint="Tap the bookmark on any article to keep it here." />
        ) : (
          <>
            <ul className="space-y-3">
              {saved.map((s) => (
                <Card key={s.id} item={s} onRemove={() => removeSaved(s.id)}>
                  <NoteEditor item={s} />
                </Card>
              ))}
            </ul>
            <button type="button" onClick={clearSaved} className="mt-5 min-h-11 text-sm font-semibold text-red-600 hover:underline">
              Clear all saved
            </button>
          </>
        )
      ) : recent.length === 0 ? (
        <Empty title="No reading history" hint="Articles you open show up here so you can pick one back up." />
      ) : (
        <>
          <ul className="space-y-3">
            {recent.map((r) => (
              <Card key={r.id} item={r} onRemove={() => removeRecent(r.id)} />
            ))}
          </ul>
          <button type="button" onClick={clearRecent} className="mt-5 min-h-11 text-sm font-semibold text-red-600 hover:underline">
            Clear history
          </button>
        </>
      )}
    </div>
  );
}
