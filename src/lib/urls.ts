import { MEDIA_HOSTS, MEDIA_PREFIX, SITE_URL, WP_URL } from "@/lib/env";

/* Turning a WordPress URL into one of ours, without changing a single byte that
   Google has indexed.

   Two things make this fiddlier than a host swap:

   1. Percent-encoding. The oldest ~10,000 posts have Malayalam slugs that WP
      stored already-encoded and lowercase:
        /opinion/indian-politics-opinion/%e0%b4%b8%e0%b4%bf%e0%b4%b1...
      `post.link` and `post.slug` both come back from the REST API in that exact
      form. URL.pathname preserves it byte for byte, so every path here is built
      from the raw pathname and never round-tripped through decode/encode —
      re-encoding would uppercase the hex and produce a URL Google has never
      seen. (Some slugs also carry a zero-width joiner, %e2%80%8d, which a
      careless normalise would drop entirely.)

   2. Trailing slashes. WordPress 301s /opinion/foo to /opinion/foo/, so every
      indexed URL ends in a slash and next.config sets trailingSlash: true to
      match. Paths produced here always end in one. */

const WP_HOST = new URL(WP_URL).host;
const SITE_HOST = new URL(SITE_URL).host;

/* One byte form for the encoded Malayalam slugs.

   WordPress stored them lowercase (%e0%b4...) and that is what its permalinks,
   its old sitemaps and Google's index carry. Yoast, though, hands over its
   canonical and JSON-LD URLs *decoded* (…/സിറിയന്‍…/), and the URL parser
   re-encodes those as uppercase %E0%B4. The two are equivalent by RFC 3986, but
   a canonical that differs from the sitemap entry by so much as hex case is a
   discrepancy a migration audit has to explain away — so every path leaving
   this module is folded to WordPress's lowercase, and canonical, og:url,
   sitemap <loc> and every @id agree to the byte. */
function lowerHex(path: string): string {
  return path.replace(/%[0-9A-F]{2}/g, (m) => m.toLowerCase());
}

/** Any path we emit ends in "/" — except a file, which never should. */
export function withTrailingSlash(path: string): string {
  if (path.endsWith("/")) return path;
  // "/sitemap_index.xml", "/wp-content/uploads/a.jpg" — a slash would 404 these
  const last = path.split("/").pop() ?? "";
  return last.includes(".") ? path : `${path}/`;
}

/**
 * The /wp-content path inside an uploads URL, or null when this is not media.
 * The query is dropped: WordPress stores its resized variants as distinct paths
 * (…-650x366.jpg), so ?resize=/?w= only ever came from Photon.
 */
function mediaPath(u: URL): string | null {
  if (!MEDIA_HOSTS.includes(u.host)) return null;
  // Photon (i0.wp.com/islamonlive.in/wp-content/...) nests the real path one
  // segment deep; everything else already starts at /wp-content
  const path = u.host.endsWith(".wp.com") ? u.pathname.replace(/^\/[^/]+/, "") : u.pathname;
  return path.startsWith(`${MEDIA_PREFIX}/`) ? lowerHex(path) : null;
}

/**
 * A media URL as the *public site* serves it — the address Google Images has
 * indexed, answered by the /wp-content proxy in next.config.
 *
 * This is the form that belongs in article HTML, where the <img src> a crawler
 * reads is the URL itself.
 */
export function mediaUrl(url: string): string {
  const u = parse(url);
  const media = u && mediaPath(u);
  return media ? `${SITE_URL}${media}` : url;
}

/**
 * A media URL on the origin that actually stores the file.
 *
 * This is what next/image needs. The optimizer never exposes this address — the
 * browser only ever sees /_next/image?url=… — so pointing it at WordPress
 * costs nothing in SEO and avoids two failure modes that a site-relative or
 * self-referencing src walks straight into:
 *
 *   - A relative "/wp-content/..." src makes the optimizer treat the file as a
 *     local asset and resolve it internally, where the external rewrite's
 *     Content-Type does not reach it. The proxy answers 200 and the optimizer
 *     still rejects the body with "isn't a valid image ... received null",
 *     which surfaces in the browser as a 400 on /_next/image.
 *   - An absolute src on our own host makes the optimizer fetch the site's own
 *     proxy, adding a hop, and needs the deployment's public origin (localhost
 *     included) in remotePatterns before it will load at all.
 */
export function mediaOriginUrl(url: string): string {
  const u = parse(url);
  const media = u && mediaPath(u);
  return media ? `${WP_URL}${media}` : url;
}

/* Absolute http(s) only, and deliberately so.

   Resolving against a base here would be a trap: `new URL("Article",
   "https://islamonlive.in")` succeeds and yields a URL on our own host, so
   every bare string in a JSON-LD graph — "Article", "en-GB", an author's name —
   would look like an internal link and get rewritten into
   "https://islamonlive.in/Article/". Nothing without a scheme is a URL as far
   as this module is concerned; a site-relative href in article HTML already
   points at us and needs no rewriting anyway. */
const ABSOLUTE = /^https?:\/\//i;

function parse(url: string): URL | null {
  if (!ABSOLUTE.test(url)) return null;
  try {
    return new URL(url);
  } catch {
    return null;
  }
}

/** True when the URL points at our own site or the WordPress backend behind it. */
export function isInternalUrl(url: string): boolean {
  const u = parse(url);
  return !!u && (u.host === WP_HOST || u.host === SITE_HOST || MEDIA_HOSTS.includes(u.host));
}

/**
 * A WordPress permalink as a path on the public site.
 * Keeps the query string, drops the fragment, preserves percent-encoding, and
 * guarantees the trailing slash. Media keeps its own (extension-bearing) path.
 */
export function toSitePath(wpUrl: string): string {
  const u = parse(wpUrl);
  // already a path (a hand-passed "/opinion/foo/") — normalise it in place
  if (!u) return wpUrl.startsWith("/") ? lowerHex(withTrailingSlash(wpUrl.split("#")[0])) : "/";
  return lowerHex(withTrailingSlash(u.pathname)) + u.search;
}

/** The same, absolute against the public origin — canonicals, OG tags, sitemaps. */
export function toSiteUrl(wpUrl: string): string {
  return `${SITE_URL}${toSitePath(wpUrl)}`;
}

/**
 * Rewrite one URL found in WordPress content or metadata so a reader never sees
 * the backend: uploads move onto the public site's /wp-content (answered by the
 * proxy in next.config, so the address Google indexed is unchanged), other
 * internal links move to the public host, external links are untouched.
 * Relative URLs are returned as-is — they already point at us.
 */
export function rewriteUrl(url: string, absolute = false): string {
  const u = parse(url);
  if (!u) return url;

  const media = mediaPath(u);
  if (media) return `${SITE_URL}${media}`;

  if (u.host === WP_HOST || u.host === SITE_HOST) {
    const path = lowerHex(withTrailingSlash(u.pathname)) + u.search + u.hash;
    return absolute ? `${SITE_URL}${path}` : path;
  }

  return url;
}

/**
 * A path segment from Next (already decoded) turned back into something the WP
 * REST API can match. WP accepts either case of percent-encoding — verified
 * against the live API — so encodeURIComponent is safe for the Malayalam slugs.
 * A segment that is already encoded and failed to decode is passed through.
 */
export function slugForApi(segment: string): string {
  return encodeURIComponent(segment);
}

/**
 * Decode a path segment for display/lookup without throwing on the malformed
 * ones (a stray "%" in an old slug makes decodeURIComponent blow up).
 */
export function safeDecode(segment: string): string {
  try {
    return decodeURIComponent(segment);
  } catch {
    return segment;
  }
}
