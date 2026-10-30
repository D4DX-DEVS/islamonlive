import { NextRequest, NextResponse } from "next/server";
import { DATA_SOURCE, SITE_URL } from "@/lib/env";
import { movedTo } from "@/lib/db/old-paths";

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

   Only the site root is matched for those — nothing else on the site pays.

   --- Renamed posts (MongoDB backend) ---

   A post whose slug an editor changed answers at its old URL with a 301 to
   the new one, as WordPress's old-slug redirect did. See lib/db/old-paths.ts
   for why this happens here and not in the (cached) article route. Only
   article-shaped paths (two or more segments) look it up. */

const LOOKUPS: [param: string, type: "post" | "page" | "category"][] = [
  ["p", "post"],
  ["page_id", "page"],
  ["cat", "category"],
];

/* --- Admin API: cross-site request forgery ---

   The session cookie is SameSite=Lax, which stops another *site* from sending
   it on a POST — but islamonlive.in's subdomains are the same site, so a page on
   any of them (an old WordPress host, a hijacked CNAME) could still drive the
   admin API with a signed-in editor's cookie. Every browser sends Origin on a
   POST/PUT/PATCH/DELETE, so a state-changing call whose Origin is not this host
   is refused. A request with no Origin is not from a page and carries no
   ambient cookie worth forging, so it passes to the handler's own auth check. */
const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

function crossSite(request: NextRequest): boolean {
  if (SAFE_METHODS.has(request.method)) return false;
  const origin = request.headers.get("origin");
  if (!origin) return request.headers.get("sec-fetch-site") === "cross-site";
  let originHost: string;
  try {
    originHost = new URL(origin).host;
  } catch {
    return true; // "null" (sandboxed frames, file:) and garbage
  }
  const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host") ?? "";
  return originHost !== host && originHost !== new URL(SITE_URL).host;
}

/** Hosts that serve this app but are not the address readers are given. */
const FOREIGN_HOST = /\.ondigitalocean\.app$/i;

export default async function proxy(request: NextRequest): Promise<NextResponse> {
  // the only /api paths the matcher lets in; see the matcher note for why the rest stay out
  if (request.nextUrl.pathname.startsWith("/api/")) {
    if (crossSite(request)) return NextResponse.json({ error: "Cross-site request refused" }, { status: 403 });
    return NextResponse.next();
  }

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

  const { pathname } = request.nextUrl;
  if (DATA_SOURCE === "mongo" && /^\/[^/]+\/[^?]+$/.test(pathname)) {
    const moved = await movedTo(pathname);
    if (moved) {
      const target = new URL(SITE_URL);
      target.pathname = moved;
      target.search = request.nextUrl.search;
      return NextResponse.redirect(target, 301);
    }
  }

  // everything below is the site root only
  if (pathname !== "/") return NextResponse.next();

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
   disallows /api anyway, so there was never an index to protect.

   /api/admin is matched separately, and only for the cross-site check above —
   never the host redirect. */
export const config = { matcher: ["/((?!_next/|api/|wp-content/|wp-includes/).*)", "/api/admin/:path*"] };
