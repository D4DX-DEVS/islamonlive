import { createHash } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { getPosts, featuredImage, postPath, stripHtml, decodeEntities } from "@/lib/wordpress";

export const dynamic = "force-dynamic";

const APP_ID = process.env.NEXT_PUBLIC_ONESIGNAL_APP_ID ?? "";
const REST_KEY = process.env.ONESIGNAL_REST_API_KEY ?? "";
const SECRET = process.env.NOTIFY_SECRET ?? "";
// Vercel Cron sends `Authorization: Bearer $CRON_SECRET` on scheduled hits. Using
// it keeps NOTIFY_SECRET out of vercel.json, which is committed.
const CRON_SECRET = process.env.CRON_SECRET ?? "";
const SITE = "https://islamonlive.in";
// new OneSignal apps call the everyone-segment "Total Subscriptions"; apps created
// before the rename still answer to "Subscribed Users" — try both before failing
const SEGMENTS = ["Total Subscriptions", "Subscribed Users"];

/* OneSignal dedupes on external_id, but only accepts a UUID. Hashing the post id
   into UUID shape makes "notify about post 123" idempotent — a plugin that retries,
   or a cron that runs before a new post lands, can't double-send. */
function uuidFor(key: string): string {
  const h = createHash("sha1").update(key).digest("hex");
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-4${h.slice(13, 16)}-8${h.slice(17, 20)}-${h.slice(20, 32)}`;
}

interface Push {
  title: string;
  message: string;
  url: string;
  image?: string;
  externalId?: string;
}

async function send(p: Push) {
  if (!APP_ID || !REST_KEY) return { ok: false, error: "OneSignal not configured" };

  const base: Record<string, unknown> = {
    app_id: APP_ID,
    headings: { en: p.title },
    contents: { en: p.message || p.title },
    url: p.url,
    chrome_web_icon: `${SITE}/icon-192.png`,
    ...(p.image ? { chrome_web_image: p.image, big_picture: p.image } : {}),
    ...(p.externalId ? { external_id: uuidFor(p.externalId), idempotency_key: uuidFor(p.externalId) } : {}),
  };

  let last = "";
  for (const segment of SEGMENTS) {
    const res = await fetch("https://api.onesignal.com/notifications", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Key ${REST_KEY}` },
      body: JSON.stringify({ ...base, included_segments: [segment] }),
      cache: "no-store",
    });
    const body = await res.json().catch(() => ({}));
    if (res.ok && !body.errors) return { ok: true, id: body.id, segment };
    last = JSON.stringify(body.errors ?? body);
  }
  return { ok: false, error: last };
}

function authed(req: NextRequest): boolean {
  // the scheduled run carries no secret of ours — Vercel signs it with CRON_SECRET
  if (CRON_SECRET && req.headers.get("authorization") === `Bearer ${CRON_SECRET}`) return true;
  if (!SECRET) return false; // no secret configured = endpoint stays shut
  const given = req.headers.get("x-notify-secret") ?? req.nextUrl.searchParams.get("secret") ?? "";
  return given === SECRET;
}

/* Webhook the WordPress plugin calls on publish.
   Body: { title, url, message?, image?, id? } — everything but title/url optional. */
export async function POST(req: NextRequest) {
  if (!authed(req)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const b = (await req.json().catch(() => ({}))) as Partial<Push> & { id?: string | number; excerpt?: string };
  if (!b.title || !b.url) return NextResponse.json({ error: "title and url required" }, { status: 400 });

  const out = await send({
    title: decodeEntities(stripHtml(b.title)),
    message: decodeEntities(stripHtml(b.message ?? b.excerpt ?? b.title)).slice(0, 180),
    url: b.url.startsWith("http") ? b.url : `${SITE}${b.url}`,
    image: b.image,
    externalId: b.id != null ? `post-${b.id}` : `url-${b.url}`,
  });
  return NextResponse.json(out, { status: out.ok ? 200 : 502 });
}

/* Cron fallback for when the plugin can't reach us: pushes the newest post.
   Idempotent via external_id, so a 5-minute schedule won't spam. */
export async function GET(req: NextRequest) {
  if (!authed(req)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const [post] = await getPosts({ perPage: 1 }).catch(() => []);
  if (!post) return NextResponse.json({ ok: false, error: "no posts" }, { status: 502 });

  const out = await send({
    title: decodeEntities(stripHtml(post.title.rendered)),
    message: decodeEntities(stripHtml(post.excerpt.rendered)).slice(0, 180),
    url: `${SITE}${postPath(post)}`,
    image: featuredImage(post)?.url,
    externalId: `post-${post.id}`,
  });
  return NextResponse.json({ ...out, post: post.id }, { status: out.ok ? 200 : 502 });
}
