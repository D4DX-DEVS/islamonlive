"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { fetchList, type FilterState } from "./api";
import { ErrorNote, Pager } from "./parts";
import type { ListName, ListPage, ListRow } from "@/lib/analytics/report-types";

/** One of the summary's ranked lists, a page at a time. Page 1 arrives with the summary; later pages are asked of
    the server with the summary's own filters. The rows keep the tallest page's height, so a short last page doesn't
    make the card jump. */
export default function Paged<L extends ListName>({ list, first, filters, label, noun, children }: { list: L; first: ListPage<ListRow[L]>; filters: FilterState; label: string; noun: [string, string]; children: (rows: ListRow[L][], start: number) => ReactNode }) {
  const [page, setPage] = useState(1);
  const [shown, setShown] = useState(first);
  const [settled, setSettled] = useState<{ key: string; error: string } | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [minHeight, setMinHeight] = useState<number>();
  const rows = useRef<HTMLDivElement>(null);

  // a new summary (other filters, or a refresh) starts again from its first page
  const [seen, setSeen] = useState(first);
  if (seen !== first) {
    setSeen(first);
    setShown(first);
    setPage(1);
    setMinHeight(undefined);
  }

  const key = JSON.stringify([filters, list, page, attempt]);
  useEffect(() => {
    const [wanted, name, number] = JSON.parse(key) as [FilterState, L, number];
    if (number === 1) return;
    const controller = new AbortController();
    fetchList(wanted, name, number, controller.signal)
      .then((next) => { setShown(next); setSettled({ key, error: "" }); })
      .catch((reason) => { if (!controller.signal.aborted) setSettled({ key, error: reason instanceof Error ? reason.message : "Could not load this page." }); });
    return () => controller.abort();
  }, [key]);
  const loading = page > 1 && settled?.key !== key;
  const error = page > 1 && !loading ? settled?.error ?? "" : "";

  function go(next: number) {
    setMinHeight((current) => Math.max(current ?? 0, rows.current?.offsetHeight ?? 0));
    setPage(next);
    if (next === 1) setShown(first);
  }

  return <>
    {error && <ErrorNote message={error} onRetry={() => setAttempt((n) => n + 1)} />}
    <div ref={rows} aria-busy={loading} className={`transition-opacity ${loading ? "opacity-60" : ""}`} style={{ minHeight }}>{children(shown.data, (shown.page - 1) * shown.pageSize)}</div>
    <Pager label={label} page={page} totalPages={shown.totalPages} total={shown.total} noun={noun} onPage={go} disabled={loading} />
  </>;
}
