import { NextRequest, NextResponse } from "next/server";

const WP = process.env.NEXT_PUBLIC_WORDPRESS_URL ?? "https://islamonlive.in";

/* live type-ahead for the search box — proxies WP core search so the browser
   never talks to the WP origin directly */
export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get("q")?.trim() ?? "";
  if (q.length < 2) return NextResponse.json([]);
  try {
    const res = await fetch(
      `${WP}/wp-json/wp/v2/search?search=${encodeURIComponent(q)}&per_page=6&_fields=title,url`,
      { next: { revalidate: 300 } }
    );
    if (!res.ok) return NextResponse.json([]);
    const rows: { title: string; url: string }[] = await res.json();
    const sugs = rows.map((r) => {
      let path = "/";
      try {
        path = new URL(r.url).pathname;
      } catch {}
      return { title: r.title, path };
    });
    return NextResponse.json(sugs);
  } catch {
    return NextResponse.json([]);
  }
}
