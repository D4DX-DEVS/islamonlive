import { createHash } from "node:crypto";
import { NextResponse } from "next/server";
import { createAdminSession } from "@/lib/wp-admin";
import { clientAddress } from "@/lib/client-address";
import { recordActivity } from "@/lib/activity";
import { DATA_SOURCE } from "@/lib/env";

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
    const who = await createAdminSession(body.username, body.password, body.remember === true);
    if (DATA_SOURCE === "mongo") {
      await recordActivity({ id: who.userId, name: who.name, role: who.role }, "auth.login", {
        type: "user",
        id: who.userId,
        // the environment password is a standing way in; every use of it should be visible
        title: `${who.name}${who.viaEnv ? " (with the ADMIN_PASSWORD environment password)" : ""} from ${address.slice(3)}`,
        link: null,
      });
    }
    return NextResponse.json({ ok: true });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "";
    if (CREDENTIAL_ERROR.test(message)) {
      /* Failures go to the log, not the audit collection: a guessing run would
         otherwise fill it. One JSON line each, for the DO log search; never the password. */
      // the name is hashed: people type their password into the username box, and that must not reach the logs
      const user = createHash("sha256").update(body.username.trim().toLowerCase()).digest("hex").slice(0, 16);
      console.warn(JSON.stringify({ event: "admin_login_failed", ip: address.slice(3), user_sha256_16: user, at: new Date(now).toISOString() }));
      // one message for every wrong-credential case, so it never tells which half was wrong
      return NextResponse.json({ error: "Incorrect username or password." }, { status: 401 });
    }
    // configuration or database trouble: say so without handing internals to an anonymous caller
    console.error(`admin login failed: ${error instanceof Error ? error.name : "unknown error"}`);
    return NextResponse.json({ error: "Sign-in is unavailable right now. Try again shortly." }, { status: 503 });
  }
}
