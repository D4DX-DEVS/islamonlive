import { SITE_URL } from "@/lib/env";

/* robots.txt, written by hand rather than through Next's MetadataRoute.Robots.

   The live site's robots.txt is not just "allow everything": Cloudflare's
   managed block declares Content-Signal terms (search=yes, ai-train=no,
   use=reference) and disallows a specific list of AI training crawlers, and
   Yoast appends the sitemap line. Those are the publisher's standing decisions
   about their archive — a migration that quietly dropped them would opt 22,000
   articles back into AI training on the day of cutover. MetadataRoute.Robots
   has no way to emit a `Content-Signal:` directive, so the file is served
   verbatim from here instead.

   Keep in step with the Cloudflare dashboard: if the managed block is still
   enabled there when the apex moves to Vercel it stops being injected, and this
   file becomes the only copy. */

export const dynamic = "force-static";
export const revalidate = 86400;

/** Crawlers the publisher has excluded — mirrored from the Cloudflare block. */
const BLOCKED_AI_AGENTS = [
  "Amazonbot",
  "Applebot-Extended",
  "Bytespider",
  "CCBot",
  "ClaudeBot",
  "CloudflareBrowserRenderingCrawler",
  "Google-Extended",
  "GPTBot",
  "meta-externalagent",
];

/* Backend and machine-only paths. The apex proxies /wp-content through to
   WordPress, so uploads stay crawlable — it is wp-admin, the login form and the
   REST API that have no business in an index. /api/ covers this app's own
   handlers; the sitemaps themselves are reached through the Sitemap: line and
   already carry X-Robots-Tag: noindex. */
const DISALLOW = [
  "/wp-admin/",
  "/wp-login.php",
  "/wp-signup.php",
  "/xmlrpc.php",
  "/wp-json/",
  "/admin/",
  "/api/",
  "/*?replytocom=",
  "/*?s=",
];

/* Cloudflare's managed robots.txt, if it is left switched on for the apex after
   the move, prepends this very block to whatever the origin serves. Set
   ROBOTS_CLOUDFLARE_MANAGED=1 in that case and the copy here is left out, so
   the file is not carrying the same declarations twice. Read at build time —
   this route is static. Off by default: with no Cloudflare in front, this file
   is the only place the publisher's terms exist. */
const CLOUDFLARE_MANAGED = process.env.ROBOTS_CLOUDFLARE_MANAGED === "1";

function body(): string {
  const own = !CLOUDFLARE_MANAGED;
  return [
    ...(own
      ? [
          "# Content signals — see https://contentsignals.org",
          "# search:   building a search index and providing search results.",
          "# ai-input: inputting content into one or more AI models.",
          "# ai-train: training or fine-tuning AI models.",
          "",
        ]
      : []),
    "User-agent: *",
    ...(own ? ["Content-Signal: search=yes,ai-train=no,use=reference"] : []),
    ...DISALLOW.map((p) => `Disallow: ${p}`),
    "Allow: /wp-content/uploads/",
    "Allow: /",
    "",
    ...(own ? BLOCKED_AI_AGENTS.flatMap((agent) => [`User-agent: ${agent}`, "Disallow: /", ""]) : []),
    `Sitemap: ${SITE_URL}/sitemap_index.xml`,
    "",
  ].join("\n");
}

export function GET(): Response {
  return new Response(body(), {
    headers: { "Content-Type": "text/plain; charset=UTF-8", "Cache-Control": "public, max-age=86400" },
  });
}
