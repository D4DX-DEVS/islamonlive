import { createHash, timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { collection } from "@/lib/db/client";
import { invalidatePublicPostCache } from "@/lib/admin-public-cache";
import { pingIndexNow } from "@/lib/indexnow";

/* WordPress's missed-schedule job: scheduled (status future) posts whose time
   has come become publish. Public queries already show a future post once
   published_at passes, so a late run never hides one; this flips the status,
   drops the cached pages and tells IndexNow. Like wp_publish_post it changes
   only the status — the post keeps the date it was scheduled for and its
   modified time.

   Call every minute or few with `Authorization: Bearer $CRON_SECRET`. */

export const dynamic = "force-dynamic";

function authorized(request: Request): boolean {
  const expected = process.env.CRON_SECRET ?? "";
  if (expected.length < 16) return false;
  const given = (request.headers.get("authorization") ?? "").replace(/^bearer\s+/i, "");
  // hash both so the comparison is constant-time whatever the lengths
  const digest = (s: string) => createHash("sha256").update(s).digest();
  return timingSafeEqual(digest(given), digest(expected));
}

export async function GET(request: Request): Promise<Response> {
  if (!authorized(request)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const posts = await collection("posts");
    const due = await posts.find({ status: "future", published_at: { $lte: new Date() } }, { projection: { link: 1 } }).toArray();
    if (!due.length) return NextResponse.json({ published: [] });

    const published: number[] = [];
    for (const post of due) {
      // conditional, so two overlapping runs never announce a post twice
      const { modifiedCount } = await posts.updateOne({ _id: post._id, status: "future" }, { $set: { status: "publish" } });
      if (!modifiedCount) continue;
      published.push(post._id);
      await invalidatePublicPostCache({ link: post.link, status: "publish" });
    }
    await pingIndexNow(due.filter((p) => published.includes(p._id)).map((p) => p.link));
    return NextResponse.json({ published });
  } catch (error) {
    console.error(`cron/publish failed: ${error instanceof Error ? error.message : "unknown error"}`);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

export const POST = GET;
