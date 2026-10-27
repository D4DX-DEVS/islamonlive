import { readFileSync } from "node:fs";
import type { NextConfig } from "next";

// the version /settings shows — read from package.json so the two can't drift
const { version } = JSON.parse(readFileSync(new URL("./package.json", import.meta.url), "utf8")) as { version: string };

/* The WordPress origin, duplicated from lib/env.ts because next.config runs
   before the "@/..." path alias exists. Keep the two in step. */
const WP_URL = (process.env.WORDPRESS_API_URL ?? process.env.NEXT_PUBLIC_WORDPRESS_URL ?? "https://admin.islamonlive.in")
  .replace(/\/wp-json(\/.*)?$/, "")
  .replace(/\/+$/, "");

const WP_HOST = new URL(WP_URL).hostname;

const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL ?? "https://islamonlive.in").replace(/\/+$/, "");

/* CDN origin for media files when NEXT_PUBLIC_MEDIA_ORIGIN is set.
   E.g. https://d4dx-storage.blr1.cdn.digitaloceanspaces.com/islamonlive
   When set, /wp-content rewrites point here (mongo mode); when unset, to WordPress.
   The URL stays unchanged for Google Images + backlinks. */
const MEDIA_ORIGIN = (process.env.NEXT_PUBLIC_MEDIA_ORIGIN ?? "").replace(/\/+$/, "");
const MEDIA_HOST = MEDIA_ORIGIN ? new URL(MEDIA_ORIGIN).hostname : "";

/* Content source: "wordpress" (default) or "mongo" (MongoDB reads).
   When mongo, feed and wp-json routes come from our own API handlers instead
   of proxying to WordPress. Matches the check in lib/env.ts. */
const DATA_SOURCE: "wordpress" | "mongo" = process.env.DATA_SOURCE === "mongo" ? "mongo" : "wordpress";

/* Until the DNS for admin.islamonlive.in exists, a checkout can still be
   pointed at the apex — and then WordPress and the frontend share a host. Every
   proxy rule below would fold onto itself (/wp-content -> /wp-content, wp-json
   -> wp-json) and loop, so they are only emitted once the two hosts really are
   different. Split-host is the production configuration; this is the guard that
   keeps single-host development from hanging. */
const SPLIT_HOSTS = WP_HOST !== new URL(SITE_URL).hostname;

/* Yoast has been serving /sitemap_index.xml and 35 children for years, and
   Search Console has them on file. Next generates the same URLs rather than
   introducing new ones, so nothing has to be re-submitted and no indexed
   sitemap 404s. One route handler answers them all, following Yoast's own
   scheme where the first file carries no digit (post-sitemap.xml, then
   post-sitemap2.xml). */
const SITEMAP_TYPES = ["post", "page", "category", "post_tag", "author"] as const;

const nextConfig: NextConfig = {
  env: { NEXT_PUBLIC_APP_VERSION: version },
  // lets a prod build/start run beside the dev server (unset = normal .next)
  distDir: process.env.NEXT_DIST_DIR || ".next",
  // allow opening the dev server from other devices on the LAN
  allowedDevOrigins: ["192.168.1.23", "192.168.1.13", "localhost"],

  /* WordPress 301s /opinion/foo to /opinion/foo/, so every one of the 22,297
     indexed URLs ends in a slash. Next's default is the opposite and would
     answer each of them with a 308 to the slashless form — a redirect hop on
     every organic landing, and a canonical that disagrees with the sitemap.
     Matching WP here is what makes the migration a no-op for Google. */
  trailingSlash: true,

  // client router cache: `dynamic` defaults to 0s since Next 15, so navigating back
  // re-rendered the page from scratch. 5 min matches the WP fetch revalidate.
  experimental: { staleTimes: { dynamic: 300, static: 300 } },

  images: {
    /* Photon, not Vercel's optimizer — see lib/imageLoader.ts. Vercel bills
       optimization per source image and the archive exhausted the allowance,
       so /_next/image began answering 402 and every uncached size rendered as
       a broken image. A custom loader bypasses that route completely: the
       browser fetches i0.wp.com directly. */
    loader: "custom",
    loaderFile: "./src/lib/imageLoader.ts",

    /* Unused while the loader is custom — Next only consults remotePatterns in
       its own optimizer — but kept as the record of which hosts may appear in
       an <Image src>, and what the config must be if the loader is ever
       dropped. MEDIA_HOST is empty when NEXT_PUBLIC_MEDIA_ORIGIN is unset. */
    remotePatterns: [
      { protocol: "https" as const, hostname: "islamonlive.in" },
      { protocol: "https" as const, hostname: "*.islamonlive.in" },
      { protocol: "https" as const, hostname: WP_HOST },
      ...(MEDIA_HOST ? [{ protocol: "https" as const, hostname: MEDIA_HOST }] : []),
      { protocol: "https" as const, hostname: "i0.wp.com" },
      { protocol: "https" as const, hostname: "i1.wp.com" },
      { protocol: "https" as const, hostname: "i2.wp.com" },
      { protocol: "https" as const, hostname: "secure.gravatar.com" },
      { protocol: "https" as const, hostname: "i.ytimg.com" },
    ],
    /* Fewer, wider-apart breakpoints than Next's defaults (8 device widths +
       8 image widths). Every distinct width is a separate rendition Photon has
       to generate on first request, and it throttles bursts of *cold* ones
       hard — a scroll that reveals a row of cards then comes back as 429s,
       which Chrome refuses to render (ERR_BLOCKED_BY_ORB) and the card shows
       as broken until a reload finds the rendition warm. Halving the width
       count roughly doubles the chance any given card asks for a size the CDN
       has already made, for the same visual result. ImageRetry.tsx covers what
       still slips through. */
    deviceSizes: [640, 828, 1280, 1920],
    imageSizes: [96, 192, 384],

    /* formats/minimumCacheTTL are deliberately absent: both configure the
       built-in optimizer, which no longer runs. Photon negotiates WebP from
       the Accept header itself and caches on its own CDN. */
  },

  async rewrites() {
    return {
      /* beforeFiles so /wp-content never reaches a dynamic route.

         Media: every indexed image URL is /wp-content/uploads/… on the apex.
         The origin can be WordPress (always) or a CDN when NEXT_PUBLIC_MEDIA_ORIGIN
         is set. Either way, the URL a reader sees is unchanged, so Google Images
         rankings and hot-linked images keep working. Feeds likewise: RSS
         subscribers keep their address. */
      beforeFiles: [
        // in mongo mode media and feeds are ours whatever WP_URL says, so never depend on the host split
        ...(SPLIT_HOSTS || DATA_SOURCE === "mongo"
          ? [
              {
                source: "/wp-content/:path*",
                /* When MEDIA_ORIGIN is set (mongo mode), proxy to CDN; otherwise to WordPress.
                   The destination URL is fixed at build time, so redeploy with different
                   NEXT_PUBLIC_MEDIA_ORIGIN to switch origins. */
                destination: MEDIA_ORIGIN
                  ? `${MEDIA_ORIGIN}/wp-content/:path*`
                  : `${WP_URL}/wp-content/:path*`,
              },
              ...(SPLIT_HOSTS ? [{ source: "/wp-includes/:path*", destination: `${WP_URL}/wp-includes/:path*` }] : []),
              /* Feed routing: when DATA_SOURCE=mongo, feeds come from our own
                 API handlers; otherwise proxy to WordPress. */
              ...(DATA_SOURCE === "mongo"
                ? [
                    { source: "/feed", destination: "/api/feed" },
                    { source: "/feed/", destination: "/api/feed" },
                    { source: "/feed/atom", destination: "/api/feed/atom" },
                    { source: "/feed/atom/", destination: "/api/feed/atom" },
                    { source: "/feed/rss2", destination: "/api/feed" }, // RSS2 is the main feed
                    { source: "/feed/rss2/", destination: "/api/feed" },
                    { source: "/feed/rss", destination: "/api/feed" }, // alias
                    { source: "/feed/rss/", destination: "/api/feed" },
                    { source: "/feed/rdf", destination: "/api/feed" }, // RDF is also RSS 1.0
                    { source: "/feed/rdf/", destination: "/api/feed" },
                    { source: "/comments/feed", destination: "/api/feed/comments" },
                    { source: "/comments/feed/", destination: "/api/feed/comments" },
                    /* XML-RPC and the REST API are gone for good: 410, answered at
                       the same URL, tells clients to stop rather than re-probe a 404. */
                    { source: "/xmlrpc.php", destination: "/api/gone" },
                    { source: "/wp-json", destination: "/api/gone" },
                    { source: "/wp-json/:path*", destination: "/api/gone" },
                  ]
                : [
                    { source: "/feed", destination: `${WP_URL}/feed` },
                    { source: "/feed/:path*", destination: `${WP_URL}/feed/:path*` },
                    { source: "/comments/feed", destination: `${WP_URL}/comments/feed` },
                  ]),
            ]
          : []),

        /* IndexNow accepts URLs only under the folder its key file sits in, so
           the key is served from the root (lib/indexnow.ts names this URL). */
        { source: "/indexnow-key.txt", destination: "/api/indexnow-key" },

        // Yoast's sitemap URLs, answered by the route handler
        { source: "/sitemap_index.xml", destination: "/api/sitemap" },
        { source: "/sitemap.xml", destination: "/api/sitemap" },
        { source: "/news-sitemap.xml", destination: "/api/sitemap/news/1" },
        // the child files: post-sitemap.xml is page 1, post-sitemap2.xml page 2 …
        // (path params, not a query string — a query on a rewrite destination
        // never reaches the route handler)
        ...SITEMAP_TYPES.flatMap((type) => [
          { source: `/${type}-sitemap\\.xml`, destination: `/api/sitemap/${type}/1` },
          { source: `/${type}-sitemap:n(\\d+)\\.xml`, destination: `/api/sitemap/${type}/:n` },
        ]),
        // Yoast ships an XSL stylesheet with each sitemap; without it browsers
        // show a raw-XML warning where the old styled table used to be
        { source: "/main-sitemap.xsl", destination: "/api/sitemap/style" },
      ],

      afterFiles: [
        /* Archive pagination (/category/news/page/2/, /tag/x/page/2/,
           /author/x/page/2/) is read straight off the path by those routes'
           catch-all segments — see lib/paging.ts — so it needs no rewrite here
           and the pages stay cacheable. Search is the one list that is a query
           by nature. */
        { source: "/search/page/:n(\\d+)", destination: "/search?page=:n" },
      ],
    };
  },

  async redirects() {
    return [
      /* WordPress admin endpoints. In wordpress mode, redirect to the backend
         (when it is on another host). In mongo mode there is no backend, so
         they go to the internal admin panel or answer Gone whatever the hosts. */
      ...(SPLIT_HOSTS || DATA_SOURCE === "mongo"
        ? [
            ...(DATA_SOURCE === "mongo"
              ? [
                  /* MongoDB mode: admin panel is at /admin on this server.
                     /wp-admin and /wp-login.php on the apex are 301 to /admin/. */
                  { source: "/wp-admin/:path*", destination: "/admin/", statusCode: 301 as const },
                  { source: "/wp-login.php", destination: "/admin/", statusCode: 301 as const },
                  { source: "/wp-signup.php", destination: "/admin/", statusCode: 301 as const },
                  // /xmlrpc.php and /wp-json answer 410 in place: see the beforeFiles rewrites
                ]
              : [
                  /* WordPress mode: redirect to the backend (original behaviour). */
                  { source: "/wp-admin/:path*", destination: `${WP_URL}/wp-admin/:path*`, statusCode: 301 as const },
                  { source: "/wp-login.php", destination: `${WP_URL}/wp-login.php`, statusCode: 301 as const },
                  { source: "/wp-signup.php", destination: `${WP_URL}/wp-signup.php`, statusCode: 301 as const },
                  { source: "/xmlrpc.php", destination: `${WP_URL}/xmlrpc.php`, statusCode: 301 as const },
                  { source: "/wp-json/:path*", destination: `${WP_URL}/wp-json/:path*`, statusCode: 301 as const },
                ]),
          ]
        : []),

      /* Legacy query-string permalinks (/?p=123, /?page_id=45, /?cat=6) and
         WordPress search (/?s=term) are handled in src/proxy.ts, where the
         lookup can be rewritten onto /go/ and the reader sees a single 301.
         A redirect here would be one hop more, and would carry the original
         query string along. */

      /* The home page's own pagination (/page/2/) has no counterpart: the
         front page loads more as the reader scrolls. Old links consolidate on
         the front page rather than serving it twice at two addresses. */
      { source: "/page/:n(\\d+)", destination: "/", statusCode: 301 },

      /* An explicit /page/1/ is the bare archive, and WordPress redirected it
         too. Done here it costs no render and no WordPress call, and it is a
         301 like the rest; the app routes keep the same rule as a backstop.
         The query string rides along, so search's page 1 keeps its ?q=. */
      { source: "/:path+/page/1", destination: "/:path+/", statusCode: 301 },

      /* WordPress pages whose body is a page-builder listing (empty over REST,
         so this app cannot render them) that stand in for an archive or a
         form, and the small `watch` post type this app does not carry. Each
         goes to the page that now holds the same thing, so the URL keeps its
         history rather than dying. */
      { source: "/life", destination: "/category/life/", statusCode: 301 },
      { source: "/hadith-padanam", destination: "/category/shariah/hadith-padanam/", statusCode: 301 },
      { source: "/ask-your-question", destination: "/contact/", statusCode: 301 },
      { source: "/watch", destination: "/watch-videos/", statusCode: 301 },
      { source: "/watch/:path+", destination: "/watch-videos/", statusCode: 301 },

      /* Per-article feed and AMP variants, which this frontend does not serve.
         `:path+` (one or more) rather than `:path*` (zero or more) on purpose:
         with `*` these also match the bare /feed and /amp, and since redirects
         run before rewrites that would capture the site feed and send it to the
         home page instead of through to WordPress. */
      // destinations end in "/" so the 301 lands directly, rather than on the
      // slash-less form that trailingSlash then 308s — one hop, not two
      { source: "/:path+/feed", destination: "/:path+/", statusCode: 301 },
      { source: "/:path+/amp", destination: "/:path+/", statusCode: 301 },

      // WP's own alias for an author archive
      { source: "/authors/:slug", destination: "/author/:slug/", statusCode: 301 },
    ];
  },

  async headers() {
    return [
      {
        // proxied uploads are immutable — WP writes a new filename per size
        source: "/wp-content/uploads/:path*",
        headers: [{ key: "Cache-Control", value: "public, max-age=31536000, immutable" }],
      },
      {
        /* Keep HTML out of the shared CDN cache. Next still caches the rendered
           route and the WordPress fetches through ISR/data-cache revalidation,
           but the edge must not retain an error response or serve a stale HTML
           copy after on-demand revalidation. Static assets, uploads, feeds and
           API handlers use their own rules below or the headers they return. */
        source: "/:path((?!_next/|wp-content/|wp-includes/|api/|feed(?:/|$)|comments/feed).*)",
        headers: [{ key: "CDN-Cache-Control", value: "no-store" }],
      },
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
          // the CSP spelling of the line above; a full policy is an open item
          // (docs/MIGRATION.md §9) — the embeds and OneSignal need an allow-list
          // that has to be tested page by page before it can be enforced
          { key: "Content-Security-Policy", value: "frame-ancestors 'self'" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
          // two years, the value Vercel sets on its own; no includeSubDomains
          // until every islamonlive.in subdomain is confirmed HTTPS-only
          { key: "Strict-Transport-Security", value: "max-age=63072000" },
        ],
      },
    ];
  },
};

export default nextConfig;
