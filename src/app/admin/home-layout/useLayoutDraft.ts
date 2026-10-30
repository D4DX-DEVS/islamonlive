"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { HomeSection } from "@/lib/home-layout/schema";
import type { HomeTheme } from "@/lib/home-layout/theme";

/* The homepage builder's state: the published layout, the working draft, undo
   and redo, and the autosave that keeps the draft in the database (so the
   preview can render it, and a reload or another administrator picks it up).

   Every edit lands in the draft at once and is saved ~0.7 s after typing stops.
   Saves run one after another, never overlapping, so an older draft can never
   overwrite a newer one. A successful save bumps `version`, which tells the
   canvas to reload the preview.

   The page style (fonts, colours, sizes) travels with the sections: one undo
   history, one draft, one publish. */

export type StaffRef = { id: number; name: string } | null;
export type LayoutState = {
  sections: HomeSection[];
  draft: HomeSection[] | null;
  theme: HomeTheme;
  draftTheme: HomeTheme | null;
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

/** One undo step: everything the builder edits. */
type Snapshot = { sections: HomeSection[]; theme: HomeTheme };

async function call(url: string, method: string, body?: unknown): Promise<Record<string, unknown>> {
  const response = await fetch(url, { method, headers: body === undefined ? undefined : { "Content-Type": "application/json" }, body: body === undefined ? undefined : JSON.stringify(body), cache: "no-store", keepalive: method !== "GET" });
  const data = await response.json().catch(() => ({})) as Record<string, unknown>;
  if (!response.ok) throw new Error(typeof data.error === "string" ? data.error : "The layout service returned an error.");
  return data;
}

export function useLayoutDraft() {
  const [server, setServer] = useState<LayoutState | null>(null);
  const [work, setWork] = useState<Snapshot | null>(null);
  const [past, setPast] = useState<Snapshot[]>([]);
  const [future, setFuture] = useState<Snapshot[]>([]);
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
  const live = useRef<Snapshot | null>(null);

  const accept = useCallback((state: LayoutState) => {
    setServer(state);
    const published: Snapshot = { sections: state.sections, theme: state.theme };
    live.current = published;
    const next: Snapshot = state.draft ? { sections: state.draft, theme: state.draftTheme ?? state.theme } : published;
    setWork(next);
    stored.current = JSON.stringify(next);
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

  const persist = useCallback((next: Snapshot) => {
    queue.current = queue.current.then(async () => {
      const json = JSON.stringify(next);
      if (json === stored.current) { setSave("saved"); return; }
      setSave("saving");
      try {
        // back to exactly what is live: there is no draft any more
        if (same(next, live.current)) await call(`${API}draft/`, "DELETE");
        else { const result = await call(`${API}draft/`, "PUT", next); setSavedAt(typeof result.savedAt === "string" ? result.savedAt : new Date().toISOString()); }
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

  const schedule = useCallback((next: Snapshot) => {
    setSave("pending");
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => { timer.current = null; void persist(next); }, AUTOSAVE_MS);
  }, [persist]);

  /** Save now whatever is waiting for the autosave (before leaving, publishing, or on retry). */
  const flush = useCallback(async () => {
    if (timer.current) { clearTimeout(timer.current); timer.current = null; }
    if (work) await persist(work);
  }, [persist, work]);

  const apply = useCallback((next: Snapshot, key?: string) => {
    if (!work) return;
    const now = Date.now();
    const merge = key !== undefined && coalesce.current?.key === key && now - coalesce.current.at < COALESCE_MS;
    if (!merge) setPast((p) => [...p.slice(-(UNDO_LIMIT - 1)), work]);
    coalesce.current = key ? { key, at: now } : null;
    setFuture([]);
    setWork(next);
    schedule(next);
  }, [work, schedule]);

  /** Apply an edit to the sections. Edits with the same `key` in quick succession are one undo step. */
  const commit = useCallback((sections: HomeSection[], key?: string) => { if (work) apply({ ...work, sections }, key); }, [work, apply]);
  /** Apply an edit to the page style, undoable like any section edit. */
  const commitTheme = useCallback((theme: HomeTheme, key?: string) => { if (work) apply({ ...work, theme }, key); }, [work, apply]);

  const undo = useCallback(() => {
    const previous = past[past.length - 1];
    if (!previous || !work) return;
    setPast(past.slice(0, -1));
    setFuture((f) => [work, ...f].slice(0, UNDO_LIMIT));
    coalesce.current = null;
    setWork(previous);
    schedule(previous);
  }, [past, work, schedule]);

  const redo = useCallback(() => {
    const next = future[0];
    if (!next || !work) return;
    setFuture(future.slice(1));
    setPast((p) => [...p, work].slice(-UNDO_LIMIT));
    coalesce.current = null;
    setWork(next);
    schedule(next);
  }, [future, work, schedule]);

  /** Publish / discard / restore. A failure is thrown, so the confirmation modal that started it can show it and offer a retry. */
  async function run(work: () => Promise<void>) {
    if (timer.current) { clearTimeout(timer.current); timer.current = null; }
    setBusy(true); setError("");
    try { await queue.current; await work(); } finally { setBusy(false); }
  }

  const publish = () => run(async () => {
    if (!work) return;
    const state = await call(API, "PUT", work) as unknown as LayoutState;
    accept(state);
    setSave("idle");
    setVersion((v) => v + 1);
  });

  const discard = () => run(async () => {
    await call(`${API}draft/`, "DELETE");
    if (!server) return;
    if (work) setPast((p) => [...p, work].slice(-UNDO_LIMIT));
    setFuture([]);
    accept({ ...server, draft: null, draftTheme: null, draftUpdatedAt: null, draftUpdatedBy: null });
    setSave("idle");
    setVersion((v) => v + 1);
  });

  const restore = (index: number) => run(async () => {
    const state = await call(API, "POST", { restore: index }) as unknown as LayoutState;
    if (work) setPast((p) => [...p, work].slice(-UNDO_LIMIT));
    setFuture([]);
    accept(state);
    setSave("idle");
    setVersion((v) => v + 1);
  });

  const draft = work?.sections ?? [];
  const theme = work?.theme ?? server?.theme ?? null;
  const hasChanges = server !== null && work !== null && !same(work, { sections: server.sections, theme: server.theme });
  return { server, draft, theme, commit, commitTheme, undo, redo, canUndo: past.length > 0, canRedo: future.length > 0, save, savedAt, version, error, setError, busy, hasChanges, publish, discard, restore, flush, load, retry: () => { if (work) void persist(work); } };
}
