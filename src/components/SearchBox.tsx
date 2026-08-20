"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

interface Suggestion {
  title: string;
  path: string;
}

// tappable starter topics, GPT prompt-chip style
const CHIPS = ["ഖുർആൻ", "റമദാൻ", "ഫലസ്തീൻ", "ഹജ്ജ്", "ചരിത്രം", "പ്രവാചകൻ"];

/* GPT-style search: big rounded field, arrow submit, live type-ahead dropdown */
export default function SearchBox({ initialQ = "" }: { initialQ?: string }) {
  const router = useRouter();
  const [q, setQ] = useState(initialQ);
  const [sugs, setSugs] = useState<Suggestion[]>([]);
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);

  // debounced type-ahead
  useEffect(() => {
    const t = q.trim();
    if (t.length < 2 || t === initialQ) {
      setSugs([]);
      setOpen(false);
      return;
    }
    const ctl = new AbortController();
    const id = setTimeout(async () => {
      try {
        const r = await fetch(`/api/suggest?q=${encodeURIComponent(t)}`, { signal: ctl.signal });
        const rows: Suggestion[] = await r.json();
        setSugs(rows);
        setOpen(true);
      } catch {
        /* aborted or offline — keep whatever is shown */
      }
    }, 300);
    return () => {
      clearTimeout(id);
      ctl.abort();
    };
  }, [q, initialQ]);

  // tap outside closes the dropdown
  useEffect(() => {
    const f = (e: MouseEvent) => {
      if (!box.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("click", f);
    return () => document.removeEventListener("click", f);
  }, []);

  const go = (query: string) => {
    setOpen(false);
    router.push(`/search?q=${encodeURIComponent(query)}`);
  };

  return (
    <div ref={box} className="relative mx-auto w-full max-w-2xl">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (q.trim()) go(q.trim());
        }}
        className="flex items-center gap-2 rounded-2xl border border-zinc-300 bg-white py-1.5 pl-4 pr-2 shadow-lg shadow-purple-900/5 transition focus-within:border-purple-600 focus-within:ring-2 focus-within:ring-purple-100"
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden className="h-4 w-4 shrink-0 text-zinc-400">
          <circle cx="11" cy="11" r="7" />
          <path d="m21 21-4.35-4.35" />
        </svg>
        <input
          type="search"
          enterKeyHint="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onFocus={() => sugs.length > 0 && setOpen(true)}
          placeholder="Search articles, topics, authors…"
          aria-label="Search"
          className="h-11 w-full bg-transparent text-[15px] outline-none placeholder:text-zinc-400"
        />
        <button
          aria-label="Search"
          disabled={!q.trim()}
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-purple-800 text-white transition hover:bg-purple-700 disabled:opacity-30"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden className="h-4 w-4">
            <path d="M12 19V5m-6 6 6-6 6 6" />
          </svg>
        </button>
      </form>

      {open && sugs.length > 0 && (
        <div className="absolute inset-x-0 top-full z-20 mt-2 overflow-hidden rounded-2xl border border-zinc-200 bg-white py-1 shadow-xl">
          {sugs.map((s) => (
            <button
              key={s.path}
              type="button"
              onClick={() => {
                setOpen(false);
                router.push(s.path);
              }}
              className="flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm text-zinc-800 hover:bg-purple-50"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden className="h-4 w-4 shrink-0 text-zinc-400">
                <path d="M7 3h7l5 5v13H7V3Zm7 0v5h5" />
              </svg>
              <span className="line-clamp-1" dangerouslySetInnerHTML={{ __html: s.title }} />
            </button>
          ))}
          <button
            type="button"
            onClick={() => go(q.trim())}
            className="flex w-full items-center gap-3 border-t border-zinc-100 px-4 py-2.5 text-left text-sm font-semibold text-purple-800 hover:bg-purple-50"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden className="h-4 w-4 shrink-0">
              <circle cx="11" cy="11" r="7" />
              <path d="m21 21-4.35-4.35" />
            </svg>
            Search “{q.trim()}” →
          </button>
        </div>
      )}

      {!q && (
        <div className="mt-4 flex flex-wrap justify-center gap-2">
          {CHIPS.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => go(c)}
              className="rounded-full border border-zinc-300 bg-white px-4 py-2 text-sm text-zinc-700 transition hover:border-purple-400 hover:bg-purple-50 hover:text-purple-900"
            >
              {c}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
