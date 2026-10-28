"use client";

import { useCallback, useSyncExternalStore } from "react";
import { OPT_OUT_KEY, browserOptsOut, setAnalyticsOptOut } from "@/lib/analytics/tracker";

/* The reader's analytics choice for Settings: "on", "off", or "browser" when
   the browser itself asks not to be tracked (Global Privacy Control or Do Not
   Track), which nothing on the page can override. null until hydrated. */

export type AnalyticsChoice = "on" | "off" | "browser";
const CHANGED = "iol:analytics-choice";

function snapshot(): AnalyticsChoice {
  if (browserOptsOut()) return "browser";
  try { return localStorage.getItem(OPT_OUT_KEY) === "1" ? "off" : "on"; } catch { return "on"; }
}

function subscribe(onChange: () => void): () => void {
  // another tab changing it arrives as "storage"; this tab as our own event
  const onStorage = (event: StorageEvent) => { if (event.key === null || event.key === OPT_OUT_KEY) onChange(); };
  window.addEventListener("storage", onStorage);
  window.addEventListener(CHANGED, onChange);
  return () => { window.removeEventListener("storage", onStorage); window.removeEventListener(CHANGED, onChange); };
}

export function useAnalyticsChoice(): [AnalyticsChoice | null, (share: boolean) => void] {
  const choice = useSyncExternalStore(subscribe, snapshot, () => null);
  const set = useCallback((share: boolean) => {
    setAnalyticsOptOut(!share);
    window.dispatchEvent(new Event(CHANGED));
  }, []);
  return [choice, set];
}
