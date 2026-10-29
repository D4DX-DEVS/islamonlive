"use client";

import { useEffect, useState } from "react";
import { Select } from "../Select";
import { Icon, type IconName } from "../icons";
import { cardClass, initials, Skeleton, type Author } from "../ui";

/* The Activity screen: who added, edited, published or trashed an article,
   uploaded a file, or changed an account or the homepage, newest first.
   Administrators only. */

type Entry = { id: string; at: string; actor: { id: number; name: string; role: string }; action: string; label: string; target: { type: string; id: number | string | null; title: string; link: string | null } };
type Page = { data: Entry[]; page: number; pageSize: number; total: number; totalPages: number };
type Query = { page: number; pageSize: number; actor: string; action: string };

const ACTIONS = [
  { value: "all", label: "All activity" },
  { value: "post", label: "Articles (any change)" },
  { value: "post.publish", label: "Articles published" },
  { value: "post.create", label: "Drafts created" },
  { value: "post.update", label: "Articles edited" },
  { value: "post.trash", label: "Articles trashed" },
  { value: "media", label: "Uploads and deletions" },
  { value: "user", label: "Account changes" },
  { value: "layout", label: "Homepage layout" },
  { value: "analytics", label: "Analytics data deleted" },
];
const SIZES = [10, 20, 50, 100];
const time = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });

function iconFor(action: string): IconName {
  if (action.startsWith("media")) return "image";
  if (action.startsWith("user")) return "users";
  if (action.startsWith("layout")) return "table";
  if (action.startsWith("analytics")) return "trash";
  if (action === "post.publish") return "send";
  if (action === "post.trash") return "trash";
  return "doc";
}

function readUrl(): Query {
  const params = new URLSearchParams(typeof window === "undefined" ? "" : window.location.search);
  const pageSize = Number(params.get("pageSize"));
  return { page: Math.max(1, Number(params.get("page")) || 1), pageSize: SIZES.includes(pageSize) ? pageSize : 20, actor: params.get("actor") || "all", action: params.get("action") || "all" };
}

export default function ActivityPage({ staff }: { staff: Author[] }) {
  const [query, setQuery] = useState<Query>(readUrl);
  const [result, setResult] = useState<Page | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [reload, setReload] = useState(0);

  useEffect(() => {
    // the filters live in the URL, so a refresh or a shared link shows the same view
    const url = new URL(window.location.href);
    for (const [key, value] of Object.entries(query)) {
      const isDefault = (key === "page" && value === 1) || (key === "pageSize" && value === 20) || value === "all";
      if (isDefault) url.searchParams.delete(key); else url.searchParams.set(key, String(value));
    }
    window.history.replaceState(window.history.state, "", url);
    let cancelled = false;
    const params = new URLSearchParams({ page: String(query.page), pageSize: String(query.pageSize) });
    if (query.actor !== "all") params.set("actor", query.actor);
    if (query.action !== "all") params.set("action", query.action);
    void fetch(`/api/admin/activity/?${params}`, { cache: "no-store" }).then(async (response) => {
      const body = await response.json().catch(() => ({}));
      if (cancelled) return;
      if (!response.ok) setError(body.error || "The activity service returned an error."); else { setError(""); setResult(body); }
    }).catch(() => { if (!cancelled) setError("Could not reach the activity service."); }).finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [query, reload]);

  const apply = (patch: Partial<Query>) => { setLoading(true); setQuery((current) => ({ ...current, page: 1, ...patch })); };
  const people = staff.filter((person) => person.roles?.some((role) => role === "editor" || role === "administrator"));
  const filtered = query.actor !== "all" || query.action !== "all";

  return <div className="space-y-5 sm:space-y-6">
    <div>
      <p className="pill text-xs font-bold uppercase tracking-[0.18em] text-violet-700">Activity</p>
      <h1 className="mt-2 text-2xl font-extrabold text-[#12093a] sm:text-3xl">Who did what</h1>
      <p className="mt-1.5 text-sm text-slate-500">Every article saved, published or trashed, every upload, and every account or homepage change made in this workspace.</p>
    </div>

    <section className={cardClass} aria-label="Activity log">
      <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto]">
        <Select label="Filter by team member" value={query.actor} onChange={(actor) => apply({ actor })} options={[{ value: "all", label: "Everyone" }, ...people.map((p) => ({ value: String(p.id), label: p.name }))]} />
        <Select label="Filter by action" value={query.action} onChange={(action) => apply({ action })} options={ACTIONS} />
        {filtered && <button type="button" onClick={() => apply({ actor: "all", action: "all" })} className="min-h-11 rounded-xl px-4 text-sm font-semibold text-violet-700 hover:bg-violet-50">Clear filters</button>}
      </div>

      <div aria-busy={loading} className={`mt-4 transition-opacity ${loading && result ? "opacity-60" : ""}`}>
        {error ? <div role="alert" className="rounded-xl bg-red-50 px-4 py-6 text-center text-sm text-red-700">{error}<button type="button" onClick={() => { setLoading(true); setReload((n) => n + 1); }} className="ml-3 font-semibold text-violet-700 hover:underline">Retry</button></div>
          : !result ? <div className="space-y-3">{Array.from({ length: query.pageSize > 10 ? 10 : query.pageSize }, (_, i) => <div key={i} className="flex items-center gap-3"><Skeleton className="h-9 w-9 rounded-full" /><div className="flex-1 space-y-2"><Skeleton className="h-4 w-2/3" /><Skeleton className="h-3 w-1/3" /></div></div>)}</div>
            : result.data.length === 0 ? <div className="rounded-xl border border-dashed border-slate-200 px-4 py-10 text-center text-sm text-slate-500">{filtered ? "Nothing matches these filters." : "Nothing recorded yet. Actions appear here as the team works."}{filtered && <button type="button" onClick={() => apply({ actor: "all", action: "all" })} className="ml-2 font-semibold text-violet-700 hover:underline">Clear filters</button>}</div>
              : <ol className="divide-y divide-slate-100">{result.data.map((entry) => <li key={entry.id} className="flex items-start gap-3 py-3">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-violet-100 text-xs font-bold text-violet-700" aria-hidden>{initials(entry.actor.name)}</span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm text-slate-700"><span className="font-semibold text-[#12093a]">{entry.actor.name}</span> <span className="text-xs text-slate-400">({entry.actor.role})</span> {entry.label}</p>
                  {entry.target.title && <p className="mt-0.5 flex min-w-0 items-center gap-1.5 text-sm"><Icon name={iconFor(entry.action)} className="h-4 w-4 shrink-0 text-slate-400" />{entry.target.link ? <a href={entry.target.link} target="_blank" rel="noopener noreferrer" className="truncate font-medium text-violet-800 hover:underline">{entry.target.title}</a> : <span className="truncate font-medium text-slate-800">{entry.target.title}</span>}</p>}
                </div>
                <time dateTime={entry.at} className="shrink-0 text-right text-xs text-slate-500">{time.format(new Date(entry.at))}</time>
              </li>)}</ol>}
      </div>

      {result && result.total > 0 && <div className="mt-4 flex flex-col gap-3 border-t border-slate-100 pt-4 text-sm text-slate-600 sm:flex-row sm:items-center sm:justify-between">
        <span>{result.total.toLocaleString()} results · Page {result.page} of {Math.max(1, result.totalPages)}</span>
        <div className="flex items-center gap-2">
          <span className="w-36"><Select label="Rows per page" value={String(query.pageSize)} onChange={(size) => apply({ pageSize: Number(size) })} options={SIZES.map((n) => ({ value: String(n), label: `${n} per page` }))} /></span>
          <button type="button" aria-label="Previous page" disabled={query.page <= 1 || loading} onClick={() => { setLoading(true); setQuery((q) => ({ ...q, page: q.page - 1 })); }} className="flex h-11 w-11 items-center justify-center rounded-xl border border-slate-200 disabled:opacity-40"><Icon name="chevronLeft" /></button>
          <button type="button" aria-label="Next page" disabled={query.page >= result.totalPages || loading} onClick={() => { setLoading(true); setQuery((q) => ({ ...q, page: q.page + 1 })); }} className="flex h-11 w-11 items-center justify-center rounded-xl border border-slate-200 disabled:opacity-40"><Icon name="chevronRight" /></button>
        </div>
      </div>}
    </section>
  </div>;
}
