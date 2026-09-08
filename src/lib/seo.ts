import type { Metadata } from "next";
import { SITE_URL, siteUrl } from "@/lib/env";
import { ORG_NAME, organizationDetails, searchAction, SITE_DESCRIPTION, SITE_NAME } from "@/lib/schema";
import { isInternalUrl, rewriteUrl, toSiteUrl } from "@/lib/urls";

/* Yoast already computed every tag this site used to serve, and the REST API
   hands the whole lot over as `yoast_head_json` on posts, pages, categories,
   tags and authors. So none of it is re-derived here: the titles Google has
   been ranking, the hand-written meta descriptions, the robots directives, the
   OG images and — the valuable part — a complete JSON-LD @graph (Article,
   WebPage, ImageObject, BreadcrumbList, WebSite, Organization, Person) all come
   straight across.

   Two things change on the way out.

   The host: Yoast writes whatever WordPress thinks its home URL is; if the
   backend is answering on admin.islamonlive.in that is what lands in
   `canonical`, in every `@id`, and in the breadcrumb items. Publishing those
   unaltered would point every canonical on the site at the backend and hand
   Google a duplicate it prefers over us — so every URL is run through
   rewriteUrl(), and there is a test-by-inspection invariant here: nothing this
   module returns may contain the backend host.

   The boilerplate: the WordPress site title is "Islamonlive.in | The one and
   only Comprehensive Islamic portal in Malayalam" — the tagline is baked into
   the name — and Yoast's templates append it to everything, twice on category
   archives. cleanTitle() keeps the page's own words and exactly one site name.
   Likewise the site-level nodes Yoast emits on every page (WebSite,
   Organization, the logo) are made to say the same thing as the ones this app
   builds for the home page, so Google sees one entity rather than two
   competing descriptions of it under the same @id.

   Anything Yoast does not supply falls back to values derived from the post
   itself, so a page with the plugin disabled still renders complete metadata. */

export interface YoastImage {
  url: string;
  width?: number;
  height?: number;
  type?: string;
}

export interface YoastHead {
  title?: string;
  description?: string;
  canonical?: string;
  robots?: Record<string, string>;
  og_locale?: string;
  og_type?: string;
  og_title?: string;
  og_description?: string;
  og_url?: string;
  og_site_name?: string;
  og_image?: YoastImage[];
  article_published_time?: string;
  article_modified_time?: string;
  author?: string;
  twitter_card?: string;
  twitter_creator?: string;
  twitter_site?: string;
  twitter_misc?: Record<string, string>;
  schema?: { "@context"?: string; "@graph"?: unknown[] };
}

// the tagline WordPress carries inside its site title; matched loosely because
// Yoast keeps the non-breaking spaces WordPress stored
const TAGLINE = /^the one and only comprehensive islamic portal in malayalam$/i;
const SEP = /\s*\|\s*/;

function plain(s: string): string {
  return s.replace(/ /g, " ").replace(/\s+/g, " ").trim();
}

/**
 * One site name, at the end, and nothing else that isn't the page's own title.
 *   "News Islamonlive.in | The one and only … | Islamonlive.in | The one and only …"
 *   → "News | Islamonlive.in"
 *   "Some article | Islamonlive.in | The one and only …" → "Some article | Islamonlive.in"
 */
export function cleanTitle(raw: string): string {
  const parts = plain(raw).split(SEP).filter(Boolean);
  const own = (parts[0] ?? "")
    // Yoast's taxonomy template glues the site name to the term name with a space
    .replace(new RegExp(`\\s+${SITE_NAME.replace(".", "\\.")}$`, "i"), "")
    .trim();
  const rest = parts
    .slice(1)
    .filter((p) => !TAGLINE.test(p) && p.toLowerCase() !== SITE_NAME.toLowerCase())
    .filter((p, i, all) => all.indexOf(p) === i && p !== own);
  return [own, ...rest, SITE_NAME].filter(Boolean).join(" | ");
}

/** The page's own words, without the site name — what og:title should carry. */
function ownTitle(raw: string): string {
  return cleanTitle(raw).split(SEP)[0];
}

/**
 * Cut a description at a sentence end, or failing that a word end, below
 * `max` characters — never mid-word, and marked as cut.
 */
export function trimDescription(raw: string | undefined, max = 155): string | undefined {
  if (!raw) return undefined;
  const s = plain(raw.replace(/<[^>]*>/g, ""));
  if (s.length <= max) return s || undefined;
  const head = s.slice(0, max);
  const sentence = Math.max(head.lastIndexOf(". "), head.lastIndexOf("। "), head.lastIndexOf("? "), head.lastIndexOf("! "));
  if (sentence > max * 0.5) return head.slice(0, sentence + 1);
  const word = head.lastIndexOf(" ");
  return `${(word > 0 ? head.slice(0, word) : head).replace(/[,;:\-–—]$/, "")}…`;
}

/** A Yoast description worth publishing: real words, not a truncated title or a bare pipe. */
function usable(desc: string | undefined): desc is string {
  if (!desc) return false;
  const s = plain(desc);
  return s.length >= 40 && !/\|$/.test(s);
}

/**
 * Yoast's head for a term archive with its templated title and description
 * removed — those come from a site-wide template with typos in it, and the
 * archive's own words (its name, its WP description) read better. Canonical,
 * robots, images and the schema graph are kept.
 */
export function termSeo(y: YoastHead | undefined): YoastHead | undefined {
  if (!y) return undefined;
  const { title: _t, description: _d, og_title: _ot, og_description: _od, ...rest } = y; // eslint-disable-line @typescript-eslint/no-unused-vars
  return rest;
}

/** Yoast's robots values are strings ("max-snippet:-1"); Next wants the number. */
function directiveNumber(value: string | undefined, key: string): number | undefined {
  const n = Number(value?.replace(`${key}:`, ""));
  return Number.isFinite(n) ? n : undefined;
}

function robotsFrom(y: YoastHead): Metadata["robots"] {
  const r = y.robots;
  if (!r) return undefined;
  return {
    index: r.index !== "noindex",
    follow: r.follow !== "nofollow",
    googleBot: {
      index: r.index !== "noindex",
      follow: r.follow !== "nofollow",
      "max-snippet": directiveNumber(r["max-snippet"], "max-snippet"),
      "max-image-preview": (r["max-image-preview"]?.replace("max-image-preview:", "") ?? undefined) as
        | "none"
        | "standard"
        | "large"
        | undefined,
      "max-video-preview": directiveNumber(r["max-video-preview"], "max-video-preview"),
    },
  };
}

export interface SeoFallback {
  /** Site-relative path of the page being rendered — the canonical of last resort. */
  path: string;
  title?: string;
  description?: string;
  image?: string | null;
  publishedTime?: string;
  modifiedTime?: string;
  authors?: string[];
  type?: "article" | "website";
  /** Page number of a paginated archive; 2+ gets its own canonical, title and og:url. */
  page?: number;
}

/**
 * Yoast's head plus our own fallbacks, as a Next Metadata object.
 * Every URL in the result is on the public origin.
 */
export function seoMetadata(y: YoastHead | undefined, fb: SeoFallback): Metadata {
  const page = fb.page && fb.page > 1 ? fb.page : 0;
  const base = y?.canonical ? toSiteUrl(y.canonical) : `${SITE_URL}${fb.path}`;
  /* Page 2 and beyond get their own canonical rather than pointing back at
     page 1 — Google retired rel=prev/next and now expects each paginated page
     to be self-canonical, or it treats the deeper pages as duplicates and drops
     the articles that only appear on them. */
  const canonical = page ? `${base.replace(/\/$/, "")}/page/${page}/` : base;

  const rawTitle = y?.title ?? fb.title ?? SITE_NAME;
  const heading = page ? `${ownTitle(rawTitle)} - Page ${page}` : ownTitle(rawTitle);
  const title = cleanTitle(page ? `${heading} | ${SITE_NAME}` : rawTitle);
  const description = usable(y?.description) ? plain(y.description) : trimDescription(fb.description);
  const ogTitle = page ? heading : y?.og_title ? plain(y.og_title) : heading;
  const ogDescription = usable(y?.og_description) ? plain(y.og_description) : description;

  const images = y?.og_image?.length
    ? y.og_image.map((img) => ({
        url: rewriteUrl(img.url, true),
        width: img.width,
        height: img.height,
        type: img.type,
      }))
    : fb.image
      ? [{ url: rewriteUrl(fb.image, true) }]
      : // thousands of the older posts have no featured image, and Yoast has no
        // site-wide default configured — without this a share of one of them
        // renders as a bare link. The 512px icon clears every platform's
        // minimum; logo.png (298x81) does not.
        [{ url: `${SITE_URL}/icon-512.png`, width: 512, height: 512, type: "image/png" }];

  return {
    // absolute: the site name is already in place, the layout template must not add another
    title: { absolute: title },
    description,
    alternates: { canonical },
    robots: robotsFrom(y ?? {}),
    openGraph: {
      type: (y?.og_type as "article" | "website" | undefined) ?? fb.type ?? "article",
      url: canonical,
      title: ogTitle,
      description: ogDescription,
      siteName: SITE_NAME,
      // Yoast reports WordPress's admin language (en_GB); the content is Malayalam
      locale: "ml_IN",
      images,
      publishedTime: y?.article_published_time ?? fb.publishedTime,
      modifiedTime: y?.article_modified_time ?? fb.modifiedTime,
      authors: y?.author ? [y.author] : fb.authors,
    },
    twitter: {
      card: (y?.twitter_card as "summary_large_image" | "summary" | undefined) ?? "summary_large_image",
      site: y?.twitter_site,
      creator: y?.twitter_creator,
      title: ogTitle,
      description: ogDescription,
      images: images.map((i) => i.url),
    },
  };
}

/**
 * Walk any JSON-LD value and move every internal URL onto the public origin —
 * `url`, `@id`, `contentUrl`, breadcrumb `item`s, `sameAs`, the SearchAction
 * urlTemplate, all of it — without disturbing external links or non-URL strings.
 */
function rewriteGraph(node: unknown): unknown {
  if (typeof node === "string") {
    // urlTemplate carries a {search_term_string} placeholder that must survive
    if (node.includes("{search_term_string}")) {
      const [base, rest] = node.split("?");
      return isInternalUrl(base) ? `${rewriteUrl(base, true)}${rest ? `?${rest}` : ""}` : node;
    }
    return isInternalUrl(node) ? rewriteUrl(node, true) : node;
  }
  if (Array.isArray(node)) return node.map(rewriteGraph);
  if (node && typeof node === "object") {
    return Object.fromEntries(Object.entries(node).map(([k, v]) => [k, rewriteGraph(v)]));
  }
  return node;
}

type Node = Record<string, unknown>;

function hasType(node: Node, type: string): boolean {
  const t = node["@type"];
  return Array.isArray(t) ? t.includes(type) : t === type;
}

/** WordPress dates come with or without an offset; schema.org wants one. */
function isoDate(value: unknown): string | undefined {
  if (typeof value !== "string" || !value) return undefined;
  return /[zZ]$|[+-]\d\d:?\d\d$/.test(value) ? value : `${value}+00:00`;
}

export interface SchemaHints {
  /** The post's own modified time (GMT), for Article/WebPage nodes Yoast left without one. */
  modified?: string;
}

function isLogo(node: Node): boolean {
  return hasType(node, "ImageObject") && typeof node["@id"] === "string" && node["@id"].endsWith("#/schema/logo/image/");
}

/* Yoast nests copies of some nodes inside others — the Organization carries
   its logo ImageObject inline, the Person an avatar — so the language and the
   logo have to be fixed at every depth, not only on the graph's top row. */
function deep(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(deep);
  if (!value || typeof value !== "object") return value;
  const node: Node = {};
  for (const [k, v] of Object.entries(value as Node)) node[k] = deep(v);
  if ("inLanguage" in node) node.inLanguage = "ml";
  if (isLogo(node)) Object.assign(node, { url: siteUrl("/logo.png"), contentUrl: siteUrl("/logo.png"), width: 298, height: 81, caption: ORG_NAME });
  return node;
}

/**
 * Make Yoast's site-level nodes agree with the ones this app builds itself:
 * one name, one language, one working SearchAction, one logo file — and fill
 * the properties Google asks for that Yoast sometimes omits.
 */
function normalizeGraph(nodes: unknown[], y: YoastHead, hints: SchemaHints): unknown[] {
  const list = nodes.filter((n): n is Node => !!n && typeof n === "object");
  const person = list.find((n) => hasType(n, "Person"));

  return list.map((raw) => {
    const node = deep(raw) as Node;

    if (hasType(node, "WebSite")) {
      node.name = SITE_NAME;
      node.description = SITE_DESCRIPTION;
      node.potentialAction = [searchAction()];
    }
    if (hasType(node, "Organization") && !hasType(node, "Person")) {
      node.name = ORG_NAME;
      // the same profiles and facts the hand-built node carries — Yoast knows
      // only what its Site Identity form holds (two of the four profiles)
      const details = organizationDetails();
      const own = Array.isArray(node.sameAs) ? (node.sameAs as string[]) : [];
      Object.assign(node, details, { sameAs: [...new Set([...own, ...(details.sameAs as string[])])] });
    }
    if ((hasType(node, "Article") || hasType(node, "NewsArticle") || hasType(node, "WebPage")) && node.datePublished && !node.dateModified) {
      node.dateModified = isoDate(hints.modified) ?? isoDate(y.article_modified_time) ?? node.datePublished;
    }
    if (hasType(node, "ProfilePage") && !node.mainEntity && person?.["@id"]) {
      node.mainEntity = { "@id": person["@id"] };
    }
    return node;
  });
}

/**
 * Yoast's JSON-LD graph, rehosted and reconciled. Returns null when the plugin
 * sent none, so callers can fall back to the schema.ts builders.
 */
export function seoSchema(y: YoastHead | undefined, hints: SchemaHints = {}): Record<string, unknown> | null {
  const graph = y?.schema?.["@graph"];
  if (!graph?.length) return null;
  return {
    "@context": y?.schema?.["@context"] ?? "https://schema.org",
    "@graph": normalizeGraph(rewriteGraph(graph) as unknown[], y ?? {}, hints),
  };
}
