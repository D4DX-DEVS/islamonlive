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

export const SITE = "https://islamonlive.in";

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

export interface Push {
  title: string;
  message: string;
  url: string;
  image?: string;
  externalId?: string;
}

/** the shared visual shape of every push this site sends */
export function baseBody(p: Push): Record<string, unknown> {
  return {
    headings: { en: p.title },
    contents: { en: p.message || p.title },
    url: p.url,
    chrome_web_icon: `${SITE}/icon-192.png`,
    ...(p.image ? { chrome_web_image: p.image, big_picture: p.image } : {}),
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
