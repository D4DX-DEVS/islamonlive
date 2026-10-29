"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { HomeSection } from "@/lib/home-layout/schema";

/* The homepage builder's state: the published layout, the working draft, undo
   and redo, and the autosave that keeps the draft in the database (so the
   preview can render it, and a reload or another administrator picks it up).

   Every edit lands in the draft at once and is saved ~0.7 s after typing stops.
   Saves run one after another, never overlapping, so an older draft can never
   overwrite a newer one. A successful save bumps `version`, which tells the
   canvas to reload the preview. */

export type StaffRef = { id: number; name: string } | null;
export type LayoutState = {
  sections: HomeSection[];
  draft: HomeSection[] | null;
  draftUpdatedAt: string | null;
  draftUpdatedBy: StaffRef;
  isDefault: boolean;
  updatedAt: string | null;
  updatedBy: StaffRef;
  history: { index: number; savedAt: string; savedBy: StaffRef; sections: number }[];
};
export type SaveStatus = "idle" | "pending" | "saving" | "saved" | "error";

const AUTOSAVE_MS = 700;
const UNDO_LIMIT = 60;
/** Keystrokes in one field within this window are one undo step. */
const COALESCE_MS = 1500;
const API = "/api/admin/home-layout/";
const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

async function call(url: string, method: string, body?: unknown): Promise<Record<string, unknown>> {
  const response = await fetch(url, { method, headers: body === undefined ? undefined : { "Content-Type": "application/json" }, body: body === undefined ? undefined : JSON.stringify(body), cache: "no-store", keepalive: method !== "GET" });
  const data = await response.json().catch(() => ({})) as Record<string, unknown>;
  if (!response.ok) throw new Error(typeof data.error === "string" ? data.error : "The layout service returned an error.");
  return data;
}

export function useLayoutDraft() {
  const [server, setServer] = useState<LayoutState | null>(null);
  const [draft, setDraft] = useState<HomeSection[]>([]);
  const [past, setPast] = useState<HomeSection[][]>([]);
  const [future, setFuture] = useState<HomeSection[][]>([]);
  const [save, setSave] = useState<SaveStatus>("idle");
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const [version, setVersion] = useState(0);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  /** What the database holds for the preview (draft, or the live layout when there is no draft). */
  const stored = useRef("");
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const queue = useRef<Promise<void>>(Promise.resolve());
  const coalesce = useRef<{ key: string; at: number } | null>(null);
  const live = useRef<HomeSection[]>([]);

  const accept = useCallback((state: LayoutState, working?: HomeSection[]) => {
    setServer(state);
    live.current = state.sections;
    const next = working ?? state.draft ?? state.sections;
    setDraft(next);
    stored.current = JSON.stringify(state.draft ?? state.sections);
    setSavedAt(state.draftUpdatedAt);
  }, []);

  const load = useCallback(async () => {
    try { accept(await call(API, "GET") as unknown as LayoutState); setError(""); } catch (problem) { setError(problem instanceof Error ? problem.message : "Could not reach the layout service."); }
  }, [accept]);

  useEffect(() => {
    let cancelled = false;
    void call(API, "GET").then((state) => { if (!cancelled) accept(state as unknown as LayoutState); }).catch((problem: unknown) => { if (!cancelled) setError(problem instanceof Error ? problem.message : "Could not reach the layout service."); });
    return () => { cancelled = true; };
  }, [accept]);

  const persist = useCallback((next: HomeSection[]) => {
    queue.current = queue.current.then(async () => {
      const json = JSON.stringify(next);
      if (json === stored.current) { setSave("saved"); return; }
      setSave("saving");
      try {
        // back to exactly what is live: there is no draft any more
        if (same(next, live.current)) await call(`${API}draft/`, "DELETE");
        else { const result = await call(`${API}draft/`, "PUT", { sections: next }); setSavedAt(typeof result.savedAt === "string" ? result.savedAt : new Date().toISOString()); }
        stored.current = json;
        setSave("saved");
        setError("");
        setVersion((v) => v + 1);
      } catch (problem) {
        setSave("error");
        setError(problem instanceof Error ? problem.message : "The draft could not be saved.");
      }
    });
    return queue.current;
  }, []);

  const schedule = useCallback((next: HomeSection[]) => {
    setSave("pending");
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => { timer.current = null; void persist(next); }, AUTOSAVE_MS);
  }, [persist]);

  /** Save now whatever is waiting for the autosave (before leaving, publishing, or on retry). */
  const flush = useCallback(async () => {
    if (timer.current) { clearTimeout(timer.current); timer.current = null; }
    await persist(draft);
  }, [persist, draft]);

  /** Apply an edit. Edits with the same `key` in quick succession are one undo step. */
  const commit = useCallback((next: HomeSection[], key?: string) => {
    const now = Date.now();
    const merge = key !== undefined && coalesce.current?.key === key && now - coalesce.current.at < COALESCE_MS;
    if (!merge) setPast((p) => [...p.slice(-(UNDO_LIMIT - 1)), draft]);
    coalesce.current = key ? { key, at: now } : null;
    setFuture([]);
    setDraft(next);
    schedule(next);
  }, [draft, schedule]);

  const undo = useCallback(() => {
    const previous = past[past.length - 1];
    if (!previous) return;
    setPast(past.slice(0, -1));
    setFuture((f) => [draft, ...f].slice(0, UNDO_LIMIT));
    coalesce.current = null;
    setDraft(previous);
    schedule(previous);
  }, [past, draft, schedule]);

  const redo = useCallback(() => {
    const next = future[0];
    if (!next) return;
    setFuture(future.slice(1));
    setPast((p) => [...p, draft].slice(-UNDO_LIMIT));
    coalesce.current = null;
    setDraft(next);
    schedule(next);
  }, [future, draft, schedule]);

  /** Publish / discard / restore. A failure is thrown, so the confirmation modal that started it can show it and offer a retry. */
  async function run(work: () => Promise<void>) {
    if (timer.current) { clearTimeout(timer.current); timer.current = null; }
    setBusy(true); setError("");
    try { await queue.current; await work(); } finally { setBusy(false); }
  }

  const publish = () => run(async () => {
    const state = await call(API, "PUT", { sections: draft }) as unknown as LayoutState;
    accept(state);
    setSave("idle");
    setVersion((v) => v + 1);
  });

  const discard = () => run(async () => {
    await call(`${API}draft/`, "DELETE");
    if (!server) return;
    setPast((p) => [...p, draft].slice(-UNDO_LIMIT));
    setFuture([]);
    accept({ ...server, draft: null, draftUpdatedAt: null, draftUpdatedBy: null });
    setSave("idle");
    setVersion((v) => v + 1);
  });

  const restore = (index: number) => run(async () => {
    const state = await call(API, "POST", { restore: index }) as unknown as LayoutState;
    setPast((p) => [...p, draft].slice(-UNDO_LIMIT));
    setFuture([]);
    accept(state);
    setSave("idle");
    setVersion((v) => v + 1);
  });

  const hasChanges = server !== null && !same(draft, server.sections);
  return { server, draft, commit, undo, redo, canUndo: past.length > 0, canRedo: future.length > 0, save, savedAt, version, error, setError, busy, hasChanges, publish, discard, restore, flush, load, retry: () => void persist(draft) };
}
