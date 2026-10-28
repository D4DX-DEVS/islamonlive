import { MAX_ACTIVE_SECONDS, PAGE_KINDS, type Beacon, type Device, type PageKind, type Source } from "@/lib/analytics/shared";

/* Server side of reader analytics: checks what a browser sent and works out the
   device and traffic source. Pure, so it is tested without a server. Nothing
   here keeps the User-Agent or the full referrer: only the conclusions are stored. */

const ID = /^[A-Za-z0-9-]{12,64}$/;
const EVENTS = new Set(["start", "ping", "end"]);
const HOST = /^[a-z0-9.-]{1,253}$/;
const LABEL = /^[\p{L}\p{N} ._+-]{1,60}$/u;

function text(value: unknown, pattern: RegExp): string | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim().toLowerCase();
  return pattern.test(trimmed) ? trimmed : undefined;
}

function wholeNumber(value: unknown, max: number): number {
  return typeof value === "number" && Number.isFinite(value) ? Math.max(0, Math.min(max, Math.floor(value))) : 0;
}

/** The beacon if it is well formed, otherwise null. Out-of-range numbers are clamped, not refused. */
export function normaliseBeacon(input: unknown): Beacon | null {
  if (!input || typeof input !== "object") return null;
  const raw = input as Record<string, unknown>;
  const { id, v, s, ev, k, p } = raw;
  if (typeof id !== "string" || !ID.test(id) || typeof v !== "string" || !ID.test(v) || typeof s !== "string" || !ID.test(s)) return null;
  if (typeof ev !== "string" || !EVENTS.has(ev)) return null;
  if (typeof k !== "string" || !(PAGE_KINDS as readonly string[]).includes(k)) return null;
  if (typeof p !== "string" || !p.startsWith("/") || p.startsWith("//") || p.length > 600) return null;
  const beacon: Beacon = { id, v, s, ev: ev as Beacon["ev"], k: k as PageKind, p: p.split(/[?#]/)[0], e: wholeNumber(raw.e, MAX_ACTIVE_SECONDS), sd: wholeNumber(raw.sd, 100) };
  if (k === "article") {
    const article = Number(raw.a);
    if (!Number.isInteger(article) || article < 1) return null;
    beacon.a = article;
    beacon.c = Array.isArray(raw.c) ? [...new Set(raw.c.map(Number).filter((c) => Number.isInteger(c) && c > 0))].slice(0, 20) : [];
  }
  const rh = text(raw.rh, HOST);
  if (rh) beacon.rh = rh;
  if (raw.internal === true) beacon.internal = true;
  const us = text(raw.us, LABEL);
  if (us) beacon.us = us;
  const um = text(raw.um, LABEL);
  if (um) beacon.um = um;
  if (raw.nv === true) beacon.nv = true;
  if (raw.en === true) beacon.en = true;
  if (raw.tp === true) beacon.tp = true;
  if (raw.wd === true) beacon.wd = true;
  return beacon;
}

/* Crawlers, link previewers, monitors and headless browsers. Real browsers all
   say "Mozilla/5.0"; anything else is not a reader either. */
const BOT = /bot\b|bot\/|crawl|spider|slurp|scrape|headless|phantom|lighthouse|pagespeed|pingdom|uptime|monitor|preview|facebookexternalhit|whatsapp\/|discordbot|embedly|quora link|vkshare|python|curl\/|wget|java\/|okhttp|go-http|node-fetch|axios|postman|insomnia/i;

export function isBot(userAgent: string, webdriver = false): boolean {
  return webdriver || !userAgent.startsWith("Mozilla/") || BOT.test(userAgent);
}

export function deviceOf(userAgent: string, touch = false): Device {
  if (/iPad|Tablet|PlayBook|Silk|Kindle|Nexus (7|9|10)|SM-T\d|Tab\b/i.test(userAgent) || (/Android/i.test(userAgent) && !/Mobile/i.test(userAgent))) return "tablet";
  // iPadOS asks for the desktop site and reports itself as a Mac; a touch screen gives it away
  if (touch && /Macintosh/i.test(userAgent)) return "tablet";
  if (/Mobi|iPhone|iPod|Android|Windows Phone|BlackBerry|Opera Mini|IEMobile/i.test(userAgent)) return "mobile";
  return "desktop";
}

const SEARCH = /(^|\.)(google\.[a-z.]+|bing\.com|yahoo\.[a-z.]+|duckduckgo\.com|yandex\.[a-z.]+|baidu\.com|ecosia\.org|naver\.com|startpage\.com|search\.brave\.com|qwant\.com|seznam\.cz|perplexity\.ai|chatgpt\.com|copilot\.microsoft\.com)$|^com\.google\.android\.googlequicksearchbox$|^com\.google\.android\.gm$/;
const SOCIAL = /(^|\.)(facebook\.com|fb\.com|fb\.me|instagram\.com|threads\.net|t\.co|twitter\.com|x\.com|linkedin\.com|lnkd\.in|whatsapp\.com|wa\.me|t\.me|telegram\.org|youtube\.com|youtu\.be|reddit\.com|pinterest\.[a-z.]+|quora\.com|snapchat\.com|tiktok\.com|sharechat\.com)$|^(com\.facebook\.katana|com\.instagram\.android|org\.telegram\.messenger|com\.whatsapp)$/;
const SOCIAL_LABEL = /^(facebook|fb|instagram|ig|twitter|x|linkedin|whatsapp|telegram|youtube|reddit|pinterest|threads|social)$/;
const EMAIL_MEDIUM = /^(e-?mail|newsletter)$/;
const PAID_MEDIUM = /^(cpc|ppc|paid|paidsocial|paid_social|display|banner|ads?)$/;

/** Hosts that are this site: a link from one of them is the reader moving around inside it. */
export function isOwnHost(host: string, siteHost: string): boolean {
  const bare = (h: string) => h.replace(/^www\./, "");
  return bare(host) === bare(siteHost) || host === "admin.islamonlive.in";
}

/**
 * Where the view came from, in the GA sense, and the referring domain or utm_source to show with it.
 * Only the first view of a page load can come from outside; later ones are in-app navigations.
 */
export function sourceOf(beacon: Pick<Beacon, "rh" | "internal" | "us" | "um">, siteHost: string): { src: Source; ref?: string } {
  const { rh, us, um } = beacon;
  if (beacon.internal || (rh && isOwnHost(rh, siteHost) && !us)) return { src: "internal" };
  if (um && EMAIL_MEDIUM.test(um)) return { src: "email", ref: us };
  if (um && PAID_MEDIUM.test(um)) return { src: "campaign", ref: us ?? rh };
  if (rh && SEARCH.test(rh)) return { src: "search", ref: rh };
  if ((rh && SOCIAL.test(rh)) || (us && SOCIAL_LABEL.test(us))) return { src: "social", ref: rh ?? us };
  if (us) return { src: "campaign", ref: us };
  if (rh) return { src: "referral", ref: rh };
  return { src: "direct" };
}
