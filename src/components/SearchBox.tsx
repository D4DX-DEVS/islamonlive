"use client";

import { useEffect, useRef, useState, useTransition } from "react";
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
  const [loading, setLoading] = useState(false);
  // which row was tapped — the tap has to look acknowledged before the route
  // resolves, or on a slow phone the user taps again thinking it missed
  const [going, setGoing] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const box = useRef<HTMLDivElement>(null);

  // debounced type-ahead. Skips the query we are already navigating to, so
  // filling the field from a chip doesn't pop a dropdown over the outgoing page.
  useEffect(() => {
    const t = q.trim();
    if (t.length < 2 || t === initialQ || t === going) {
      setSugs([]);
      setOpen(false);
      setLoading(false);
      return;
    }
    const ctl = new AbortController();
    setLoading(true);
    const id = setTimeout(async () => {
      try {
        const r = await fetch(`/api/suggest?q=${encodeURIComponent(t)}`, { signal: ctl.signal });
        const rows: Suggestion[] = await r.json();
        setSugs(rows);
        setOpen(true);
        setLoading(false);
      } catch {
        /* aborted or offline — keep whatever is shown */
      }
    }, 300);
    return () => {
      clearTimeout(id);
      ctl.abort();
    };
  }, [q, initialQ, going]);

  // tap outside closes the dropdown
  useEffect(() => {
    const f = (e: MouseEvent) => {
      if (!box.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("click", f);
    return () => document.removeEventListener("click", f);
  }, []);

  /* Navigations run in a transition so `pending` can mark the tapped row at once.
     The dropdown deliberately stays up: closing it on tap makes the row vanish
     before the route resolves, which is exactly the "did that register?" moment
     the spinner is there to answer. It unmounts with the page, and a query tap
     closes it through the type-ahead effect below. */
  const push = (href: string, key: string) => {
    setGoing(key);
    startTransition(() => router.push(href));
  };
  // a chip/suggestion tap must land in the field too — an empty box under a
  // spinner reads as "the tap did nothing"
  const go = (query: string) => {
    setQ(query);
    push(`/search?q=${encodeURIComponent(query)}`, query);
  };

  // tied to the transition, not to `going`: `going` has no reset and would leave
  // the button spinning forever once the route settled
  const busy = pending;

  return (
    <div ref={box} className="relative mx-auto w-full max-w-2xl">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (q.trim()) go(q.trim());
        }}
        className="relative flex items-center gap-2 overflow-hidden rounded-2xl border border-zinc-300 bg-white py-1.5 pl-4 pr-2 shadow-lg shadow-purple-900/5 transition focus-within:border-purple-600 focus-within:ring-2 focus-within:ring-purple-100"
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
          disabled={!q.trim() || busy}
          className="flex h-9 w-9 shrink-0 touch-manipulation items-center justify-center rounded-xl bg-purple-800 text-white transition hover:bg-purple-700 active:scale-95 active:bg-purple-900 disabled:opacity-30"
        >
          {busy ? (
            <span aria-hidden className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />
          ) : (
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden className="h-4 w-4">
              <path d="M12 19V5m-6 6 6-6 6 6" />
            </svg>
          )}
        </button>
        {/* indeterminate bar: the only feedback while a suggestion request or a
            route change is in flight — a phone shows no hover state to lean on */}
        {(loading || busy) && (
          <span aria-hidden className="absolute inset-x-0 bottom-0 h-0.5 overflow-hidden bg-purple-100">
            <span className="block h-full w-1/3 animate-[searchbar_1s_linear_infinite] bg-purple-700" />
          </span>
        )}
      </form>

      {open && sugs.length > 0 && (
        <div className="absolute inset-x-0 top-full z-20 mt-2 overflow-hidden rounded-2xl border border-zinc-200 bg-white py-1 shadow-xl">
          {sugs.map((s) => (
            <button
              key={s.path}
              type="button"
              onClick={() => push(s.path, s.path)}
              className={`flex w-full touch-manipulation items-center gap-3 px-4 py-3 text-left text-sm text-zinc-800 transition-colors hover:bg-purple-50 active:bg-purple-100 ${
                busy && going === s.path ? "bg-purple-100" : ""
              }`}
            >
              {busy && going === s.path ? (
                <span aria-hidden className="h-4 w-4 shrink-0 animate-spin rounded-full border-2 border-purple-200 border-t-purple-700" />
              ) : (
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden className="h-4 w-4 shrink-0 text-zinc-400">
                  <path d="M7 3h7l5 5v13H7V3Zm7 0v5h5" />
                </svg>
              )}
              <span className="line-clamp-1" dangerouslySetInnerHTML={{ __html: s.title }} />
            </button>
          ))}
          <button
            type="button"
            onClick={() => go(q.trim())}
            className="flex w-full touch-manipulation items-center gap-3 border-t border-zinc-100 px-4 py-3 text-left text-sm font-semibold text-purple-800 transition-colors hover:bg-purple-50 active:bg-purple-100"
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
              disabled={busy}
              className={`touch-manipulation rounded-full border px-4 py-2 text-sm transition hover:border-purple-400 hover:bg-purple-50 hover:text-purple-900 active:scale-95 ${
                busy && going === c ? "border-purple-500 bg-purple-100 text-purple-900" : "border-zinc-300 bg-white text-zinc-700"
              }`}
            >
              {c}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
