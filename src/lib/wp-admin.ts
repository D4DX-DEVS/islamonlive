import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { WP_URL } from "@/lib/env";

const SESSION_COOKIE = "iol_admin_session_v2";
const SESSION_TTL = 8 * 60 * 60;
// Matches WordPress's own "Remember Me" cookie lifetime.
const REMEMBER_TTL = 14 * 24 * 60 * 60;

type AdminSession = {
  username: string;
  cookies: string;
  nonce: string;
  expiresAt: number;
};

function sessionSecret(): string {
  const secret = process.env.ADMIN_SESSION_SECRET;
  if (!secret) throw new Error("ADMIN_SESSION_SECRET is not configured");
  return secret;
}

function encryptionKey(): Buffer {
  return createHash("sha256").update(sessionSecret()).digest();
}

function pack(session: AdminSession): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", encryptionKey(), iv);
  const encrypted = Buffer.concat([cipher.update(JSON.stringify(session), "utf8"), cipher.final()]);
  return Buffer.concat([iv, cipher.getAuthTag(), encrypted]).toString("base64url");
}

function unpack(value: string | undefined): AdminSession | null {
  if (!value) return null;
  try {
    const encoded = Buffer.from(value, "base64url");
    if (encoded.length < 29) return null;
    const decipher = createDecipheriv("aes-256-gcm", encryptionKey(), encoded.subarray(0, 12));
    decipher.setAuthTag(encoded.subarray(12, 28));
    const plain = Buffer.concat([decipher.update(encoded.subarray(28)), decipher.final()]).toString("utf8");
    const session = JSON.parse(plain) as AdminSession;
    return session.expiresAt > Math.floor(Date.now() / 1000) ? session : null;
  } catch {
    return null;
  }
}

function setCookieHeader(setCookies: string[]): string {
  return setCookies.map((value) => value.split(";", 1)[0]).filter(Boolean).join("; ");
}

function getSetCookies(response: Response): string[] {
  const headers = response.headers as Headers & { getSetCookie?: () => string[] };
  if (typeof headers.getSetCookie === "function") return headers.getSetCookie();
  const combined = response.headers.get("set-cookie");
  return combined ? combined.split(/,(?=[^;]+?=)/) : [];
}

function extractNonce(html: string): string | null {
  const apiSettings = html.match(/wpApiSettings\s*=\s*\{[^}]*["']nonce["']\s*:\s*["']([A-Za-z0-9_-]{8,})["']/);
  if (apiSettings?.[1]) return apiSettings[1];
  const match = html.match(/(?:"nonce"|nonce)\s*[:=]\s*["']([A-Za-z0-9_-]{8,})["']/);
  return match?.[1] ?? null;
}

async function wordpressLogin(username: string, password: string, remember: boolean): Promise<AdminSession> {
  const testCookie = "wordpress_test_cookie=WP+Cookie+check";
  const form = new URLSearchParams({
    log: username,
    pwd: password,
    "wp-submit": "Log In",
    ...(remember ? { rememberme: "forever" } : {}),
    redirect_to: `${WP_URL}/wp-admin/`,
    testcookie: "1",
  });
  const login = await fetch(`${WP_URL}/wp-login.php`, {
    method: "POST",
    redirect: "manual",
    headers: { "Content-Type": "application/x-www-form-urlencoded", Cookie: testCookie },
    body: form,
    cache: "no-store",
  });
  const loginCookies = getSetCookies(login);
  const cookieHeader = setCookieHeader([testCookie, ...loginCookies]);
  if (!cookieHeader.includes("wordpress_logged_in_") && !cookieHeader.includes("wordpress_sec_")) {
    throw new Error("WordPress rejected the username or password");
  }

  // WordPress prints a REST nonce in the editor/admin shell. Fetching the editor
  // page also proves the account can access the content-management endpoints.
  const admin = await fetch(`${WP_URL}/wp-admin/post-new.php`, {
    headers: { Cookie: cookieHeader },
    cache: "no-store",
  });
  const nonce = extractNonce(await admin.text());
  if (!nonce) throw new Error("WordPress did not provide a REST nonce for this account");

  return { username, cookies: cookieHeader, nonce, expiresAt: Math.floor(Date.now() / 1000) + (remember ? REMEMBER_TTL : SESSION_TTL) };
}

export async function createAdminSession(username: string, password: string, remember = false): Promise<void> {
  const session = await wordpressLogin(username.trim(), password, remember);
  const store = await cookies();
  // Clear the earlier development build's narrower cookie if one exists.
  store.set(SESSION_COOKIE, "", { httpOnly: true, expires: new Date(0), path: "/admin" });
  store.set(SESSION_COOKIE, pack(session), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    // The dashboard calls /api/admin/* as well as /admin. The cookie remains
    // HTTP-only and encrypted; root scope is required for those API requests.
    path: "/",
    maxAge: remember ? REMEMBER_TTL : SESSION_TTL,
  });
}

export async function getAdminSession(): Promise<AdminSession | null> {
  return unpack((await cookies()).get(SESSION_COOKIE)?.value);
}

async function signedRequest(url: string, init: RequestInit): Promise<Response> {
  const session = await getAdminSession();
  if (!session) throw new Error("Admin authentication required");
  const headers = new Headers(init.headers);
  headers.set("Cookie", session.cookies);
  headers.set("X-WP-Nonce", session.nonce);
  headers.set("Accept", "application/json");
  return fetch(url, { ...init, headers, cache: "no-store" });
}

/** A signed-in call to the core REST API, `path` being relative to `/wp-json/wp/v2`. */
export function wpAdminFetch(path: string, init: RequestInit = {}): Promise<Response> {
  return signedRequest(`${WP_URL}/wp-json/wp/v2${path}`, init);
}

/** A signed-in call to a plugin's REST namespace, `path` starting at it: "/rsfv/v1/posts/update-video". */
export function wpAdminRoute(path: string, init: RequestInit = {}): Promise<Response> {
  return signedRequest(`${WP_URL}/wp-json${path}`, init);
}

export function sessionCookieName(): string {
  return SESSION_COOKIE;
}
