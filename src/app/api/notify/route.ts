import { NextRequest, NextResponse } from "next/server";
import { getPosts, featuredImage, postPath, stripHtml, decodeEntities } from "@/lib/wordpress";
import { authed, sendToAll, SITE, type Push } from "@/lib/onesignal";

export const dynamic = "force-dynamic";

/* Webhook the WordPress plugin calls on publish.
   Body: { title, url, message?, image?, id? } — everything but title/url optional. */
export async function POST(req: NextRequest) {
  if (!authed(req)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const b = (await req.json().catch(() => ({}))) as Partial<Push> & { id?: string | number; excerpt?: string };
  if (!b.title || !b.url) return NextResponse.json({ error: "title and url required" }, { status: 400 });

  const out = await sendToAll({
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

  const out = await sendToAll({
    title: decodeEntities(stripHtml(post.title.rendered)),
    message: decodeEntities(stripHtml(post.excerpt.rendered)).slice(0, 180),
    url: `${SITE}${postPath(post)}`,
    image: featuredImage(post)?.url,
    externalId: `post-${post.id}`,
  });
  return NextResponse.json({ ...out, post: post.id }, { status: out.ok ? 200 : 502 });
}
