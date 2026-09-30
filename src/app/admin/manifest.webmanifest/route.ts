import { NextResponse } from "next/server";

export const dynamic = "force-static";

/** A separate install target for editors: installing from /admin opens the workspace. */
export function GET() {
  return NextResponse.json({
    name: "Islamonlive Admin",
    short_name: "IOL Admin",
    description: "Islamonlive article publishing workspace",
    start_url: "/admin/",
    scope: "/admin/",
    id: "/admin/",
    display: "standalone",
    background_color: "#f8fafc",
    theme_color: "#31094c",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any maskable" },
    ],
  }, { headers: { "Cache-Control": "public, max-age=3600" } });
}
