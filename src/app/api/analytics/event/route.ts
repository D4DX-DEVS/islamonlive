import { NextResponse } from "next/server";
import { forwardToGoogleAnalytics, normaliseEvent, recordAnalyticsEvent } from "@/lib/analytics";

const attempts = new Map<string, { startedAt: number; count: number }>();
const WINDOW_MS = 60_000;
const MAX_EVENTS_PER_WINDOW = 120;

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
  await recordAnalyticsEvent(event);
  await forwardToGoogleAnalytics(event);
  return new NextResponse(null, { status: 204 });
}
