/* The two origins this app straddles, in one place.

   WordPress keeps the CMS at admin.islamonlive.in; the Next frontend owns the
   public apex islamonlive.in. Every URL therefore belongs to exactly one of:

     WP_URL    the backend — REST API, /wp-content uploads, wp-admin.
               A reader must never see this host in a link, a canonical or an
               <img src>.
     SITE_URL  the public site — canonicals, OG tags, sitemaps, share links,
               structured data. This is the host Google has indexed.

   Hard-coding either one anywhere else is how a canonical ends up pointing at
   the backend and Google drops the article, so nothing outside this module
   reads the raw process.env values.

   Which variable to set where:
     WORDPRESS_API_URL          server-only, spec-named, wins when present.
                                Full REST base: https://host/wp-json/wp/v2
     NEXT_PUBLIC_WORDPRESS_URL  WP origin. Public because the media helpers that
                                rewrite image hosts run in client components too.
     NEXT_PUBLIC_SITE_URL       public site origin.

   The fallbacks keep a half-migrated deployment (or a local checkout with the
   old single-domain .env) booting instead of crashing. */

function origin(url: string): string {
  // "https://admin.islamonlive.in/wp-json/wp/v2" -> "https://admin.islamonlive.in"
  return url.replace(/\/wp-json(\/.*)?$/, "").replace(/\/+$/, "");
}

/** Public site origin, no trailing slash — "https://islamonlive.in". */
export const SITE_URL = origin(process.env.NEXT_PUBLIC_SITE_URL ?? "https://islamonlive.in");

/** WordPress backend origin, no trailing slash — "https://admin.islamonlive.in". */
export const WP_URL = origin(
  process.env.WORDPRESS_API_URL ?? process.env.NEXT_PUBLIC_WORDPRESS_URL ?? "https://admin.islamonlive.in"
);

/** WP REST v2 base. Server-side only — the browser never calls WordPress directly. */
export const WP_API = process.env.WORDPRESS_API_URL?.includes("/wp-json")
  ? process.env.WORDPRESS_API_URL.replace(/\/+$/, "")
  : `${WP_URL}/wp-json/wp/v2`;

/* Uploads stay on the public origin.

   Google Images has 22k+ articles' worth of https://islamonlive.in/wp-content/
   URLs indexed. Rather than redirect every one of them to the backend,
   next.config rewrites /wp-content/* straight through to WP — so the URL a
   reader (and Googlebot) sees never changes, and the bytes still come from
   WordPress. Content and featured-image URLs are rewritten onto this prefix by
   rewriteUrl() in lib/urls.ts. */
export const MEDIA_PREFIX = "/wp-content";

/** Hosts whose /wp-content URLs are ours to rewrite onto MEDIA_PREFIX. */
export const MEDIA_HOSTS: readonly string[] = [
  new URL(SITE_URL).host,
  new URL(WP_URL).host,
  // Jetpack/Photon mirrors WP uploads; the live theme emits these on some posts
  "i0.wp.com",
  "i1.wp.com",
  "i2.wp.com",
];

/** Shared secret for POST /api/revalidate. Absent in dev = endpoint refuses everything. */
export const REVALIDATION_SECRET = process.env.REVALIDATION_SECRET ?? "";

/** Absolute public URL for a site-relative path — the only way canonicals get built. */
export function siteUrl(path: string): string {
  return `${SITE_URL}${path.startsWith("/") ? path : `/${path}`}`;
}
