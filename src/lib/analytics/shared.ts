/* Reader analytics: what the browser tracker and the server agree on.
   Client-safe (no Node or database imports). See docs/analytics-plan.md. */

/** What kind of page a view is of. Articles carry an id and categories; the rest only a path. */
export const PAGE_KINDS = ["article", "home", "category", "tag", "author", "page", "search", "listen", "watch", "other"] as const;
export type PageKind = (typeof PAGE_KINDS)[number];

export const SOURCES = ["direct", "search", "social", "referral", "internal", "email", "campaign"] as const;
export type Source = (typeof SOURCES)[number];

export const DEVICES = ["mobile", "tablet", "desktop"] as const;
export type Device = (typeof DEVICES)[number];

/** A ping while the tab is visible: keeps "live now" fresh and saves progress. */
export const PING_MS = 30_000;
/** No scroll, key, pointer or touch for this long and the reader is idle: the clock stops. */
export const IDLE_MS = 30_000;
/** No single view is credited with more active time than this. */
export const MAX_ACTIVE_SECONDS = 4 * 60 * 60;
/** A session ends after this long without a page view or ping (GA's rule). */
export const SESSION_GAP_MS = 30 * 60_000;
/** Seen within this long ago counts as "live now". */
export const LIVE_WINDOW_MS = 2 * 60_000;
/** GA4: a session is engaged with at least this much active time (or two page views). */
export const ENGAGED_SESSION_SECONDS = 10;
/** Scroll depths the dashboard reports reads reaching, in percent. 90 % counts as finished. */
export const SCROLL_MARKS = [25, 50, 75, 90] as const;
export const COMPLETE_AT = 90;

export type BeaconEvent = "start" | "ping" | "end";

/** What the browser sends. Totals so far, never deltas, so a repeated or late beacon changes nothing. */
export type Beacon = {
  /** this page view, random, created once per page mount */
  id: string;
  /** random visitor id (localStorage) */
  v: string;
  /** session id, renewed after SESSION_GAP_MS without activity */
  s: string;
  ev: BeaconEvent;
  k: PageKind;
  /** path of the page, no query string */
  p: string;
  /** article id */
  a?: number;
  /** article category ids */
  c?: number[];
  /** referring host on the first view of a page load ("" for none); in-app navigations send `internal: true` instead */
  rh?: string;
  internal?: boolean;
  /** utm_source / utm_medium, when the link had them */
  us?: string;
  um?: string;
  /** first day this browser was seen is today */
  nv?: boolean;
  /** first page view of the session */
  en?: boolean;
  /** active seconds so far */
  e: number;
  /** furthest scroll depth so far, 0–100 */
  sd: number;
  /** a touch screen (iPadOS reports itself as a Mac) */
  tp?: boolean;
  /** navigator.webdriver: an automated browser */
  wd?: boolean;
};

const IST_OFFSET_MS = 330 * 60_000;

/** The site's calendar day (IST) of a moment, as YYYY-MM-DD. */
export function istDay(ms: number): string {
  return new Date(ms + IST_OFFSET_MS).toISOString().slice(0, 10);
}

/** Midnight IST at the start of a YYYY-MM-DD day, as epoch ms. */
export function istDayStart(day: string): number {
  return Date.parse(`${day}T00:00:00.000Z`) - IST_OFFSET_MS;
}

/** The day `n` days after (or before, when negative) a YYYY-MM-DD day. */
export function addDays(day: string, n: number): string {
  return new Date(Date.parse(`${day}T00:00:00.000Z`) + n * 86_400_000).toISOString().slice(0, 10);
}
