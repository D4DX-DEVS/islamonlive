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
    remotePatterns: [
      { protocol: "https", hostname: "islamonlive.in" },
      { protocol: "https", hostname: "*.islamonlive.in" },
      { protocol: "https", hostname: WP_HOST },
      { protocol: "https", hostname: "i0.wp.com" },
      { protocol: "https", hostname: "i1.wp.com" },
      { protocol: "https", hostname: "i2.wp.com" },
      { protocol: "https", hostname: "secure.gravatar.com" },
      { protocol: "https", hostname: "i.ytimg.com" },
    ],
    // AVIF first: 20-30% smaller than WebP for the photographs that make up the
    // archive; the optimizer falls back to WebP for browsers without it
    formats: ["image/avif", "image/webp"],
    // WP writes a new filename for every upload and size, so an optimized
    // rendition can be cached for a month rather than re-checked every minute
    minimumCacheTTL: 2678400,
  },

  async rewrites() {
    return {
      /* beforeFiles so /wp-content never reaches a dynamic route.

         Media: every indexed image URL is /wp-content/uploads/… on the apex.
         WordPress now lives on another host, so the apex proxies those paths
         through, unchanged. Image search rankings, hot-linked images and the
         URLs inside 22,000 article bodies all keep working with nothing
         rewritten. Feeds likewise: RSS subscribers keep their address. */
      beforeFiles: [
        ...(SPLIT_HOSTS
          ? [
              { source: "/wp-content/:path*", destination: `${WP_URL}/wp-content/:path*` },
              { source: "/wp-includes/:path*", destination: `${WP_URL}/wp-includes/:path*` },
              // the site feed and its variants (/feed/atom/, /category/x/feed/ is
              // handled by the article-feed redirect below because it is per-post)
              { source: "/feed", destination: `${WP_URL}/feed` },
              { source: "/feed/:path*", destination: `${WP_URL}/feed/:path*` },
              { source: "/comments/feed", destination: `${WP_URL}/comments/feed` },
            ]
          : []),

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
      /* The CMS moved hosts. Anyone (or anything) still hitting wp-admin on the
         apex is sent to it rather than shown the reader's 404. 301, like every
         redirect here — a 302 would leave Google indexing the old address. */
      ...(SPLIT_HOSTS
        ? [
            { source: "/wp-admin/:path*", destination: `${WP_URL}/wp-admin/:path*`, statusCode: 301 as const },
            { source: "/wp-login.php", destination: `${WP_URL}/wp-login.php`, statusCode: 301 as const },
            { source: "/wp-signup.php", destination: `${WP_URL}/wp-signup.php`, statusCode: 301 as const },
            { source: "/xmlrpc.php", destination: `${WP_URL}/xmlrpc.php`, statusCode: 301 as const },
            { source: "/wp-json/:path*", destination: `${WP_URL}/wp-json/:path*`, statusCode: 301 as const },
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
