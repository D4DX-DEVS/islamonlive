"use client";

import { useEffect, useState } from "react";
import { inputClass, Skeleton } from "../ui";
import { Icon } from "../icons";
import { Select } from "../Select";
import { fetchArticles, type FilterState, type TableQuery } from "./api";
import { compact, duration, longDay, metric, percent } from "./format";
import { EmptyNote, ErrorNote, Panel } from "./parts";
import { PAGE_SIZES, type ArticleSort, type ArticlesPage } from "@/lib/analytics/report-types";

type Column = { sort: ArticleSort | null; label: string; className?: string; cell: (row: ArticlesPage["data"][number]) => React.ReactNode };

const COLUMNS: Column[] = [
  { sort: "views", label: "Views", cell: (row) => compact(row.views) },
  { sort: null, label: "Visitors", className: "hidden md:table-cell", cell: (row) => metric(row.visitors ?? null, compact) },
  { sort: "avgSeconds", label: "Avg. time", cell: (row) => metric(row.avgSeconds, duration) },
  { sort: "activeSeconds", label: "Total time", className: "hidden lg:table-cell", cell: (row) => duration(row.activeSeconds) },
  { sort: "avgScroll", label: "Avg. scroll", className: "hidden lg:table-cell", cell: (row) => metric(row.avgScroll, percent) },
  { sort: "completionRate", label: "Finished", className: "hidden sm:table-cell", cell: (row) => metric(row.completionRate, percent) },
  { sort: "change", label: "Change", className: "hidden xl:table-cell", cell: (row) => row.change === null ? <span title={row.previousViews ? "" : "No views in the previous period"}>{row.previousViews ? "—" : "New"}</span> : <span className={row.change >= 0 ? "text-emerald-700" : "text-red-700"}>{row.change > 0 ? "+" : ""}{percent(row.change)}</span> },
  { sort: "publishedAt", label: "Published", className: "hidden xl:table-cell", cell: (row) => longDay(row.publishedAt) },
];

/** Every article read in the period, sortable and searchable; a row opens its breakdown. */
export default function ArticleTable({ filters, onOpen }: { filters: FilterState; onOpen: (id: number) => void }) {
  const [query, setQuery] = useState<TableQuery>({ q: "", sort: "views", order: "desc", page: 1, pageSize: 20 });
  const [search, setSearch] = useState("");
  const [data, setData] = useState<ArticlesPage | null>(null);
  // which request the latest answer (or failure) belongs to
  const [settled, setSettled] = useState<{ key: string; error: string } | null>(null);
  const [attempt, setAttempt] = useState(0);

  // the search box settles for 300 ms before it asks the server
  useEffect(() => {
    const timer = window.setTimeout(() => setQuery((current) => (current.q === search ? current : { ...current, q: search, page: 1 })), 300);
    return () => window.clearTimeout(timer);
  }, [search]);

  // new filters start again from the first page
  const filterKey = JSON.stringify(filters);
  const [seenFilters, setSeenFilters] = useState(filterKey);
  if (seenFilters !== filterKey) {
    setSeenFilters(filterKey);
    setQuery((current) => ({ ...current, page: 1 }));
  }

  const requestKey = JSON.stringify([filterKey, query, attempt]);
  useEffect(() => {
    const controller = new AbortController();
    const [filterJson, table] = JSON.parse(requestKey) as [string, TableQuery];
    fetchArticles(JSON.parse(filterJson) as FilterState, table, controller.signal)
      .then((page) => { setData(page); setSettled({ key: requestKey, error: "" }); })
      .catch((reason) => { if (!controller.signal.aborted) setSettled({ key: requestKey, error: reason instanceof Error ? reason.message : "Could not load the article table." }); });
    return () => controller.abort();
  }, [requestKey]);
  const loading = settled?.key !== requestKey;
  const error = loading ? "" : settled?.error ?? "";

  const sortBy = (sort: ArticleSort) => setQuery((current) => ({ ...current, sort, order: current.sort === sort && current.order === "desc" ? "asc" : "desc", page: 1 }));
  const ariaSort = (sort: ArticleSort | null) => (sort && query.sort === sort ? (query.order === "asc" ? "ascending" : "descending") : undefined);

  return <Panel title="Article performance" subtitle="Every article read in this period. Select a row for its full breakdown."
    action={<label className="relative block w-full sm:w-72"><span className="sr-only">Search articles</span><Icon name="search" className="pointer-events-none absolute left-3 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-slate-400" /><input type="search" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search by title or id…" className={`${inputClass} pl-10`} /></label>}>
    {error && <ErrorNote message={error} onRetry={() => setAttempt((n) => n + 1)} />}
    {!error && data && data.total === 0 && !loading && <EmptyNote>{query.q ? <>No article read in this period matches “{query.q}”. <button type="button" onClick={() => setSearch("")} className="font-semibold text-violet-700 underline">Clear search</button></> : "No article has been read in this period yet."}</EmptyNote>}
    {!error && (!data || data.total > 0 || loading) && <div className={`mt-4 overflow-x-auto transition-opacity ${loading && data ? "opacity-60" : ""}`}>
      <table className="w-full text-sm sm:min-w-[520px]">
        <thead><tr className="border-b border-slate-200 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
          <th scope="col" aria-sort={ariaSort("title")} className="py-2 pr-3"><button type="button" onClick={() => sortBy("title")} className="inline-flex min-h-9 items-center gap-1 uppercase hover:text-violet-700">Article{query.sort === "title" && <Icon name="chevronDown" className={`h-3.5 w-3.5 ${query.order === "asc" ? "rotate-180" : ""}`} />}</button></th>
          {COLUMNS.map((column) => <th key={column.label} scope="col" aria-sort={ariaSort(column.sort)} className={`py-2 pl-3 text-right ${column.className ?? ""}`}>
            {column.sort ? <button type="button" onClick={() => sortBy(column.sort!)} className="inline-flex min-h-9 items-center gap-1 uppercase hover:text-violet-700">{column.label}{query.sort === column.sort && <Icon name="chevronDown" className={`h-3.5 w-3.5 ${query.order === "asc" ? "rotate-180" : ""}`} />}</button> : <span title="Exact distinct visitors for the rows on this page">{column.label}</span>}
          </th>)}
        </tr></thead>
        <tbody className="divide-y divide-slate-100">
          {!data && loading && Array.from({ length: query.pageSize > 10 ? 10 : query.pageSize }, (_, i) => <tr key={i}><td className="py-3 pr-3"><Skeleton className="h-4 w-4/5" /></td>{COLUMNS.map((c) => <td key={c.label} className={`py-3 pl-3 ${c.className ?? ""}`}><Skeleton className="ml-auto h-4 w-12" /></td>)}</tr>)}
          {data?.data.map((row) => <tr key={row.id} className="cursor-pointer transition hover:bg-violet-50/60" onClick={() => onOpen(row.id)}>
            <td className="max-w-[280px] py-2.5 pr-3"><button type="button" onClick={(e) => { e.stopPropagation(); onOpen(row.id); }} className="text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-300"><span className="line-clamp-2 font-semibold text-slate-900">{row.title}</span><span className="block truncate text-xs text-slate-500">{row.category ?? "No category"}</span></button></td>
            {COLUMNS.map((column) => <td key={column.label} className={`whitespace-nowrap py-2.5 pl-3 text-right tabular-nums text-slate-800 ${column.className ?? ""}`}>{column.cell(row)}</td>)}
          </tr>)}
        </tbody>
      </table>
    </div>}
    {data && data.total > 0 && <div className="mt-4 flex flex-col gap-3 text-sm text-slate-600 sm:flex-row sm:items-center sm:justify-between">
      <p>{data.total.toLocaleString("en")} {data.total === 1 ? "article" : "articles"} · Page {data.page} of {data.totalPages}</p>
      <div className="flex items-center gap-2">
        <span aria-hidden>Rows</span><Select label="Rows per page" value={String(query.pageSize)} onChange={(v) => setQuery((current) => ({ ...current, pageSize: Number(v), page: 1 }))} className="w-20" options={PAGE_SIZES.map((size) => ({ value: String(size), label: String(size) }))} />
        <button type="button" aria-label="Previous page" disabled={data.page <= 1} onClick={() => setQuery((current) => ({ ...current, page: current.page - 1 }))} className="flex h-11 w-11 items-center justify-center rounded-xl border border-slate-200 bg-white transition hover:bg-slate-50 disabled:opacity-40"><Icon name="chevronLeft" className="h-4 w-4" /></button>
        <button type="button" aria-label="Next page" disabled={data.page >= data.totalPages} onClick={() => setQuery((current) => ({ ...current, page: current.page + 1 }))} className="flex h-11 w-11 items-center justify-center rounded-xl border border-slate-200 bg-white transition hover:bg-slate-50 disabled:opacity-40"><Icon name="chevronRight" className="h-4 w-4" /></button>
      </div>
    </div>}
  </Panel>;
}
