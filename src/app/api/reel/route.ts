import { NextRequest, NextResponse } from "next/server";
import { getReelVideo } from "@/lib/instagram";

export const dynamic = "force-dynamic";

/* Re-signs one reel's video link.

   Instagram's CDN links carry a signature that it rotates every few hours. A
   page that has been open a while — or one served from the top of its ISR
   window — can hand the player a link the CDN has since stopped accepting.
   Rather than dropping that reel to Instagram's embed card, the player asks
   here for a link signed just now.

   Only the shortcode crosses the network, and it is checked against
   Instagram's own alphabet before it is used, so this can't be pointed at
   anything but the site's own feed. */
export async function GET(req: NextRequest) {
  const id = req.nextUrl.searchParams.get("id") ?? "";
  if (!/^[A-Za-z0-9_-]{5,32}$/.test(id)) {
    return NextResponse.json({ error: "bad id" }, { status: 400 });
  }

  const video = await getReelVideo(id).catch(() => null);
  if (!video) return NextResponse.json({ video: null }, { status: 404 });

  // never cached: the whole point is that the previous link had gone stale
  return NextResponse.json({ video }, { headers: { "Cache-Control": "no-store" } });
}
