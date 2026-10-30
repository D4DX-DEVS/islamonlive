import { createCipheriv, createDecipheriv, createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { DATA_SOURCE, WP_URL } from "@/lib/env";
import { verifyPassword } from "@/lib/auth/password";
import { collection } from "@/lib/db/client";
import { adminRest } from "@/lib/admin-rest";
import type { AdminUser } from "@/lib/admin-rest/http";
import type { UserDoc } from "@/lib/db/types";

const SESSION_COOKIE = "iol_admin_session_v2";
const SESSION_TTL = 8 * 60 * 60;
// Matches WordPress's own "Remember Me" cookie lifetime.
const REMEMBER_TTL = 14 * 24 * 60 * 60;

type AdminSession = {
  username: string;
  userId: number;
  role: string;
  expiresAt: number;
  /** The user's session_version when this cookie was issued (MongoDB mode). */
  sv?: number;
  // WordPress mode only:
  cookies?: string;
  nonce?: string;
};

/* The key is SHA-256 of this, so the secret's own entropy is all there is: a
   short one can be guessed offline from any cookie and a forged cookie is an
   administrator. Under 16 characters is refused; under 32 still works, so a
   deployment is never locked out by an upgrade, but says so on every start. */
let warnedShortSecret = false;
function sessionSecret(): string {
  const secret = process.env.ADMIN_SESSION_SECRET;
  if (!secret) throw new Error("ADMIN_SESSION_SECRET is not configured");
  if (secret.length < 16) throw new Error("ADMIN_SESSION_SECRET is too short (use 32+ random characters)");
  if (secret.length < 32 && !warnedShortSecret) {
    warnedShortSecret = true;
    console.error("[admin] ADMIN_SESSION_SECRET is shorter than 32 characters. Replace it with `openssl rand -base64 48`.");
  }
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

/* The administrator named in the environment (ADMIN_USER / ADMIN_PASSWORD) signs in
   with that password, so editing the two variables and restarting changes the login.
   It opens only that account, and only while it is an active administrator; the
   account's database password, if it has one, works too. An empty password turns it off. */
function matchesEnvAdmin(username: string, password: string): boolean {
  const name = process.env.ADMIN_USER?.trim() ?? "";
  const secret = process.env.ADMIN_PASSWORD?.trim() ?? "";
  if (!name || !secret || name.toLowerCase() !== username.toLowerCase()) return false;
  // equal-length digests, so the comparison takes the same time whatever was typed
  return timingSafeEqual(createHash("sha256").update(password).digest(), createHash("sha256").update(secret).digest());
}

/** Who signed in, for the audit trail. `viaEnv` marks the ADMIN_PASSWORD route in. */
export interface SignedIn {
  userId: number;
  username: string;
  name: string;
  role: string;
  viaEnv: boolean;
}

async function mongoLogin(username: string, password: string): Promise<{ session: AdminSession; who: SignedIn }> {
  // Look up by username or email, case-insensitive
  const usersCol = await collection("users");
  const user = await usersCol.findOne({
    $or: [
      { username: { $regex: `^${escapeRegex(username)}$`, $options: "i" } },
      { email: { $regex: `^${escapeRegex(username)}$`, $options: "i" } },
    ],
  });

  // Always perform the hashing work to prevent timing attacks, even if user doesn't exist
  // verifyPassword runs a dummy scrypt for a missing or legacy hash, so an unknown username costs the same
  const fromEnv = matchesEnvAdmin(username, password);
  // the right password for a name nobody has: say why on the server, not to the visitor
  if (fromEnv && !user) console.warn(`[admin] ADMIN_USER "${username}" is not a user in the database. Set it to an administrator's username (scripts/admin-user.mjs list).`);
  const byPassword = await verifyPassword(password, user?.password_hash ?? "");
  const verified = byPassword || fromEnv;

  if (!verified || !user) {
    throw new Error("Incorrect username or password");
  }

  // Check if user is active
  if (!user.is_active) {
    throw new Error("Incorrect username or password");
  }

  // Check if user has required role
  const hasRequiredRole = user.role === "administrator" || user.role === "editor" || (user.roles && user.roles.some((r) => r === "administrator" || r === "editor"));

  if (!hasRequiredRole) {
    throw new Error("Incorrect username or password");
  }

  // the environment's password opens an administrator, never an editor
  if (fromEnv && !(user.role === "administrator" || user.roles?.includes("administrator"))) {
    throw new Error("Incorrect username or password");
  }

  return {
    session: {
      username: user.username ?? "",
      userId: user._id,
      role: user.role,
      expiresAt: Math.floor(Date.now() / 1000) + SESSION_TTL,
      sv: user.session_version ?? 0,
    },
    who: { userId: user._id, username: user.username ?? "", name: user.name || user.username || "", role: user.role, viaEnv: !byPassword },
  };
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

  return {
    username,
    userId: 0, // WordPress sessions don't have userId in the cookie; it's in the cookies themselves
    role: "unknown", // WordPress sessions carry role in the nonce validation
    cookies: cookieHeader,
    nonce,
    expiresAt: Math.floor(Date.now() / 1000) + (remember ? REMEMBER_TTL : SESSION_TTL),
  };
}

function escapeRegex(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export async function createAdminSession(username: string, password: string, remember = false): Promise<SignedIn> {
  const trimmedUsername = username.trim();
  const { session, who } = DATA_SOURCE === "mongo"
    ? await mongoLogin(trimmedUsername, password)
    : { session: await wordpressLogin(trimmedUsername, password, remember), who: { userId: 0, username: trimmedUsername, name: trimmedUsername, role: "unknown", viaEnv: false } };

  // In mongo mode, adjust TTL for remember flag
  if (DATA_SOURCE === "mongo" && remember) {
    session.expiresAt = Math.floor(Date.now() / 1000) + REMEMBER_TTL;
  }

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
  return who;
}

const isStaff = (user: UserDoc) =>
  user.role === "administrator" || user.role === "editor" || Boolean(user.roles?.some((r) => r === "administrator" || r === "editor"));

/* The cookie alone proves only that it was issued once. In MongoDB mode every
   read also checks the account as it is now — still there, still active, still
   staff, and not signed out or re-passworded since (session_version) — so
   logout, a reset, a deactivation or a demotion ends the session on the next
   request rather than when the cookie expires. */
export async function getAdminSessionUser(): Promise<{ session: AdminSession; user: UserDoc | null } | null> {
  const session = unpack((await cookies()).get(SESSION_COOKIE)?.value);
  if (!session) return null;
  if (DATA_SOURCE !== "mongo") return { session, user: null };
  // sessions from before the mongo migration carry no userId
  if (!session.userId) return null;
  const user = await (await collection("users")).findOne({ _id: session.userId });
  if (!user || !user.is_active || !isStaff(user)) return null;
  if ((user.session_version ?? 0) !== (session.sv ?? 0)) return null;
  return { session, user };
}

export async function getAdminSession(): Promise<AdminSession | null> {
  return (await getAdminSessionUser())?.session ?? null;
}

/** Ends every session of the signed-in account, on every device. Returns who that was. */
export async function revokeAdminSessions(): Promise<UserDoc | null> {
  if (DATA_SOURCE !== "mongo") return null;
  const current = await getAdminSessionUser().catch(() => null);
  if (!current?.user) return null;
  await (await collection("users")).updateOne({ _id: current.user._id }, { $inc: { session_version: 1 } });
  return current.user;
}

/** Re-stamps the current cookie with the account's present session_version, keeping its expiry: for a change that bumped it on purpose. */
export async function reissueAdminSession(): Promise<void> {
  if (DATA_SOURCE !== "mongo") return;
  const store = await cookies();
  const session = unpack(store.get(SESSION_COOKIE)?.value);
  if (!session) return;
  const user = await (await collection("users")).findOne({ _id: session.userId }, { projection: { session_version: 1 } });
  const maxAge = session.expiresAt - Math.floor(Date.now() / 1000);
  if (!user || maxAge <= 0) return;
  store.set(SESSION_COOKIE, pack({ ...session, sv: user.session_version ?? 0 }), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge,
  });
}

async function mongoSignedRequest(path: string, init: RequestInit): Promise<Response> {
  const user = (await getAdminSessionUser())?.user;
  if (!user) throw new Error("Admin authentication required");

  // Call the in-process adminRest function
  const adminUser: AdminUser = {
    id: user._id,
    username: user.username ?? "",
    role: user.role,
    name: user.name || user.username || "",
  };

  return adminRest(path, init, adminUser);
}

async function wordpressSignedRequest(url: string, init: RequestInit): Promise<Response> {
  const session = await getAdminSession();
  if (!session) throw new Error("Admin authentication required");
  const headers = new Headers(init.headers);
  headers.set("Cookie", session.cookies!);
  headers.set("X-WP-Nonce", session.nonce!);
  headers.set("Accept", "application/json");
  return fetch(url, { ...init, headers, cache: "no-store" });
}

/** A signed-in call to the core REST API, `path` being relative to `/wp-json/wp/v2`. */
export async function wpAdminFetch(path: string, init: RequestInit = {}): Promise<Response> {
  if (DATA_SOURCE === "mongo") {
    return mongoSignedRequest(`/wp/v2${path}`, init);
  }
  return wordpressSignedRequest(`${WP_URL}/wp-json/wp/v2${path}`, init);
}

/** A signed-in call to a plugin's REST namespace, `path` starting at it: "/rsfv/v1/posts/update-video". */
export async function wpAdminRoute(path: string, init: RequestInit = {}): Promise<Response> {
  if (DATA_SOURCE === "mongo") {
    return mongoSignedRequest(path, init);
  }
  return wordpressSignedRequest(`${WP_URL}/wp-json${path}`, init);
}

export function sessionCookieName(): string {
  return SESSION_COOKIE;
}
