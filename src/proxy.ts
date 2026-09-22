import { NextRequest, NextResponse } from "next/server";
import { SITE_URL } from "@/lib/env";

/* Two jobs, in this order: send every non-canonical host to the apex, then
   answer legacy WordPress query URLs in one hop.

   --- Hosts ---

   DigitalOcean gives every app a permanent default ingress
   (islamonlive-lxco4.ondigitalocean.app) that serves the whole site. Canonicals
   and sitemap <loc>s already point at the apex, so Google should consolidate —
   but the host is still crawlable, and robots.txt is generated from SITE_URL so
   it says "Allow: /" there too. That is a second copy of 22,000 articles to
   spend crawl budget on, and a second origin readers can subscribe to push from.
   A 301 is the only thing that closes it.

   Matched by suffix rather than as "anything that isn't the apex" on purpose:
   DigitalOcean's readiness probe dials the pod IP directly, so the Host header
   on a health check is an address, not a name. Redirecting that would fail the
   probe and take the deployment down with it.

   --- Legacy query permalinks ---

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

   Only the site root is matched for those — nothing else on the site pays. */

const LOOKUPS: [param: string, type: "post" | "page" | "category"][] = [
  ["p", "post"],
  ["page_id", "page"],
  ["cat", "category"],
];

/** Hosts that serve this app but are not the address readers are given. */
const FOREIGN_HOST = /\.ondigitalocean\.app$/i;

export default function proxy(request: NextRequest): NextResponse {
  const host = request.headers.get("host") ?? "";
  if (FOREIGN_HOST.test(host)) {
    /* Built by assigning onto a URL that is already the apex, never by handing
       a path to the URL constructor as a relative reference. `new URL(path,
       SITE_URL)` looks equivalent and is not: WHATWG treats an input beginning
       "//" as a network-path reference and takes the host from the *input*, so
       a request for //example.com/x would have produced a 301 to example.com —
       an open redirect on our own domain. Next normalises repeated leading
       slashes into a 308 of its own before a request ever reaches here, so that
       was not reachable in practice; this does not rely on it staying true
       across a Next upgrade. Property assignment cannot change protocol or
       host, and the collapse keeps the emitted path canonical either way. */
    const target = new URL(SITE_URL);
    target.pathname = request.nextUrl.pathname.replace(/^\/+/, "/");
    target.search = request.nextUrl.search;
    const res = NextResponse.redirect(target, 301);
    // belt and braces: a crawler that already has this address on file reads the
    // header on the redirect itself, which a 301 has no body to carry
    res.headers.set("X-Robots-Tag", "noindex");
    return res;
  }

  // everything below is the site root only
  if (request.nextUrl.pathname !== "/") return NextResponse.next();

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

/* Every path except the ones that must not pay for a host check.

   /wp-content and /wp-includes are proxied straight through to WordPress —
   the image archive carries real traffic and needs no host check to reach the
   right bytes — and _next is the build output.

   /api is excluded for a different reason: those are POSTs. A 301 carries no
   guarantee that a client repeats the method, and libcurl — which is what
   WordPress's wp_remote_post is built on — downgrades POST to GET on one. A
   revalidate webhook aimed at the wrong host would then land on this route's
   GET handler, get a cheerful 200, and invalidate nothing. Leaving /api
   unredirected makes that case work instead of failing silently; robots.txt
   disallows /api anyway, so there was never an index to protect. */
export const config = { matcher: "/((?!_next/|api/|wp-content/|wp-includes/).*)" };
