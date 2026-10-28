"use client";

import { useCallback, useEffect, useState } from "react";
import { fetchLive } from "./api";
import { DEVICE_LABELS, KIND_LABELS, SOURCE_LABELS } from "./format";
import { EmptyNote, ErrorNote, ListSkeleton, Panel, VIOLET } from "./parts";
import type { LiveReport } from "@/lib/analytics/report-types";

const REFRESH_MS = 15_000;

/** Readers on the site right now: counts per page, never who. Refreshes while the tab is visible. */
export default function LivePanel({ onOpenArticle }: { onOpenArticle: (id: number) => void }) {
  const [live, setLive] = useState<LiveReport | null>(null);
  const [error, setError] = useState("");

  const load = useCallback(async (signal?: AbortSignal) => {
    try {
      setLive(await fetchLive(signal));
      setError("");
    } catch (reason) {
      if (!signal?.aborted) setError(reason instanceof Error ? reason.message : "Could not load live readers.");
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    const tick = () => { if (document.visibilityState === "visible") void load(controller.signal); };
    tick();
    const timer = window.setInterval(tick, REFRESH_MS);
    document.addEventListener("visibilitychange", tick);
    return () => { controller.abort(); window.clearInterval(timer); document.removeEventListener("visibilitychange", tick); };
  }, [load]);

  const max = Math.max(...(live?.perMinute ?? [0]), 0);
  return <Panel title="Live now" subtitle={`Readers seen in the last ${live ? live.windowSeconds / 60 : 2} minutes. Updates every 15 seconds.`}
    action={live && <span className="inline-flex items-center gap-2 rounded-full bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-700"><span aria-hidden className="h-2 w-2 animate-pulse rounded-full bg-emerald-500" />Live</span>}>
    {error && <ErrorNote message={error} onRetry={() => void load()} />}
    {!live && !error && <ListSkeleton rows={3} />}
    {live && <div className="mt-4 grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.6fr)]">
      <div>
        <p className="text-5xl font-extrabold leading-none text-[#12093a]" aria-live="polite">{live.visitors.toLocaleString("en")}</p>
        <p className="mt-1.5 text-sm text-slate-500">{live.visitors === 1 ? "reader" : "readers"} on the site</p>
        <div className="mt-4">
          <p className="text-xs font-medium text-slate-500">Page views started, last 30 minutes</p>
          <div role="img" aria-label={`Page views started per minute over the last 30 minutes: ${live.perMinute.reduce((a, b) => a + b, 0)} in total`} className="mt-2 flex h-14 items-end gap-[2px]">
            {live.perMinute.map((n, i) => <span key={i} title={`${30 - i} min ago: ${n} ${n === 1 ? "view" : "views"}`} className="flex-1 rounded-t-[2px]" style={{ height: `${max ? Math.max(4, (n / max) * 100) : 4}%`, backgroundColor: n ? VIOLET : "#ede9fe" }} />)}
          </div>
          <div aria-hidden className="mt-1 flex justify-between text-[11px] text-slate-400"><span>30 min ago</span><span>now</span></div>
        </div>
        {live.categories.length > 0 && <div className="mt-4">
          <p className="text-xs font-medium text-slate-500">Readers by category now</p>
          <dl className="mt-1.5 space-y-1 text-sm">
            {live.categories.slice(0, 6).map((c) => <div key={c.id} className="flex justify-between gap-3"><dt className="truncate text-slate-700">{c.name}</dt><dd className="font-semibold tabular-nums">{c.readers}</dd></div>)}
          </dl>
        </div>}
        {live.visitors > 0 && <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
          {live.devices.map((d) => <div key={d.id} className="flex justify-between gap-2"><dt className="text-slate-500">{DEVICE_LABELS[d.id] ?? d.id}</dt><dd className="font-semibold tabular-nums">{d.readers}</dd></div>)}
          {live.sources.slice(0, 4).map((s) => <div key={s.id} className="flex justify-between gap-2"><dt className="truncate text-slate-500">{SOURCE_LABELS[s.id] ?? s.id}</dt><dd className="font-semibold tabular-nums">{s.readers}</dd></div>)}
        </dl>}
      </div>
      <div className="min-w-0">
        <p className="text-sm font-semibold text-slate-800">Being read now</p>
        {live.pages.length ? <ul className="mt-2 divide-y divide-slate-100">
          {live.pages.map((page) => {
            const body = <><span className="min-w-0 flex-1"><span className="line-clamp-1 text-sm font-medium text-slate-900">{page.title}</span><span className="block truncate text-xs text-slate-500">{page.kind === "article" ? page.category ?? "Article" : KIND_LABELS[page.kind] ?? page.kind}</span></span>
              <span className="shrink-0 text-sm font-semibold tabular-nums text-slate-900">{page.readers}<span className="sr-only"> readers</span></span></>;
            return <li key={`${page.kind}:${page.key}`}>{page.kind === "article"
              ? <button type="button" onClick={() => onOpenArticle(Number(page.key))} className="flex min-h-11 w-full items-center gap-3 rounded-lg px-1 py-1.5 text-left transition hover:bg-violet-50">{body}</button>
              : <div className="flex min-h-11 items-center gap-3 px-1 py-1.5">{body}</div>}</li>;
          })}
        </ul> : <EmptyNote>Nobody is reading right now.</EmptyNote>}
      </div>
    </div>}
  </Panel>;
}
