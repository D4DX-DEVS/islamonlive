import { NextResponse } from "next/server";
import { createAdminSession } from "@/lib/wp-admin";
import { clientAddress } from "@/lib/client-address";

export const dynamic = "force-dynamic";

type Bucket = { startedAt: number; count: number };
const attempts = new Map<string, Bucket>();
const WINDOW_MS = 10 * 60_000;
const MAX_PER_ADDRESS = 10;
// across all addresses: rotating IPs must not buy unlimited guesses at one account
const MAX_PER_ACCOUNT = 20;

function take(key: string, limit: number, now: number): boolean {
  const previous = attempts.get(key);
  const bucket = !previous || now - previous.startedAt >= WINDOW_MS ? { startedAt: now, count: 0 } : previous;
  if (bucket.count >= limit) return false;
  bucket.count += 1;
  attempts.set(key, bucket);
  return true;
}

// the messages a wrong username or password produces in either backend; anything else is ours to keep
const CREDENTIAL_ERROR = /password|username|incorrect|invalid|nonce for this account/i;

export async function POST(request: Request) {
  const now = Date.now();
  const address = `ip:${clientAddress(request)}`;
  const known = attempts.get(address);
  if (known && now - known.startedAt < WINDOW_MS && known.count >= MAX_PER_ADDRESS) return NextResponse.json({ error: "Too many login attempts. Try again later." }, { status: 429 });
  const body = await request.json().catch(() => null) as { username?: unknown; password?: unknown; remember?: boolean } | null;
  if (typeof body?.username !== "string" || typeof body.password !== "string" || !body.username || !body.password) return NextResponse.json({ error: "Username and password are required" }, { status: 400 });
  if (!take(address, MAX_PER_ADDRESS, now) || !take(`user:${body.username.trim().toLowerCase().slice(0, 200)}`, MAX_PER_ACCOUNT, now)) {
    return NextResponse.json({ error: "Too many login attempts. Try again later." }, { status: 429 });
  }
  if (attempts.size > 10_000) for (const [key, value] of attempts) if (now - value.startedAt >= WINDOW_MS) attempts.delete(key);
  try {
    await createAdminSession(body.username, body.password, body.remember === true);
    return NextResponse.json({ ok: true });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "";
    if (CREDENTIAL_ERROR.test(message)) return NextResponse.json({ error: message }, { status: 401 });
    // configuration or database trouble: say so without handing internals to an anonymous caller
    console.error(`admin login failed: ${error instanceof Error ? error.name : "unknown error"}`);
    return NextResponse.json({ error: "Sign-in is unavailable right now. Try again shortly." }, { status: 503 });
  }
}
