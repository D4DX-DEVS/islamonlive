import { rewriteUrl } from "@/lib/urls";

/* WordPress article HTML, made fit to render on this site.

   The body arrives as `content.rendered` — twenty years of it, so both Gutenberg
   block markup and classic-editor soup, from a CMS whose theme and plugins are
   no longer loaded. Four things have to happen before it reaches the page:

   1. Hosts. Every href/src/srcset that points at the WordPress backend becomes a
      link to the public site (or, for uploads, a site-relative /wp-content path
      served by the next.config proxy). An article that links a reader to
      admin.islamonlive.in has leaked the CMS; one whose <img> does the same
      loses the image URL Google indexed.

   2. Safety. The content is trusted-ish — it comes from the editorial CMS — but
      "trusted" here means "as trusted as the weakest editor password". Scripts,
      inline event handlers and javascript: URLs are stripped, which costs
      nothing and removes stored-XSS as a consequence of one compromised login.

   3. Leftover shortcodes. Codes belonging to retired plugins render as literal
      [su_box ...] text now that the theme is gone. Known embeds are converted,
      the rest are dropped rather than shown to a reader.

   4. Embeds. YouTube/Vimeo iframes get lazy-loading and the attributes the
      article stylesheet needs to size them.

   Everything is a string transform: it runs on the server during render, adds no
   dependency, and leaves the markup the .prose styles already target
   (headings, lists, tables, blockquotes, figures, captions) untouched. */

/** Attributes whose value is a URL we may need to move onto the public origin. */
const URL_ATTRS = ["href", "src", "data-src", "data-large_image", "poster", "content"];

const ATTR_RE = new RegExp(`\\s(${URL_ATTRS.join("|")})=("([^"]*)"|'([^']*)')`, "gi");
const SRCSET_RE = /\s(srcset|data-srcset)=("([^"]*)"|'([^']*)')/gi;

function rewriteAttrs(html: string): string {
  return html
    .replace(ATTR_RE, (whole, attr: string, _q: string, dq?: string, sq?: string) => {
      const value = dq ?? sq ?? "";
      if (!value || value.startsWith("#") || value.startsWith("data:")) return whole;
      const next = rewriteUrl(value);
      return next === value ? whole : ` ${attr}="${next.replace(/"/g, "&quot;")}"`;
    })
    // srcset is a comma-separated list of "url 480w" pairs — each URL moves,
    // the descriptors stay exactly as WP wrote them
    .replace(SRCSET_RE, (whole, attr: string, _q: string, dq?: string, sq?: string) => {
      const value = dq ?? sq ?? "";
      if (!value) return whole;
      const next = value
        .split(",")
        .map((part) => {
          const trimmed = part.trim();
          const gap = trimmed.indexOf(" ");
          const url = gap === -1 ? trimmed : trimmed.slice(0, gap);
          const descriptor = gap === -1 ? "" : trimmed.slice(gap);
          return `${rewriteUrl(url)}${descriptor}`;
        })
        .join(", ");
      return ` ${attr}="${next.replace(/"/g, "&quot;")}"`;
    });
}

function strip(html: string): string {
  return (
    html
      .replace(/<script\b[\s\S]*?<\/script>/gi, "")
      .replace(/<noscript\b[\s\S]*?<\/noscript>/gi, "")
      // on* handlers, quoted or bare
      .replace(/\son[a-z]+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, "")
      .replace(/\s(href|src)\s*=\s*("javascript:[^"]*"|'javascript:[^']*')/gi, "")
  );
}

/* Shortcodes whose plugin is gone. The wrappers keep their inner text (it is
   article copy); the standalone ones are removed outright. */
const WRAPPER_SHORTCODES = /\[\/?(?:su_[a-z_]+|vc_[a-z_]+|et_pb_[a-z_]+|box|note|highlight|dropcap|column|row|tabs?|toggle|accordion|spoiler)(?:\s[^\]]*)?\]/gi;
const STANDALONE_SHORTCODES = /\[(?:caption|gallery|playlist|embed|contact-form-7|wpforms|cf7|advanced_iframe|adrotate|smartslider\d?)(?:\s[^\]]*)?\]/gi;

function shortcodes(html: string): string {
  return html
    // [embed]https://youtu.be/x[/embed] — the one shortcode worth honouring
    .replace(/\[embed[^\]]*\]([\s\S]*?)\[\/embed\]/gi, (_m, url: string) => youtubeIframe(url.trim()) ?? "")
    .replace(WRAPPER_SHORTCODES, "")
    .replace(STANDALONE_SHORTCODES, "")
    .replace(/\[\/(?:caption|gallery|playlist|embed)\]/gi, "");
}

const YT_RE = /(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([\w-]{11})/;

function youtubeIframe(url: string): string | null {
  const id = YT_RE.exec(url)?.[1];
  if (!id) return null;
  return `<iframe src="https://www.youtube-nocookie.com/embed/${id}" title="YouTube video" loading="lazy" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" referrerpolicy="strict-origin-when-cross-origin" allowfullscreen></iframe>`;
}

/* A bare YouTube URL on its own line is how the classic editor stored an
   oEmbed; with the theme gone it renders as a naked link. */
function bareEmbeds(html: string): string {
  return html.replace(
    /<p>\s*(?:<a[^>]*>)?\s*(https?:\/\/(?:www\.)?(?:youtube\.com|youtu\.be)\/[^\s<"]+)\s*(?:<\/a>)?\s*<\/p>/gi,
    (whole, url: string) => youtubeIframe(url) ?? whole
  );
}

function embeds(html: string): string {
  return (
    html
      // privacy-friendly host + lazy loading on every iframe WP already emitted
      .replace(/<iframe\b([^>]*)>/gi, (whole, attrs: string) => {
        let next = attrs.replace(/\syoutube\.com/gi, " youtube-nocookie.com");
        if (!/\bloading=/i.test(next)) next += ' loading="lazy"';
        if (!/\btitle=/i.test(next)) next += ' title="Embedded content"';
        return `<iframe${next}>`;
      })
      // WP writes width/height on old <img>; without loading=lazy a long article
      // fetches forty images at once
      .replace(/<img\b((?:(?!loading=)[^>])*)>/gi, '<img$1 loading="lazy" decoding="async">')
  );
}

/**
 * The article body, ready for dangerouslySetInnerHTML on a .prose container.
 * Idempotent: running it twice changes nothing.
 */
export function renderContent(html: string): string {
  if (!html) return "";
  return embeds(bareEmbeds(shortcodes(rewriteAttrs(strip(html)))));
}

/** Plain text of the body — used for reading time and description fallbacks. */
export function contentText(html: string): string {
  return html
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}
