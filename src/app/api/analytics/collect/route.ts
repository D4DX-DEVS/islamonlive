import { NextResponse } from "next/server";
import { isBot, normaliseBeacon } from "@/lib/analytics/classify";
import { recordBeacon } from "@/lib/analytics/store";
import { rollUpYesterday } from "@/lib/analytics/aggregate";
import { clientAddress } from "@/lib/client-address";
import { SITE_URL } from "@/lib/env";

/* Reader beacons from lib/analytics/tracker.ts. Sent with navigator.sendBeacon
   as text/plain (so no CORS preflight), or fetch(keepalive) as a fallback.
   Answers 204 whether or not the view is counted: bots and signed-in staff are
   dropped quietly, and a reader's page never waits on, or reacts to, this. */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const STAFF_COOKIE = "iol_admin_session_v2";
const MAX_BYTES = 4_000;
const WINDOW_MS = 60_000;
// a reader sends a start, a ping every 30 s and an end per page; ten busy tabs stay well inside this
const MAX_PER_WINDOW = 240;
/* Writes this instance may make per second. The database is shared with the
   site's content on a plan capped at about 100 operations a second, so past
   this beacons are dropped rather than queued: a lost ping only delays a view's
   totals, the next one carries them. */
const MAX_WRITES_PER_SECOND = Number(process.env.ANALYTICS_MAX_WRITES_PER_SECOND) || 40;
const SITE_HOST = new URL(SITE_URL).host;

const attempts = new Map<string, { startedAt: number; count: number }>();
let lastSweep = 0;
const budget = { second: 0, used: 0 };
let lastWarning = 0;

function limited(address: string, now: number): boolean {
  const previous = attempts.get(address);
  const bucket = !previous || now - previous.startedAt >= WINDOW_MS ? { startedAt: now, count: 0 } : previous;
  bucket.count += 1;
  attempts.set(address, bucket);
  // sweep at most once a window, so a flood of addresses costs one pass, not one per request
  if (attempts.size > 10_000 && now - lastSweep >= WINDOW_MS) {
    lastSweep = now;
    for (const [key, value] of attempts) if (now - value.startedAt >= WINDOW_MS) attempts.delete(key);
    if (attempts.size > 50_000) attempts.clear();
  }
  return bucket.count > MAX_PER_WINDOW;
}

function overBudget(now: number): boolean {
  const second = Math.floor(now / 1000);
  if (second !== budget.second) { budget.second = second; budget.used = 0; }
  budget.used += 1;
  return budget.used > MAX_WRITES_PER_SECOND;
}

function warnOnce(now: number, ...message: unknown[]): void {
  // a reader sends a beacon every 30 s, so say it once a minute, not once per beacon
  if (now - lastWarning < 60_000) return;
  lastWarning = now;
  console.warn("[analytics]", ...message);
}

/** The body as text, or null past `max` bytes, however it was sent (Content-Length can be absent). */
async function readBody(request: Request, max: number): Promise<string | null> {
  const reader = request.body?.getReader();
  if (!reader) return "";
  const chunks: Uint8Array[] = [];
  let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > max) { await reader.cancel().catch(() => undefined); return null; }
    chunks.push(value);
  }
  return Buffer.concat(chunks).toString("utf8");
}

const noContent = () => new NextResponse(null, { status: 204 });

export async function POST(request: Request): Promise<Response> {
  // a dev server, or a local run against the real database, is someone testing, not a reader
  if (process.env.NODE_ENV === "development" || process.env.ANALYTICS_DISABLED === "1") return noContent();
  // the tracker already stays quiet for these; this covers a page that sent before reading them
  if (request.headers.get("sec-gpc") === "1" || request.headers.get("dnt") === "1") return noContent();
  // browsers say where a request came from; another site making its visitors post here is not reading
  const site = request.headers.get("sec-fetch-site");
  if (site && site !== "same-origin") return noContent();

  const now = Date.now();
  if (limited(clientAddress(request), now)) return NextResponse.json({ error: "Too many analytics events" }, { status: 429 });
  if (Number(request.headers.get("content-length") || 0) > MAX_BYTES) return NextResponse.json({ error: "Analytics event is too large" }, { status: 413 });

  const body = await readBody(request, MAX_BYTES).catch(() => "");
  if (body === null) return NextResponse.json({ error: "Analytics event is too large" }, { status: 413 });
  let parsed: unknown = null;
  try { parsed = JSON.parse(body); } catch { /* refused below */ }
  const beacon = normaliseBeacon(parsed);
  if (!beacon) return NextResponse.json({ error: "Invalid analytics event" }, { status: 400 });

  // staff checking their own articles would inflate the numbers they are reading
  if (request.headers.get("cookie")?.includes(`${STAFF_COOKIE}=`)) return noContent();
  const userAgent = request.headers.get("user-agent") ?? "";
  // the end-to-end check drives a real, automated browser on purpose; crawlers are still dropped
  const automationAllowed = process.env.ANALYTICS_ALLOW_AUTOMATION === "1";
  const asSeen = automationAllowed ? userAgent.replace("HeadlessChrome/", "Chrome/") : userAgent;
  if (isBot(asSeen, automationAllowed ? false : beacon.wd)) return noContent();

  if (overBudget(now)) {
    warnOnce(now, `more than ${MAX_WRITES_PER_SECOND} reader events a second on this instance; dropping the excess`);
    return noContent();
  }
  try {
    await recordBeacon(beacon, { userAgent, siteHost: SITE_HOST, now: new Date(now) });
  } catch (error) {
    warnOnce(now, "reader events are not being saved:", error instanceof Error ? error.message : error);
    return NextResponse.json({ error: "Analytics storage is unavailable" }, { status: 503 });
  }
  // once a day per instance: queue yesterday's rollup in the background, so no day waits on a report to be built
  void rollUpYesterday(now);
  return noContent();
}
