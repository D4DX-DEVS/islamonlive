import { ActiveClock } from "@/lib/analytics/active-clock";
import { PING_MS, SESSION_GAP_MS, istDay, type Beacon, type BeaconEvent, type PageKind } from "@/lib/analytics/shared";

/* Browser half of reader analytics (docs/analytics-plan.md). One call per page
   view: trackPageView() starts the active-time clock and scroll measurement,
   sends `start`, a `ping` every PING_MS while the tab is visible, and `end`
   when the tab is hidden, the page is left or the returned stop() runs on an
   in-app navigation. Every beacon carries totals, so the server can take the
   largest and duplicates are harmless.

   Nothing personal is collected: the ids are random and live in localStorage.
   Opting out in Settings, or a browser sending Global Privacy Control or Do Not
   Track, stops everything, including the ids being created. */

const ENDPOINT = "/api/analytics/collect";
const VISITOR_KEY = "iol:av";
const SESSION_KEY = "iol:as";
/** the visitor id the earlier reader tracker created; adopted so its readers count as returning */
const LEGACY_VISITOR_KEY = "iol:analytics-session";
export const OPT_OUT_KEY = "iol:analytics-optout";

export type PageInfo = { kind: PageKind; articleId?: number; categories?: number[] };

function randomId(): string {
  return typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
    ? crypto.randomUUID()
    : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}-${Math.random().toString(36).slice(2)}`;
}

function read<T>(key: string): T | null {
  try { return JSON.parse(localStorage.getItem(key) ?? "null") as T | null; } catch { return null; }
}

function write(key: string, value: unknown): void {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* private mode or storage full: the ids just won't persist */ }
}

/** A browser signal not to be tracked, or the reader's own choice in Settings. */
export function browserOptsOut(): boolean {
  const nav = navigator as Navigator & { globalPrivacyControl?: boolean; msDoNotTrack?: string };
  const win = window as Window & { doNotTrack?: string };
  return nav.globalPrivacyControl === true || nav.doNotTrack === "1" || nav.doNotTrack === "yes" || win.doNotTrack === "1" || nav.msDoNotTrack === "1";
}

export function analyticsOptedOut(): boolean {
  try { if (localStorage.getItem(OPT_OUT_KEY) === "1") return true; } catch { /* no storage: fall through to the browser's signal */ }
  return browserOptsOut();
}

/** Settings' switch. Opting out also forgets the ids. */
export function setAnalyticsOptOut(optOut: boolean): void {
  try {
    if (optOut) {
      localStorage.setItem(OPT_OUT_KEY, "1");
      for (const key of [VISITOR_KEY, SESSION_KEY, LEGACY_VISITOR_KEY]) localStorage.removeItem(key);
    } else localStorage.removeItem(OPT_OUT_KEY);
  } catch { /* nothing stored, nothing to forget */ }
}

// used when localStorage is unavailable, so one page load still hangs together
const fallback = { visitor: "", session: "" };

function visitor(now: number): { id: string; isNew: boolean } {
  const today = istDay(now);
  const stored = read<{ id: string; since: string }>(VISITOR_KEY);
  if (stored?.id) return { id: stored.id, isNew: stored.since === today };
  let legacy: string | null = null;
  try { legacy = localStorage.getItem(LEGACY_VISITOR_KEY); } catch { /* none */ }
  const record = legacy && legacy.length >= 12 ? { id: legacy.replace(/[^A-Za-z0-9-]/g, "").slice(0, 64), since: "earlier" } : { id: randomId(), since: today };
  write(VISITOR_KEY, record);
  if (read<{ id: string }>(VISITOR_KEY)?.id !== record.id) return { id: (fallback.visitor ||= randomId()), isNew: true };
  return { id: record.id, isNew: record.since === today };
}

function session(now: number): { id: string; isEntry: boolean } {
  const stored = read<{ id: string; last: number }>(SESSION_KEY);
  if (stored?.id && now - stored.last < SESSION_GAP_MS) return { id: stored.id, isEntry: false };
  const id = randomId();
  write(SESSION_KEY, { id, last: now });
  if (read<{ id: string }>(SESSION_KEY)?.id !== id) {
    // no storage: the session is this page load, entered by its first view
    const isEntry = !fallback.session;
    fallback.session ||= randomId();
    return { id: fallback.session, isEntry };
  }
  return { id, isEntry: true };
}

function touchSession(id: string, now: number): void {
  if (read<{ id: string }>(SESSION_KEY)?.id === id) write(SESSION_KEY, { id, last: now });
}

function send(beacon: Beacon): void {
  const body = JSON.stringify(beacon);
  try {
    // survives the page being closed; text/plain needs no preflight
    if (navigator.sendBeacon?.(ENDPOINT, new Blob([body], { type: "text/plain" }))) return;
  } catch { /* fall back to fetch */ }
  try { void fetch(ENDPOINT, { method: "POST", body, keepalive: true, headers: { "Content-Type": "text/plain" } }).catch(() => undefined); } catch { /* analytics must never affect reading */ }
}

/** How far down the page the bottom of the viewport is, 0–100: the article body on articles, the document elsewhere. */
function scrollDepth(kind: PageKind): number | null {
  const body = kind === "article" ? document.querySelector<HTMLElement>(".reader-body") : null;
  const viewportBottom = window.scrollY + window.innerHeight;
  if (body) {
    const r = body.getBoundingClientRect();
    if (r.height <= 0) return null;
    return Math.round(Math.max(0, Math.min(1, (viewportBottom - (r.top + window.scrollY)) / r.height)) * 100);
  }
  const height = document.documentElement.scrollHeight;
  return height > 0 ? Math.round(Math.max(0, Math.min(1, viewportBottom / height)) * 100) : null;
}

function referrerHost(): string {
  try { return document.referrer ? new URL(document.referrer).hostname : ""; } catch { return ""; }
}

const MEDIA_EVENTS = ["play", "pause", "ended", "volumechange"];

/** Audible playback only: a muted autoplaying preview is decoration, not someone watching. */
function mediaPlaying(): boolean {
  return Array.from(document.querySelectorAll<HTMLMediaElement>("video, audio")).some((media) => !media.paused && !media.ended && !media.muted && media.volume > 0);
}

/** Focus inside an embedded player (a YouTube iframe) is still the reader on this page. */
function pageHasFocus(): boolean {
  return document.hasFocus() || document.activeElement instanceof HTMLIFrameElement;
}

// The first view of a page load is the one that arrived from outside; the rest are in-app navigations.
let firstViewId: string | null = null;

/**
 * Starts tracking one page view and returns its stop function. Pass the same
 * `viewId` again (React StrictMode re-running an effect) and it stays one view.
 */
export function trackPageView(info: PageInfo, viewId: string = randomId()): () => void {
  if (typeof window === "undefined" || analyticsOptedOut()) return () => undefined;
  const startedAt = Date.now();
  firstViewId ??= viewId;
  const fromOutside = firstViewId === viewId;
  const who = visitor(startedAt);
  const sess = session(startedAt);
  const params = new URLSearchParams(window.location.search);
  const base: Omit<Beacon, "ev" | "e" | "sd"> = {
    id: viewId,
    v: who.id,
    s: sess.id,
    k: info.kind,
    p: window.location.pathname,
    ...(info.kind === "article" && info.articleId ? { a: info.articleId, c: info.categories ?? [] } : {}),
    ...(fromOutside ? { rh: referrerHost(), us: params.get("utm_source") ?? undefined, um: params.get("utm_medium") ?? undefined } : { internal: true }),
    nv: who.isNew,
    en: sess.isEntry,
    tp: navigator.maxTouchPoints > 1,
    wd: navigator.webdriver === true,
  };

  const clock = new ActiveClock(startedAt, { visible: document.visibilityState === "visible", focused: pageHasFocus(), mediaPlaying: mediaPlaying() });
  let furthest = scrollDepth(info.kind) ?? 0;
  let lastSentSeconds = 0;
  const beacon = (ev: BeaconEvent) => {
    // opting out in Settings stops the page already open, not just the next one
    if (analyticsOptedOut()) return;
    const now = Date.now();
    furthest = Math.max(furthest, scrollDepth(info.kind) ?? 0);
    const e = clock.seconds(now);
    // only reading keeps the session going; a tab left open overnight does not
    if (ev === "start" || e > lastSentSeconds) touchSession(sess.id, now);
    lastSentSeconds = e;
    send({ ...base, ev, e, sd: furthest });
  };

  let scrollFrame = 0;
  let lastMove = 0;
  const onScroll = () => {
    clock.interact(Date.now());
    if (scrollFrame) return;
    scrollFrame = requestAnimationFrame(() => { scrollFrame = 0; furthest = Math.max(furthest, scrollDepth(info.kind) ?? 0); });
  };
  const onInteract = () => clock.interact(Date.now());
  const onPointerMove = () => { const now = Date.now(); if (now - lastMove > 1000) { lastMove = now; clock.interact(now); } };
  const onVisibility = () => {
    const visible = document.visibilityState === "visible";
    clock.update(Date.now(), { visible, focused: pageHasFocus() });
    beacon(visible ? "ping" : "end");
  };
  const onFocus = () => clock.update(Date.now(), { focused: true });
  // blur fires when focus moves into an iframe on the page too; check after it settles
  const onBlur = () => window.setTimeout(() => clock.update(Date.now(), { focused: pageHasFocus() }), 0);
  const onMedia = () => clock.update(Date.now(), { mediaPlaying: mediaPlaying() });
  const onPageHide = () => beacon("end");
  const onPageShow = (event: PageTransitionEvent) => { if (event.persisted) { clock.update(Date.now(), { visible: true, focused: pageHasFocus() }); beacon("ping"); } };

  const passive = { passive: true } as const;
  window.addEventListener("scroll", onScroll, passive);
  window.addEventListener("wheel", onInteract, passive);
  window.addEventListener("touchstart", onInteract, passive);
  window.addEventListener("pointerdown", onInteract, passive);
  window.addEventListener("pointermove", onPointerMove, passive);
  window.addEventListener("keydown", onInteract);
  window.addEventListener("focus", onFocus);
  window.addEventListener("blur", onBlur);
  window.addEventListener("pagehide", onPageHide);
  window.addEventListener("pageshow", onPageShow);
  document.addEventListener("visibilitychange", onVisibility);
  // media events do not bubble, but they can be caught on the way down
  for (const type of MEDIA_EVENTS) document.addEventListener(type, onMedia, true);
  const ticker = window.setInterval(() => clock.tick(Date.now()), 1000);
  // only while it is being read: a tab left open on a second screen has nothing new to say, and would look live
  const pinger = window.setInterval(() => { if (document.visibilityState === "visible" && clock.seconds(Date.now()) > lastSentSeconds) beacon("ping"); }, PING_MS);

  beacon("start");

  return () => {
    window.clearInterval(ticker);
    window.clearInterval(pinger);
    if (scrollFrame) cancelAnimationFrame(scrollFrame);
    window.removeEventListener("scroll", onScroll);
    window.removeEventListener("wheel", onInteract);
    window.removeEventListener("touchstart", onInteract);
    window.removeEventListener("pointerdown", onInteract);
    window.removeEventListener("pointermove", onPointerMove);
    window.removeEventListener("keydown", onInteract);
    window.removeEventListener("focus", onFocus);
    window.removeEventListener("blur", onBlur);
    window.removeEventListener("pagehide", onPageHide);
    window.removeEventListener("pageshow", onPageShow);
    document.removeEventListener("visibilitychange", onVisibility);
    for (const type of MEDIA_EVENTS) document.removeEventListener(type, onMedia, true);
    beacon("end");
  };
}
