"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import ConfirmDialog from "@/components/ConfirmDialog";
import Avatar from "./avatar";
import { Icon, type IconName } from "./icons";
import { cardClass, formatDay, inputClass, Skeleton, stripHtml, type Author, type Category } from "./ui";

const PER_PAGE = 10;

type Row = { id: number; date: string; modified?: string; status?: string; title: { rendered: string; raw?: string }; author?: number; categories?: number[]; link?: string };
type Page = { items: Row[]; total: number; totalPages: number };
type Stats = { total: number; publish: number; draft: number; trash: number; recent: { total: number; publish: number; draft: number } };
type Query = { page: number; search: string; author: string; category: string; status: string; days: string };

/** A table cell with a thin border on its left edge, so every column is outlined. */
const cell = "border-l border-slate-200 px-2.5 py-2 first:border-l-0";

const emptyQuery: Query = { page: 1, search: "", author: "", category: "", status: "any", days: "" };

const statusStyle: Record<string, { label: string; className: string }> = {
  publish: { label: "Published", className: "bg-emerald-50 text-emerald-700" },
  draft: { label: "Draft", className: "bg-slate-100 text-slate-600" },
  pending: { label: "Pending", className: "bg-sky-50 text-sky-700" },
  private: { label: "Private", className: "bg-amber-50 text-amber-700" },
  future: { label: "Scheduled", className: "bg-violet-50 text-violet-700" },
  trash: { label: "Trash", className: "bg-red-50 text-red-700" },
};

const statusOptions = [["any", "All statuses"], ["publish", "Published"], ["draft", "Draft"], ["pending", "Pending review"], ["future", "Scheduled"], ["private", "Private"], ["trash", "Trash"]];
const dateOptions = [["", "All dates"], ["7", "Last 7 days"], ["30", "Last 30 days"], ["90", "Last 90 days"], ["365", "Last 12 months"]];

async function fetchPage(query: Query): Promise<Page> {
  const params = new URLSearchParams({ page: String(query.page), search: query.search, status: query.status });
  if (query.author) params.set("author", query.author);
  if (query.category) params.set("category", query.category);
  if (query.days) params.set("days", query.days);
  const response = await fetch(`/api/admin/posts/?${params}`, { cache: "no-store" });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body.error || "Could not load articles");
  return { items: body.items || [], total: Number(body.total || 0), totalPages: Math.max(1, Number(body.totalPages || 1)) };
}

/** 1 … 4 5 6 … 20, always keeping the first and last page reachable. */
export function pageNumbers(current: number, last: number): (number | "…")[] {
  if (last <= 7) return Array.from({ length: last }, (_, index) => index + 1);
  if (current <= 4) return [1, 2, 3, 4, 5, "…", last];
  if (current >= last - 3) return [1, "…", last - 4, last - 3, last - 2, last - 1, last];
  return [1, "…", current - 1, current, current + 1, "…", last];
}

function rowTitle(post: Row): string { return stripHtml(post.title.rendered) || "(no title)"; }

function StatusChip({ status }: { status?: string }) {
  const style = statusStyle[status || "publish"] ?? { label: status || "—", className: "bg-slate-100 text-slate-600" };
  return <span className={`inline-flex rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${style.className}`}>{style.label}</span>;
}

function CategoryChip({ name }: { name: string }) {
  return <span className="break-words rounded-full bg-violet-50 px-2 py-0.5 text-[11px] font-medium leading-snug text-violet-700">{name}</span>;
}

export type MenuEntry = { label: string; icon: IconName; onSelect?: () => void; href?: string; danger?: boolean };

export function RowMenu({ title, entries, compact = false }: { title: string; entries: MenuEntry[]; compact?: boolean }) {
  const [position, setPosition] = useState<{ right: number; top?: number; bottom?: number } | null>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (!position) return;
    const close = () => setPosition(null);
    const onKey = (event: KeyboardEvent) => { if (event.key === "Escape") close(); };
    const onDown = (event: MouseEvent) => { const target = event.target as Element; if (!buttonRef.current?.contains(target) && !target.closest?.("[data-row-menu]")) close(); };
    window.addEventListener("resize", close);
    document.addEventListener("scroll", close, true);
    document.addEventListener("keydown", onKey);
    document.addEventListener("mousedown", onDown);
    return () => { window.removeEventListener("resize", close); document.removeEventListener("scroll", close, true); document.removeEventListener("keydown", onKey); document.removeEventListener("mousedown", onDown); };
  }, [position]);
  function toggle() {
    if (position) { setPosition(null); return; }
    const rect = buttonRef.current!.getBoundingClientRect();
    const right = window.innerWidth - rect.right;
    setPosition(rect.bottom + 190 > window.innerHeight ? { right, bottom: window.innerHeight - rect.top + 6 } : { right, top: rect.bottom + 6 });
  }
  const itemClass = (danger?: boolean) => `flex min-h-11 w-full items-center gap-3 rounded-lg px-3 text-left text-sm font-medium ${danger ? "text-red-700 hover:bg-red-50" : "text-slate-700 hover:bg-violet-50 hover:text-violet-800"}`;
  return <>
    <button ref={buttonRef} type="button" aria-haspopup="menu" aria-expanded={Boolean(position)} aria-label={`More actions for ${title}`} onClick={toggle} className={`flex items-center justify-center border border-slate-200 bg-white text-slate-700 transition hover:bg-slate-50 ${compact ? "h-8 w-8 rounded-lg" : "h-10 w-10 rounded-xl"}`}><Icon name="more" className={compact ? "h-4 w-4" : "h-[18px] w-[18px]"} /></button>
    {position && createPortal(<div data-row-menu role="menu" style={{ position: "fixed", ...position }} className="z-[150] w-56 rounded-xl border border-slate-200 bg-white p-1.5 shadow-xl">
      {entries.map((entry) => entry.href
        ? <a key={entry.label} role="menuitem" href={entry.href} target="_blank" rel="noopener noreferrer" onClick={() => setPosition(null)} className={itemClass()}><Icon name={entry.icon} className="h-[18px] w-[18px]" />{entry.label}</a>
        : <button key={entry.label} type="button" role="menuitem" onClick={() => { setPosition(null); entry.onSelect?.(); }} className={itemClass(entry.danger)}><Icon name={entry.icon} className="h-[18px] w-[18px]" />{entry.label}</button>)}
    </div>, document.body)}
  </>;
}

export function FilterSelect({ label, value, onChange, options, icon }: { label: string; value: string; onChange: (value: string) => void; options: string[][]; icon?: IconName }) {
  return <label className="relative block">
    <span className="sr-only">{label}</span>
    {icon && <Icon name={icon} className="pointer-events-none absolute left-3.5 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-slate-500" />}
    <select value={value} onChange={(event) => onChange(event.target.value)} className={`${inputClass} appearance-none pr-9 ${icon ? "pl-10" : ""}`}>{options.map(([optionValue, optionLabel]) => <option key={optionValue} value={optionValue}>{optionLabel}</option>)}</select>
    <Icon name="chevronDown" className="pointer-events-none absolute right-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" strokeWidth={2} />
  </label>;
}

export default function Articles({ initialSearch, initialStatus, initialAuthor = "", initialNotice = "", authors, categories, authorsLoading, onNew, onEdit }: { initialSearch: string; initialStatus: string; /** An author id to start filtered to. */ initialAuthor?: string; /** A message to show above the list, such as a warning from saving an article. */ initialNotice?: string; authors: Author[]; categories: Category[]; authorsLoading: boolean; onNew: () => void; onEdit: (id: number, publishOnOpen?: boolean) => void }) {
  const [query, setQuery] = useState<Query>({ ...emptyQuery, search: initialSearch, status: initialStatus, author: initialAuthor });
  const [searchInput, setSearchInput] = useState(initialSearch);
  const [items, setItems] = useState<Row[]>([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState(initialNotice);
  const [stats, setStats] = useState<Stats | null>(null);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [trashTarget, setTrashTarget] = useState<Row | null>(null);
  const request = useRef(0);

  /** Applies a page fetch unless a newer one has started since. */
  const show = useCallback((id: number, promise: Promise<Page>) => {
    promise.then((page) => { if (id === request.current) { setItems(page.items); setTotal(page.total); setTotalPages(page.totalPages); } })
      .catch((failure: unknown) => { if (id === request.current) setError(failure instanceof Error ? failure.message : "Could not reach the article service"); })
      .finally(() => { if (id === request.current) setLoading(false); });
  }, []);
  const loadStats = useCallback(() => {
    void fetch("/api/admin/posts/stats/", { cache: "no-store" }).then(async (response) => { const body = await response.json().catch(() => null); if (response.ok && body) setStats(body); }).catch(() => undefined);
  }, []);

  useEffect(() => {
    show(++request.current, fetchPage({ ...emptyQuery, search: initialSearch, status: initialStatus, author: initialAuthor }));
    loadStats();
    return () => { request.current += 1; };
  }, [initialSearch, initialStatus, initialAuthor, show, loadStats]);

  function run(next: Query) { setQuery(next); setLoading(true); setError(""); setNotice(""); show(++request.current, fetchPage(next)); }
  function apply(patch: Partial<Query>) { run({ ...query, page: 1, ...patch }); }
  function reset() { setSearchInput(""); run(emptyQuery); }

  async function duplicate(post: Row) {
    setBusyId(post.id); setError(""); setNotice("");
    try {
      const response = await fetch("/api/admin/posts/duplicate/", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: post.id }) });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.error || "Could not copy the article");
      onEdit(body.id);
    } catch (failure) { setError(failure instanceof Error ? failure.message : "Could not copy the article"); }
    finally { setBusyId(null); }
  }

  async function moveToTrash() {
    const post = trashTarget;
    if (!post) return;
    setTrashTarget(null); setBusyId(post.id); setError(""); setNotice("");
    try {
      const response = await fetch(`/api/admin/posts/?id=${post.id}`, { method: "DELETE" });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.error || "Could not move the article to the trash");
      run({ ...query, page: items.length === 1 && query.page > 1 ? query.page - 1 : query.page });
      setNotice(`“${rowTitle(post)}” was moved to the trash. You can restore it from WordPress.`);
      loadStats();
    } catch (failure) { setError(failure instanceof Error ? failure.message : "Could not move the article to the trash"); }
    finally { setBusyId(null); }
  }

  const authorOf = (id?: number) => authors.find((item) => item.id === id);
  const authorName = (id?: number) => (authorsLoading ? "…" : authorOf(id)?.name || "—");
  const categoriesOf = (post: Row) => (post.categories ?? []).flatMap((id) => { const match = categories.find((item) => item.id === id); return match ? [{ id, name: stripHtml(match.name) }] : []; });
  const filtered = Boolean(query.search || query.author || query.category || query.status !== "any" || query.days);

  function actions(post: Row, compact = false) {
    const button = compact ? "h-8 w-8 rounded-lg" : "h-10 w-10 rounded-xl";
    const icon = compact ? "h-4 w-4" : "h-[18px] w-[18px]";
    const status = post.status || "publish";
    const entries: MenuEntry[] = [];
    if (["draft", "pending", "private"].includes(status)) entries.push({ label: "Edit & publish", icon: "send", onSelect: () => onEdit(post.id, true) });
    if (status === "publish" && post.link) entries.push({ label: "View on site", icon: "external", href: new URL(post.link).pathname });
    if (status !== "trash") entries.push({ label: "Move to trash", icon: "trash", danger: true, onSelect: () => setTrashTarget(post) });
    return <div className={`flex items-center ${compact ? "gap-1.5" : "gap-2"}`}>
      <button type="button" aria-label={`Edit ${rowTitle(post)}`} title="Edit" disabled={busyId === post.id} onClick={() => onEdit(post.id)} className={`flex ${button} items-center justify-center border border-violet-200 bg-white text-violet-700 transition hover:bg-violet-50 disabled:opacity-50`}><Icon name="pencil" className={icon} /></button>
      <button type="button" aria-label={`Duplicate ${rowTitle(post)}`} title="Duplicate as draft" disabled={busyId === post.id} onClick={() => void duplicate(post)} className={`flex ${button} items-center justify-center border border-slate-200 bg-white text-slate-700 transition hover:bg-slate-50 disabled:opacity-50`}><Icon name="copy" className={icon} /></button>
      {entries.length > 0 && <RowMenu title={rowTitle(post)} entries={entries} compact={compact} />}
    </div>;
  }

  const cards: { key: string; label: string; icon: IconName; tint: string; value?: number; recent?: number }[] = [
    { key: "any", label: "Total articles", icon: "doc", tint: "bg-violet-50 text-violet-600", value: stats?.total, recent: stats?.recent.total },
    { key: "publish", label: "Published", icon: "eye", tint: "bg-violet-50 text-violet-600", value: stats?.publish, recent: stats?.recent.publish },
    { key: "draft", label: "Drafts", icon: "clock", tint: "bg-violet-50 text-violet-600", value: stats?.draft, recent: stats?.recent.draft },
    { key: "trash", label: "In trash", icon: "trash", tint: "bg-red-50 text-red-500", value: stats?.trash },
  ];
  const numbers = pageNumbers(query.page, totalPages);

  return <div className="space-y-5 sm:space-y-6">
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div><p className="pill text-xs font-bold uppercase tracking-[0.18em] text-violet-700">WordPress posts</p><h1 className="mt-2 text-2xl font-extrabold text-[#12093a] sm:text-3xl">Articles</h1><p className="mt-1.5 text-sm text-slate-500">Search, edit and publish existing articles without leaving this dashboard.</p></div>
      <button type="button" onClick={onNew} className="flex min-h-11 items-center gap-2 rounded-xl bg-[linear-gradient(90deg,#7c3aed,#6d28d9)] px-5 text-sm font-bold text-white shadow-[0_10px_22px_-10px_rgba(109,40,217,0.8)] transition hover:brightness-110"><Icon name="plus" className="h-[18px] w-[18px]" strokeWidth={2.2} />New article</button>
    </div>

    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{cards.map((card) => <button type="button" key={card.key} aria-pressed={query.status === card.key} onClick={() => apply({ status: card.key })} className={`${cardClass} flex items-start gap-4 !p-4 text-left transition hover:border-violet-200 ${query.status === card.key && card.key !== "any" ? "ring-2 ring-violet-300" : ""}`}>
      <span className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl ${card.tint}`}><Icon name={card.icon} className="h-6 w-6" /></span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm text-slate-500">{card.label}</span>
        {card.value === undefined ? <Skeleton className="mt-2 h-7 w-20" /> : <span className="mt-0.5 block text-[26px] font-extrabold leading-tight text-[#12093a]">{card.value.toLocaleString()}</span>}
        <span className="mt-1 block text-xs text-slate-500">
          {card.key === "trash" ? "Recoverable in WordPress" : card.recent === undefined ? " " : card.recent > 0
            ? <><span className="inline-flex items-center gap-0.5 font-semibold text-emerald-600"><Icon name="arrowUp" className="h-3.5 w-3.5" strokeWidth={2.2} />{card.recent.toLocaleString()}</span> new in last 30 days</>
            : "None new in last 30 days"}
        </span>
      </span>
    </button>)}</div>

    {notice && <p role="status" className="rounded-xl bg-violet-50 px-4 py-3 text-sm text-violet-800">{notice}</p>}

    <div className={`${cardClass} !p-4 sm:!p-5`}>
      <form onSubmit={(event) => { event.preventDefault(); apply({ search: searchInput.trim() }); }} className="grid gap-3 sm:grid-cols-2 lg:grid-cols-[minmax(0,1.6fr)_repeat(4,minmax(0,1fr))_auto]">
        <label className="relative block sm:col-span-2 lg:col-span-1">
          <span className="sr-only">Search articles</span>
          <Icon name="search" className="pointer-events-none absolute left-3.5 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-slate-500" />
          <input type="search" value={searchInput} onChange={(event) => setSearchInput(event.target.value)} placeholder="Search by article title or content…" className={`${inputClass} pl-10 [&::-webkit-search-cancel-button]:hidden`} />
        </label>
        <FilterSelect label="Filter by author" value={query.author} onChange={(author) => apply({ author })} options={[["", "All authors"], ...authors.map((item) => [String(item.id), item.name])]} />
        <FilterSelect label="Filter by category" value={query.category} onChange={(next) => apply({ category: next })} options={[["", "All categories"], ...categories.map((item) => [String(item.id), stripHtml(item.name)])]} />
        <FilterSelect label="Filter by status" value={query.status} onChange={(status) => apply({ status })} options={statusOptions} />
        <FilterSelect label="Filter by date" value={query.days} onChange={(days) => apply({ days })} options={dateOptions} icon="calendar" />
        <button type="button" onClick={reset} disabled={!filtered && !searchInput} className="min-h-11 rounded-xl border border-slate-200 bg-white px-5 text-sm font-semibold text-slate-800 transition hover:bg-slate-50 disabled:opacity-50">Reset</button>
      </form>

      {error && <p role="alert" className="mt-4 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>}

      <div aria-busy={loading} className={`mt-4 transition-opacity ${loading && items.length ? "opacity-60" : ""}`}>
        {loading && !items.length ? <div aria-label="Loading articles" className="space-y-3">{Array.from({ length: 6 }, (_, index) => <div className="flex items-center gap-4" key={index}><Skeleton className="h-4 flex-1" /><Skeleton className="hidden h-8 w-24 md:block" /></div>)}</div>
          : !items.length ? <div className="rounded-xl border border-dashed border-slate-200 px-4 py-10 text-center text-sm text-slate-500">{filtered ? "No articles match these filters." : "No articles found."}{filtered && <button type="button" onClick={reset} className="ml-2 font-semibold text-violet-700 hover:underline">Reset filters</button>}</div>
          : <>
            <ul className="space-y-3 md:hidden">{items.map((post) => {
              const author = authorOf(post.author);
              return <li key={post.id} className="rounded-xl border border-slate-200 bg-white p-3">
                <h2 className="break-words text-[13px] font-semibold leading-snug text-[#12093a]">{rowTitle(post)}</h2>
                <div className="mt-1.5 flex flex-wrap items-center gap-1.5"><StatusChip status={post.status} />{categoriesOf(post).map((cat) => <CategoryChip key={cat.id} name={cat.name} />)}</div>
                <div className="mt-2.5 flex items-center justify-between gap-3 border-t border-slate-100 pt-2.5">
                  <div className="flex min-w-0 items-center gap-2"><Avatar src={author?.avatar} /><div className="min-w-0 text-[11px] text-slate-500"><p className="break-words text-xs font-medium text-slate-700">{authorName(post.author)}</p><p>{formatDay(post.date)}</p></div></div>
                  {actions(post)}
                </div>
              </li>;
            })}</ul>

            <div className="hidden overflow-x-auto rounded-xl border border-slate-200 md:block"><table className="w-full min-w-[960px] table-fixed border-collapse text-left text-xs">
              <colgroup><col className="w-9" /><col /><col className="w-40" /><col className="w-32" /><col className="w-[92px]" /><col className="w-[140px]" /><col className="w-[128px]" /></colgroup>
              <thead className="bg-slate-50 text-[11px] font-semibold uppercase tracking-wide text-slate-500"><tr>{["#", "Article", "Author", "Category", "Status", "Published", "Actions"].map((heading) => <th key={heading} scope="col" className={`${cell} border-b py-2 ${heading === "Actions" ? "text-center" : ""}`}>{heading}</th>)}</tr></thead>
              <tbody className="divide-y divide-slate-200">{items.map((post, index) => {
                const author = authorOf(post.author);
                const cats = categoriesOf(post);
                return <tr key={post.id} className="align-middle">
                  <td className={`${cell} text-slate-500`}>{(query.page - 1) * PER_PAGE + index + 1}</td>
                  <td className={`${cell} break-words text-[13px] font-semibold leading-snug text-[#12093a]`}>{rowTitle(post)}</td>
                  <td className={cell}><div className="flex items-center gap-2"><Avatar src={author?.avatar} /><span className="min-w-0 break-words leading-snug text-slate-700">{authorName(post.author)}</span></div></td>
                  <td className={cell}>{cats.length ? <div className="flex flex-wrap gap-1">{cats.map((cat) => <CategoryChip key={cat.id} name={cat.name} />)}</div> : <span className="text-slate-400">—</span>}</td>
                  <td className={cell}><StatusChip status={post.status} /></td>
                  <td className={`${cell} text-slate-700`}><span className="block">{formatDay(post.date)}</span>{post.modified && <span className="block text-[11px] text-slate-400">Edited {formatDay(post.modified)}</span>}</td>
                  <td className={cell}><div className="flex justify-center">{actions(post, true)}</div></td>
                </tr>;
              })}</tbody>
            </table></div>
          </>}
      </div>

      <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-4 text-xs text-slate-500">
        <span>{total.toLocaleString()} {total === 1 ? "article" : "articles"} · Page {query.page.toLocaleString()} of {totalPages.toLocaleString()}</span>
        <nav aria-label="Pagination" className="flex items-center gap-1.5">
          <button type="button" aria-label="Previous page" disabled={query.page <= 1 || loading} onClick={() => run({ ...query, page: query.page - 1 })} className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-700 transition hover:bg-slate-50 disabled:opacity-40"><Icon name="chevronLeft" className="h-4 w-4" strokeWidth={2} /></button>
          {numbers.map((entry, index) => entry === "…"
            ? <span key={`gap-${index}`} aria-hidden className="px-1 text-slate-400">…</span>
            : <button type="button" key={entry} aria-current={entry === query.page ? "page" : undefined} disabled={loading} onClick={() => run({ ...query, page: entry })} className={`hidden h-9 min-w-9 items-center justify-center rounded-lg px-2 text-xs font-semibold transition sm:flex ${entry === query.page ? "bg-violet-700 text-white shadow-[0_8px_16px_-8px_rgba(109,40,217,0.8)]" : "text-slate-700 hover:bg-slate-100"}`}>{entry.toLocaleString()}</button>)}
          <button type="button" aria-label="Next page" disabled={query.page >= totalPages || loading} onClick={() => run({ ...query, page: query.page + 1 })} className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-700 transition hover:bg-slate-50 disabled:opacity-40"><Icon name="chevronRight" className="h-4 w-4" strokeWidth={2} /></button>
        </nav>
      </div>
    </div>

    <ConfirmDialog open={Boolean(trashTarget)} title="Move to trash?" body={trashTarget ? `“${rowTitle(trashTarget)}” will be taken off the site. You can restore it from the WordPress trash.` : ""} confirmLabel="Move to trash" destructive onConfirm={() => void moveToTrash()} onCancel={() => setTrashTarget(null)} />
  </div>;
}
