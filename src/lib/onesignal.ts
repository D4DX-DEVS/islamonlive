import { SITE_URL } from "@/lib/env";
import { rewriteUrl } from "@/lib/urls";
import { createHash } from "node:crypto";
import type { NextRequest } from "next/server";

/* Server-side OneSignal plumbing, shared by /api/notify (new-post push) and
   /api/reminder (the daily reading nudge). Never import this from a client
   component — it carries the REST key. */

export const APP_ID = process.env.NEXT_PUBLIC_ONESIGNAL_APP_ID ?? "";
const REST_KEY = process.env.ONESIGNAL_REST_API_KEY ?? "";
const SECRET = process.env.NOTIFY_SECRET ?? "";
// Vercel Cron sends `Authorization: Bearer $CRON_SECRET` on scheduled hits. Using
// it keeps NOTIFY_SECRET out of vercel.json, which is committed.
const CRON_SECRET = process.env.CRON_SECRET ?? "";

/* from lib/env so push payloads link wherever the site is actually deployed
   (production, staging) rather than at a baked-in host. Re-exported as SITE
   because callers already import that name; a bare `export ... from` would not
   create the local binding this module uses further down. */
export const SITE = SITE_URL;

// new OneSignal apps call the everyone-segment "Total Subscriptions"; apps created
// before the rename still answer to "Subscribed Users" — try both before failing
export const SEGMENTS = ["Total Subscriptions", "Subscribed Users"];

/* OneSignal dedupes on external_id, but only accepts a UUID. Hashing the key into
   UUID shape makes a send idempotent — a plugin that retries, or a cron that runs
   twice, can't double-send. */
export function uuidFor(key: string): string {
  const h = createHash("sha1").update(key).digest("hex");
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-4${h.slice(13, 16)}-8${h.slice(17, 20)}-${h.slice(20, 32)}`;
}

export function authed(req: NextRequest): boolean {
  // the scheduled run carries no secret of ours — Vercel signs it with CRON_SECRET
  if (CRON_SECRET && req.headers.get("authorization") === `Bearer ${CRON_SECRET}`) return true;
  if (!SECRET) return false; // no secret configured = endpoint stays shut
  const given = req.headers.get("x-notify-secret") ?? req.nextUrl.searchParams.get("secret") ?? "";
  return given === SECRET;
}

export function configured(): boolean {
  return Boolean(APP_ID && REST_KEY);
}

export interface SendResult {
  ok: boolean;
  id?: string;
  segment?: string;
  error?: string;
}

/** POST one notification body to OneSignal. Callers supply the audience —
    `included_segments` for everyone, `filters` for a tagged slice. */
export async function post(body: Record<string, unknown>): Promise<SendResult> {
  if (!configured()) return { ok: false, error: "OneSignal not configured" };
  const res = await fetch("https://api.onesignal.com/notifications", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Key ${REST_KEY}` },
    body: JSON.stringify({ app_id: APP_ID, ...body }),
    cache: "no-store",
  });
  const json = (await res.json().catch(() => ({}))) as { id?: string; errors?: unknown };
  if (res.ok && !json.errors) return { ok: true, id: json.id };
  return { ok: false, error: JSON.stringify(json.errors ?? json) };
}

/** the tags OneSignal holds for one subscription, or null when it doesn't exist.
    /api/reminder uses it to check a catch-up request really is the reader's own
    subscription asking for its own slot. */
export async function subscriptionTags(id: string): Promise<Record<string, string> | null> {
  if (!configured()) return null;
  const res = await fetch(`https://api.onesignal.com/players/${id}?app_id=${APP_ID}`, {
    headers: { Authorization: `Key ${REST_KEY}` },
    cache: "no-store",
  });
  if (!res.ok) return null;
  const json = (await res.json().catch(() => ({}))) as { tags?: Record<string, string> };
  return json.tags ?? {};
}

/** stop a notification that hasn't gone out yet — a reader who moves their
    reminder twice in a day shouldn't get the first time as well as the second */
export async function cancel(id: string): Promise<boolean> {
  if (!configured()) return false;
  const res = await fetch(`https://api.onesignal.com/notifications/${id}?app_id=${APP_ID}`, {
    method: "DELETE",
    headers: { Authorization: `Key ${REST_KEY}` },
    cache: "no-store",
  });
  return res.ok;
}

export interface Push {
  title: string;
  message: string;
  url: string;
  image?: string;
  externalId?: string;
}

/* the shared visual shape of every push this site sends

   The image goes through rewriteUrl() because the callers hand over whatever
   WordPress gave them: /api/notify's POST takes the plugin's `image` field, and
   both cron routes read featuredImage(), which deliberately returns the
   *origin* URL on admin.islamonlive.in because its other consumer is next/image
   (see lib/urls.ts). A push payload is not next/image — the URL in it is
   fetched by the reader's browser and shown in the notification, so shipping
   the backend host there breaks the day that host is firewalled or moved, and
   it is the one address lib/env.ts says a reader must never be handed. The
   apex serves the identical bytes through the /wp-content proxy, already behind
   the CDN.

   rewriteUrl() rather than mediaUrl(): mediaUrl() rewrites only what it
   recognises as an uploads path and hands back anything else untouched, so a
   backend URL that is not a plain /wp-content/… — /api/notify's POST takes the
   image straight from the plugin's payload — would pass through with the admin
   host still on it. rewriteUrl() has the host fallback that closes that, and
   its withTrailingSlash() leaves a filename alone, so a .jpg does not acquire a
   slash on the way out. */
export function baseBody(p: Push): Record<string, unknown> {
  const image = p.image ? rewriteUrl(p.image, true) : undefined;
  return {
    headings: { en: p.title },
    contents: { en: p.message || p.title },
    url: p.url,
    chrome_web_icon: `${SITE}/icon-192.png`,
    ...(image ? { chrome_web_image: image, big_picture: image } : {}),
    ...(p.externalId ? { external_id: uuidFor(p.externalId), idempotency_key: uuidFor(p.externalId) } : {}),
  };
}

/** broadcast to everyone subscribed */
export async function sendToAll(p: Push): Promise<SendResult> {
  if (!configured()) return { ok: false, error: "OneSignal not configured" };
  let last = "";
  for (const segment of SEGMENTS) {
    const out = await post({ ...baseBody(p), included_segments: [segment] });
    if (out.ok) return { ...out, segment };
    last = out.error ?? "";
  }
  return { ok: false, error: last };
}
