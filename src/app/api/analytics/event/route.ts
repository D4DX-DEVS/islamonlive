import { NextResponse } from "next/server";
import { forwardToGoogleAnalytics, normaliseEvent, recordAnalyticsEvent } from "@/lib/analytics";

const attempts = new Map<string, { startedAt: number; count: number }>();
const WINDOW_MS = 60_000;
const MAX_EVENTS_PER_WINDOW = 120;
let lastStorageWarning = 0;

export const runtime = "nodejs";

export async function POST(request: Request) {
  const address = (request.headers.get("x-forwarded-for") || request.headers.get("x-real-ip") || "unknown").split(",")[0].trim().slice(0, 96);
  const now = Date.now();
  const previous = attempts.get(address);
  const bucket = !previous || now - previous.startedAt >= WINDOW_MS ? { startedAt: now, count: 0 } : previous;
  bucket.count += 1;
  attempts.set(address, bucket);
  if (attempts.size > 10_000) for (const [key, value] of attempts) if (now - value.startedAt >= WINDOW_MS) attempts.delete(key);
  if (bucket.count > MAX_EVENTS_PER_WINDOW) return NextResponse.json({ error: "Analytics rate limit exceeded" }, { status: 429 });
  const contentLength = Number(request.headers.get("content-length") || 0);
  if (contentLength > 10_000) return NextResponse.json({ error: "Analytics event is too large" }, { status: 413 });
  const event = normaliseEvent(await request.json().catch(() => null));
  if (!event) return NextResponse.json({ error: "Invalid analytics event" }, { status: 400 });
  // These destinations are independent, so run them together to keep the
  // analytics beacon quick. Local persistence remains the success gate; GA is
  // best effort and is already isolated by its helper.
  const [storageResult] = await Promise.allSettled([
    recordAnalyticsEvent(event),
    forwardToGoogleAnalytics(event),
  ]);
  if (storageResult.status === "rejected") {
    // A reader sends ~14 beacons per article, so say so once a minute, not once per beacon.
    if (now - lastStorageWarning > 60_000) { lastStorageWarning = now; console.warn("[analytics] reader events are not being saved:", storageResult.reason instanceof Error ? storageResult.reason.message : storageResult.reason); }
    return NextResponse.json({ error: "Analytics storage is unavailable" }, { status: 503 });
  }
  return new NextResponse(null, { status: 204 });
}
