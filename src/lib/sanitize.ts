import sanitize, { type Attributes, type IOptions } from "sanitize-html";
import { SITE_URL } from "@/lib/env";

/* Editor-written HTML, made safe to hand to dangerouslySetInnerHTML.

   Article bodies, static pages and author bios are written in the admin by any
   editor, and twenty years of them came over from WordPress. They render on the
   public origin, the same origin as the admin API, so a script in one of them
   runs with whatever session the reader has — an administrator opening an
   article would be driving /api/admin/team on the attacker's behalf. "Trusted
   content" is only as trusted as the weakest editor password.

   This used to be a few regexes, and regexes do not parse HTML: `<svg/onload=…>`,
   `href="&#106;avascript:…"` and `<iframe srcdoc=…>` all walked past them. A
   real parser with an allow-list closes the class rather than the instances.

   The list is deliberately broad on markup — tables, figures, inline styles,
   classic-editor <font>/<center> soup, data-* attributes — because the archive
   uses all of it and none of it executes. What goes is everything that can run:
   <script>, <style>, <svg>/<math>, <object>/<embed>, <form>, <base>, <meta>,
   every on* handler, srcdoc, and any URL whose scheme is not http(s), mailto or
   tel (plus the sms/whatsapp/tg share links; data: only for <img>). Iframes may
   point anywhere over http(s) except this site itself: a cross-origin frame
   cannot reach this page's DOM, and the embeds come from more hosts than are
   worth pinning, but a same-origin one could lay /admin over the article.

   id and name stay (in-article anchors use them), except values that would
   shadow one of this app's own globals: an element with id="OneSignalDeferred"
   becomes window.OneSignalDeferred and breaks push for every reader. */

const SITE_HOST = new URL(SITE_URL).host;
// globals this app's scripts read before they assign (OneSignalDeferred, __iolInstallEvent…)
const CLOBBERS = /^(onesignal|__)/i;

function sameSite(src: string | undefined): boolean {
  if (!src) return true;
  try {
    return new URL(src, SITE_URL).host === SITE_HOST;
  } catch {
    return true;
  }
}

function safeAttribs(attribs: Attributes): Attributes {
  const out = { ...attribs };
  for (const key of ["id", "name"] as const) if (out[key] && CLOBBERS.test(out[key])) delete out[key];
  return out;
}

const OPTIONS: IOptions = {
  allowedTags: [
    ...sanitize.defaults.allowedTags,
    "img", "picture", "source", "track", "video", "audio", "iframe",
    "details", "summary", "del", "ins", "big", "center", "font", "strike", "tt",
  ],
  allowedAttributes: {
    "*": ["class", "id", "style", "title", "lang", "dir", "align", "valign", "width", "height", "role", "aria-*", "data-*", "itemprop"],
    a: ["href", "name", "target", "rel", "hreflang"],
    img: ["src", "srcset", "sizes", "alt", "loading", "decoding", "border", "hspace", "vspace"],
    iframe: ["src", "allow", "allowfullscreen", "frameborder", "loading", "referrerpolicy", "scrolling"],
    video: ["src", "poster", "controls", "preload", "playsinline", "muted", "loop"],
    audio: ["src", "controls", "preload", "loop"],
    source: ["src", "srcset", "type", "media", "sizes"],
    track: ["src", "kind", "srclang", "label", "default"],
    table: ["border", "cellpadding", "cellspacing", "bgcolor", "summary"],
    td: ["colspan", "rowspan", "headers", "bgcolor"],
    th: ["colspan", "rowspan", "headers", "scope", "bgcolor"],
    col: ["span"],
    colgroup: ["span"],
    ol: ["start", "type", "reversed"],
    li: ["value"],
    time: ["datetime"],
    blockquote: ["cite"],
    q: ["cite"],
    font: ["color", "face", "size"],
  },
  allowedSchemes: ["http", "https", "mailto", "tel", "sms", "whatsapp", "tg"],
  allowedSchemesByTag: { img: ["http", "https", "data"] },
  allowedSchemesAppliedToAttributes: ["href", "src", "cite", "poster", "data-src"],
  allowProtocolRelative: true,
  // dropped with their contents, not unwrapped into visible text
  nonTextTags: ["script", "style", "textarea", "option", "noscript", "template"],
  // an iframe of this very site (relative, protocol-relative or absolute) goes entirely
  exclusiveFilter: (frame) => frame.tag === "iframe" && sameSite(frame.attribs.src),
  transformTags: {
    "*": (tagName, attribs) => ({ tagName, attribs: safeAttribs(attribs) }),
    // any other window or tab (_blank, _new, a named one) must not be handed window.opener
    a: (tagName, attribs) => {
      const clean = safeAttribs(attribs);
      if (!clean.target || ["_self", "_top", "_parent"].includes(clean.target)) return { tagName, attribs: clean };
      const rel = new Set((clean.rel ?? "").split(/\s+/).filter(Boolean));
      rel.add("noopener");
      rel.add("noreferrer");
      return { tagName, attribs: { ...clean, rel: [...rel].join(" ") } };
    },
  },
};

/** Editor-authored HTML with everything executable removed. Idempotent. */
export function sanitizeHtml(html: string): string {
  return html ? sanitize(html, OPTIONS) : "";
}

/* Titles are character data with entities (WordPress stores them rendered:
   &#8216;, &amp;), printed with dangerouslySetInnerHTML so the entities decode.
   No tag belongs in one, so anything shaped like a tag goes and every other
   "<" or ">" is escaped: "5 < 6" survives as text, and an unterminated
   "<img src=x onerror=…" cannot become a tag either. */
export function safeTitle(title: string | null | undefined): string {
  return (title ?? "").replace(/<\/?[a-z!][^>]*>/gi, "").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
