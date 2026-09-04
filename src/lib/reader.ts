"use client";

import { useSyncExternalStore } from "react";

/* Everything the reader accumulates on their own device: the posts they saved,
   the ones they last opened, and the time they asked to be nudged at. All of it
   lives in localStorage — there is no account system on this site, and nothing
   here is ever sent anywhere.

   Shaped after lib/appChrome.ts: one module-level cache per key, a single
   listener set, and useSyncExternalStore on top. The snapshots MUST stay
   referentially stable between mutations — getSnapshot runs on every render, and
   handing React a fresh array each time is an infinite re-render. */

export interface SavedItem {
  id: number;
  href: string;
  title: string;
  img: string | null;
  category: string;
  date: string;
  /** the reader's own note, editable from /saved */
  note?: string;
  /** epoch ms, for ordering */
  at: number;
}

/** same record, minus the note — reading a post doesn't annotate it */
export type RecentItem = Omit<SavedItem, "note">;

export interface Reminder {
  /** one of REMINDER_SLOTS */
  time: string;
  enabled: boolean;
}

/** the five slots the push cron knows how to deliver — see app/api/reminder */
export const REMINDER_SLOTS = ["06:00", "09:00", "13:00", "18:00", "21:00"] as const;

/** the four Malayalam faces offered on /settings, keyed to the CSS vars layout.tsx
    publishes from next/font */
export type FontKey = "sans" | "serif" | "manjari" | "anek";

export const FONTS: { key: FontKey; label: string; var: string }[] = [
  { key: "sans", label: "Noto Sans Malayalam", var: "var(--font-noto-ml)" },
  { key: "serif", label: "Noto Serif Malayalam", var: "var(--font-serif-ml)" },
  { key: "manjari", label: "Manjari", var: "var(--font-manjari)" },
  { key: "anek", label: "Anek Malayalam", var: "var(--font-anek-ml)" },
];

/** article body scale — index into this, so the stored value survives retuning */
export const TEXT_SIZES = ["0.95rem", "1.05rem", "1.15rem", "1.25rem", "1.4rem", "1.55rem", "1.7rem"];

export interface ReadingPrefs {
  /** index into TEXT_SIZES */
  size: number;
  font: FontKey;
}

const SAVED_KEY = "iol:saved";
const RECENT_KEY = "iol:recent";
const REMINDER_KEY = "iol:reminder";
const PREFS_KEY = "iol:prefs";

const SAVED_CAP = 200;
const RECENT_CAP = 20;

// module-level constants, never a fresh []: these are what the server snapshot
// returns, and a new array per call would loop the render. Not Object.freeze'd —
// that widens them to readonly and the caches they seed are mutable arrays
const NO_SAVED: SavedItem[] = [];
const NO_RECENT: RecentItem[] = [];
const DEFAULT_REMINDER: Reminder = Object.freeze({ time: "09:00", enabled: false });
const DEFAULT_PREFS: ReadingPrefs = Object.freeze({ size: 2, font: "sans" });

let saved: SavedItem[] = NO_SAVED;
let recent: RecentItem[] = NO_RECENT;
let reminder: Reminder = DEFAULT_REMINDER;
let prefs: ReadingPrefs = DEFAULT_PREFS;

// the caches stay empty until the first subscribe, which only runs after mount:
// the first client render then matches the server's empty one, and the real data
// arrives as an update instead of a hydration mismatch
let hydrated = false;

const listeners = new Set<() => void>();

function emit(): void {
  for (const l of listeners) l();
}

function readJson<T>(key: string, fallback: T): T {
  // Safari in private mode throws on access, not just on write
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return fallback;
    const parsed: unknown = JSON.parse(raw);
    return parsed as T;
  } catch {
    return fallback;
  }
}

function writeJson(key: string, value: unknown): void {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // quota or a locked-down profile — the in-memory cache still works for the
    // rest of the session, it just won't survive a reload
  }
}

function hydrate(): void {
  if (hydrated || typeof window === "undefined") return;
  hydrated = true;
  const s = readJson<SavedItem[]>(SAVED_KEY, NO_SAVED);
  const r = readJson<RecentItem[]>(RECENT_KEY, NO_RECENT);
  const m = readJson<Reminder>(REMINDER_KEY, DEFAULT_REMINDER);
  const p = readJson<ReadingPrefs>(PREFS_KEY, DEFAULT_PREFS);
  saved = Array.isArray(s) ? s : NO_SAVED;
  recent = Array.isArray(r) ? r : NO_RECENT;
  reminder = m && typeof m.time === "string" ? m : DEFAULT_REMINDER;
  prefs = p && typeof p.size === "number" ? p : DEFAULT_PREFS;
}

/** a second tab wrote — pick the change up rather than drifting apart */
function onStorage(e: StorageEvent): void {
  const ours = [SAVED_KEY, RECENT_KEY, REMINDER_KEY, PREFS_KEY];
  if (e.key !== null && !ours.includes(e.key)) return;
  saved = readJson<SavedItem[]>(SAVED_KEY, NO_SAVED);
  recent = readJson<RecentItem[]>(RECENT_KEY, NO_RECENT);
  reminder = readJson<Reminder>(REMINDER_KEY, DEFAULT_REMINDER);
  prefs = readJson<ReadingPrefs>(PREFS_KEY, DEFAULT_PREFS);
  emit();
}

function subscribe(cb: () => void): () => void {
  if (!listeners.size) {
    hydrate();
    window.addEventListener("storage", onStorage);
    // the caches were empty for the first render; publish the real values now
    if (saved !== NO_SAVED || recent !== NO_RECENT || reminder !== DEFAULT_REMINDER || prefs !== DEFAULT_PREFS) {
      queueMicrotask(emit);
    }
  }
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
    if (!listeners.size) window.removeEventListener("storage", onStorage);
  };
}

/* ---- snapshots ---------------------------------------------------------- */

const savedSnapshot = () => saved;
const recentSnapshot = () => recent;
const reminderSnapshot = () => reminder;
const serverSaved = () => NO_SAVED;
const serverRecent = () => NO_RECENT;
const serverReminder = () => DEFAULT_REMINDER;
const prefsSnapshot = () => prefs;
const serverPrefs = () => DEFAULT_PREFS;

export function useSaved(): SavedItem[] {
  return useSyncExternalStore(subscribe, savedSnapshot, serverSaved);
}

export function useRecent(): RecentItem[] {
  return useSyncExternalStore(subscribe, recentSnapshot, serverRecent);
}

export function useReminder(): Reminder {
  return useSyncExternalStore(subscribe, reminderSnapshot, serverReminder);
}

export function useReadingPrefs(): ReadingPrefs {
  return useSyncExternalStore(subscribe, prefsSnapshot, serverPrefs);
}

export function useSavedCount(): number {
  return useSyncExternalStore(subscribe, () => saved.length, () => 0);
}

export function useIsSaved(id: number): boolean {
  return useSyncExternalStore(
    subscribe,
    () => saved.some((s) => s.id === id),
    () => false
  );
}

/* ---- mutators ----------------------------------------------------------- */

function commitSaved(next: SavedItem[]): void {
  saved = next.slice(0, SAVED_CAP);
  writeJson(SAVED_KEY, saved);
  emit();
}

function commitRecent(next: RecentItem[]): void {
  recent = next.slice(0, RECENT_CAP);
  writeJson(RECENT_KEY, recent);
  emit();
}

/** save if it isn't saved, unsave if it is. Returns the state it landed in. */
export function toggleSave(item: Omit<SavedItem, "at">): boolean {
  hydrate();
  if (saved.some((s) => s.id === item.id)) {
    commitSaved(saved.filter((s) => s.id !== item.id));
    return false;
  }
  commitSaved([{ ...item, at: Date.now() }, ...saved]);
  return true;
}

export function removeSaved(id: number): void {
  hydrate();
  commitSaved(saved.filter((s) => s.id !== id));
}

/** the reader's own note on a saved post; an empty string clears it */
export function setNote(id: number, note: string): void {
  hydrate();
  const trimmed = note.trim();
  commitSaved(saved.map((s) => (s.id === id ? { ...s, note: trimmed || undefined } : s)));
}

export function clearSaved(): void {
  hydrate();
  commitSaved([]);
}

/** called once per post view — moves an already-seen post back to the top */
export function recordRead(item: Omit<RecentItem, "at">): void {
  hydrate();
  commitRecent([{ ...item, at: Date.now() }, ...recent.filter((r) => r.id !== item.id)]);
}

export function removeRecent(id: number): void {
  hydrate();
  commitRecent(recent.filter((r) => r.id !== id));
}

export function clearRecent(): void {
  hydrate();
  commitRecent([]);
}

export function setReminder(next: Reminder): void {
  hydrate();
  reminder = next;
  writeJson(REMINDER_KEY, reminder);
  emit();
}

export function setReadingPrefs(next: Partial<ReadingPrefs>): void {
  hydrate();
  prefs = { ...prefs, ...next };
  writeJson(PREFS_KEY, prefs);
  emit();
}

/** the CSS custom properties the article body reads — see globals.css .reader-body */
export function prefsToCss(p: ReadingPrefs): { size: string; font: string } {
  return {
    size: TEXT_SIZES[p.size] ?? TEXT_SIZES[DEFAULT_PREFS.size],
    font: (FONTS.find((f) => f.key === p.font) ?? FONTS[0]).var,
  };
}
