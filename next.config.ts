import { existsSync, readFileSync } from "node:fs";
import { parseEnv } from "node:util";
import type { NextConfig } from "next";

// the version /settings shows — read from package.json so the two can't drift
const { version } = JSON.parse(readFileSync(new URL("./package.json", import.meta.url), "utf8")) as { version: string };

/* Local checkouts keep the backend's secrets in the workspace root .env (shared
   with migration/), not in frontend/. Next only reads frontend/.env*, so a plain
   `next build` never saw MONGODB_URI, fell back to WordPress, and failed now that
   WordPress answers 410. This takes the same keys migration/next-mongo.mjs passes
   to `npm run dev` — the database, Spaces and the admin sign-in, never the
   analytics/purge/push keys — and never overrides a value already set. On
   DigitalOcean there is no root .env (it is outside the repo), so the dashboard
   env is used untouched. Runs before anything below reads process.env, and the
   build workers inherit it. */
const ROOT_ENV = new URL("../.env", import.meta.url);
const ROOT_KEYS = ["MONGODB_URI", "ADMIN_USER", "ADMIN_PASSWORD", "ADMIN_SESSION_SECRET"];
if (existsSync(ROOT_ENV)) {
  for (const [key, value] of Object.entries(parseEnv(readFileSync(ROOT_ENV, "utf8")))) {
    if ((ROOT_KEYS.includes(key) || key.startsWith("DO_SPACES_")) && process.env[key] === undefined) process.env[key] = value;
  }
  if (process.env.MONGODB_URI) {
    process.env.DATA_SOURCE ??= "mongo";
    process.env.NEXT_PUBLIC_MEDIA_ORIGIN ??= "https://d4dx-storage.blr1.cdn.digitaloceanspaces.com/islamonlive";
  }
}

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

/* Content Security Policy, in two parts.

   ENFORCED is what can be switched on without testing a single page: no
   plugins, no <base> hijack, no form posting off-site, no framing by others.

   REPORT_ONLY is the full allow-list, reported but not enforced, so a missed
   origin shows up as a console warning instead of a broken embed. Scripts need
   'unsafe-inline' — Next's bootstrap, the install-prompt capture and JSON-LD are
   inline, and nonces would force every page dynamic and end ISR — so the gain
   is in pinning *where* scripts and connections may come from. frame-src stays
   https: because twenty years of articles embed from dozens of hosts. Once the
   console stays clean across article, home, reels, listen and admin, move it to
   the enforced header. */
const CSP_ENFORCED = "frame-ancestors 'self'; object-src 'none'; base-uri 'self'; form-action 'self'";
const CSP_REPORT_ONLY = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline' https://cdn.onesignal.com https://*.onesignal.com https://static.cloudflareinsights.com https://challenges.cloudflare.com",
  "style-src 'self' 'unsafe-inline' https://onesignal.com https://*.onesignal.com",
  "img-src 'self' data: blob: https:",
  "font-src 'self' data:",
  "media-src 'self' blob: https:",
  "connect-src 'self' https://onesignal.com https://*.onesignal.com https://cloudflareinsights.com",
  "frame-src https:",
  "worker-src 'self' blob:",
  "manifest-src 'self'",
  // frame-ancestors is left out: browsers ignore it here and log that on every page
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
].join("; ");

const nextConfig: NextConfig = {
  env: { NEXT_PUBLIC_APP_VERSION: version },
  // no free framework fingerprint for scanners
  poweredByHeader: false,
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
  experimental: {
    staleTimes: { dynamic: 300, static: 300 },
    /* /api/admin now runs through the proxy (its cross-site check), and Next
       buffers a proxied body up to this size, truncating beyond it. Featured
       images may be 10 MB, so the cap sits above that plus the form fields. */
    proxyClientMaxBodySize: "12mb",
  },

  images: {
    /* Next's own optimizer (sharp), running in the DO App container. It replaced
       the Jetpack Photon loader (i0.wp.com), which was there only because
       Vercel billed per optimized image and started answering 402. Self-hosted
       there is no per-image bill, and Photon was the slow part: ~1s for every
       cold rendition, a per-IP burst limit that broke cards on scroll (429 →
       ERR_BLOCKED_BY_ORB), and a 404 on the first fetch of a fresh upload.
       Now the browser asks /_next/image on our own origin (same connection as
       the page, no extra DNS/TLS) and sharp resizes from the Spaces CDN. */
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
    /* Fewer widths than Next's 16 defaults: each width is a separate sharp
       encode and a separate cache entry, so fewer widths = more cache hits and
       less CPU in the container, for the same visual result. */
    deviceSizes: [640, 828, 1280, 1920],
    imageSizes: [96, 192, 384],

    /* WebP only. AVIF is ~20% smaller but several times slower to encode, which
       on a small App Platform instance turns a cold card into a visible wait.
       One format also keeps the DO edge (which ignores Vary: Accept) from ever
       handing one browser another's format. */
    formats: ["image/webp"],

    /* Upload filenames never change content (WordPress/Spaces write a new name
       per upload), so a rendition can be kept a month. This is also the
       Cache-Control max-age the browser and the DO edge receive. */
    minimumCacheTTL: 2678400,
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
      /* The admin, its API and the homepage preview are for signed-in staff:
         never indexed (robots.txt asks; this tells a crawler that followed a
         link anyway) and never kept by Cloudflare or the DO edge. */
      ...["/admin", "/preview", "/api/admin", "/api/cron"].map((area) => ({
        source: `${area}/:path*`,
        headers: [
          { key: "X-Robots-Tag", value: "noindex, nofollow" },
          { key: "CDN-Cache-Control", value: "no-store" },
        ],
      })),
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
          { key: "Content-Security-Policy", value: CSP_ENFORCED },
          { key: "Content-Security-Policy-Report-Only", value: CSP_REPORT_ONLY },
          // popups (share sheets, OneSignal's prompt) keep working; nothing else gets a handle on this window
          { key: "Cross-Origin-Opener-Policy", value: "same-origin-allow-popups" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=(), usb=(), browsing-topics=()" },
          // two years, the value Vercel sets on its own; no includeSubDomains
          // until every islamonlive.in subdomain is confirmed HTTPS-only
          { key: "Strict-Transport-Security", value: "max-age=63072000" },
        ],
      },
      /* After the rule above so these win (the last match sets a header). The
         admin is never framed, not even by this origin: an article an editor
         wrote is same-origin, and could lay an invisible /admin/team over a
         decoy button for an administrator to click. /preview stays 'self', since
         the homepage builder frames it. */
      ...["/admin", "/api/admin"].map((area) => ({
        source: `${area}/:path*`,
        headers: [
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Content-Security-Policy", value: CSP_ENFORCED.replace("frame-ancestors 'self'", "frame-ancestors 'none'") },
        ],
      })),
    ];
  },
};

export default nextConfig;
