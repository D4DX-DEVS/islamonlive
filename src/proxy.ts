import { NextRequest, NextResponse } from "next/server";

/* Legacy WordPress query URLs, answered in one hop.

   `/?p=123`, `/?page_id=45`, `/?cat=6` are WordPress's oldest permalink form,
   still alive in years of shares and forum posts. They need a lookup — the id
   has to be turned into a slug — which the /go/ route handler does with one
   REST call. A next.config redirect to /go/ would show the reader (and Google)
   two 301s in a row; rewriting here instead means the /go/ handler's own 301
   is the only one the client ever sees.

   `/?s=term` is WordPress search; it becomes /search/?q=term directly. Done
   here rather than in next.config because Next's redirects copy the original
   query string onto the destination, and the search page would be handed
   `?s=…&q=…`.

   Only the site root is matched — nothing else on the site pays for this. */

const LOOKUPS: [param: string, type: "post" | "page" | "category"][] = [
  ["p", "post"],
  ["page_id", "page"],
  ["cat", "category"],
];

export default function proxy(request: NextRequest): NextResponse {
  const { searchParams } = request.nextUrl;

  for (const [param, type] of LOOKUPS) {
    const id = searchParams.get(param);
    if (id && /^\d{1,12}$/.test(id)) {
      return NextResponse.rewrite(new URL(`/go/${type}/${id}/`, request.url));
    }
  }

  const s = searchParams.get("s");
  if (s !== null) {
    const target = new URL("/search/", request.url);
    if (s.trim()) target.searchParams.set("q", s.trim().slice(0, 120));
    return NextResponse.redirect(target, 301);
  }

  return NextResponse.next();
}

export const config = { matcher: "/" };
