import { NextResponse } from "next/server";
import { createAdminSession } from "@/lib/wp-admin";

export const dynamic = "force-dynamic";

const attempts = new Map<string, { startedAt: number; count: number }>();
const WINDOW_MS = 10 * 60_000;
const MAX_ATTEMPTS = 10;

export async function POST(request: Request) {
  const address = (request.headers.get("x-forwarded-for") || request.headers.get("x-real-ip") || "unknown").split(",")[0].trim().slice(0, 96);
  const now = Date.now();
  const previous = attempts.get(address);
  const bucket = !previous || now - previous.startedAt >= WINDOW_MS ? { startedAt: now, count: 0 } : previous;
  if (bucket.count >= MAX_ATTEMPTS) return NextResponse.json({ error: "Too many login attempts. Try again later." }, { status: 429 });
  const body = await request.json().catch(() => null) as { username?: string; password?: string } | null;
  if (!body?.username || !body.password) return NextResponse.json({ error: "Username and password are required" }, { status: 400 });
  bucket.count += 1;
  attempts.set(address, bucket);
  if (attempts.size > 10_000) for (const [key, value] of attempts) if (now - value.startedAt >= WINDOW_MS) attempts.delete(key);
  try {
    await createAdminSession(body.username, body.password);
    return NextResponse.json({ ok: true });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "WordPress login failed";
    return NextResponse.json({ error: message }, { status: 401 });
  }
}
