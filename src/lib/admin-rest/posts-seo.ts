import { createHash } from "node:crypto";
import { collection } from "@/lib/db/client";
import type { CategoryDoc, MediaDoc, PostDoc, TagDoc, UserDoc } from "@/lib/db/types";
import { SITE_URL } from "@/lib/env";
import type { YoastHead } from "@/lib/seo";

/* The Yoast head a post saved through the MongoDB admin gets, reproduced from
   what Yoast itself served for the archive: every template, separator and
   quirk below was read off the 22,343 published posts' yoast_head_json, and
   posts-seo.test.ts holds the generator to it field by field.

   Two inputs matter that WordPress keeps out of view:
   - the raw title — Yoast's title, og:title and description use the text the
     editor typed ("..."), while headline and breadcrumb use WordPress's
     rendered title ("&#8230;"). posts.ts has the raw text; rawTitleOf()
     recovers it from a rendered title well enough for old posts.
   - the raw content — schema wordCount is PHP's str_word_count over it,
     which only counts Latin-script words (Malayalam scores zero). */

const SITE_NAME = "Islamonlive.in | The one and only Comprehensive Islamic portal in Malayalam";
const SITE_DESCRIPTION = "Discover the beauty of Islam with our comprehensive Malayalam web portal. Find informative articles, connect with like-minded individuals";
const LANG = "en-GB";
// Yoast skips og:image for formats it cannot vouch for (AVIF, icons)
const OG_IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/gif", "image/webp"]);

const ENTITIES: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ", hellip: "…", ndash: "–", mdash: "—", rsquo: "’", lsquo: "‘", rdquo: "”", ldquo: "“" };

function decode(s: string): string {
  return s.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, e: string) => {
    if (e[0] !== "#") return ENTITIES[e.toLowerCase()] ?? m;
    const code = e[1] === "x" || e[1] === "X" ? parseInt(e.slice(2), 16) : Number(e.slice(1));
    return Number.isFinite(code) && code > 0 ? String.fromCodePoint(code) : m;
  });
}

/**
 * WordPress's rendered title back to what the editor typed. wptexturize writes
 * its replacements as numeric entities, while characters the editor typed
 * (a curly quote pasted from Word) stay literal — so only the entities are undone.
 */
export function rawTitleOf(rendered: string): string {
  return decode(
    rendered
      .replace(/&#821[67];/g, "'")
      .replace(/&#822[01];|&#8243;/g, "&quot;")
      .replace(/&#8230;/g, "...")
      .replace(/ &#8211; /g, " - ")
      .replace(/ &#8212; /g, " -- ")
      .replace(/&#8212;/g, "---")
      .replace(/&#8211;/g, "--")
      .replace(/(\d)&#215;(\d)/g, "$1x$2")
      .replace(/&#038;/g, "&amp;"),
  );
}

/** The title as WordPress renders it (the_title: wptexturize + convert_chars) — what a post stores and shows. */
export function renderTitle(raw: string): string {
  return raw
    .trim()
    .replace(/&(?!#?\w+;)/g, "&#038;")
    .replace(/\.\.\./g, "&#8230;")
    .replace(/ -- /g, " &#8212; ")
    .replace(/---/g, "&#8212;")
    .replace(/ - /g, " &#8211; ")
    .replace(/--/g, "&#8211;")
    .replace(/(\d)x(\d)/g, "$1&#215;$2")
    .replace(/(^|[\s([{"-])'/g, "$1&#8216;")
    .replace(/'/g, "&#8217;")
    .replace(/(^|[\s([{-])"/g, "$1&#8220;")
    .replace(/"/g, "&#8221;");
}

/** Yoast's smart_strip_tags: tags out, ASCII whitespace runs collapsed (PHP's \s leaves NBSP alone). */
function plainText(html: string): string {
  return decode(html.replace(/<[^>]*>/g, " "))
    .replace(/[ \t\n\r\f\v]+/g, " ")
    .replace(/^[ \t\n\r\f\v]+|[ \t\n\r\f\v]+$/g, "");
}

/**
 * Schema wordCount: PHP str_word_count (C locale) over title + content with
 * tags stripped, as Yoast's Article piece computes it. Apostrophes arrive
 * escaped, so they split words rather than join them; only the string's
 * first ' or - and last - are dropped.
 */
export function yoastWordCount(rawTitle: string, rawContent: string): number {
  const text = `${rawTitle} ${rawContent}`
    .replace(/<(script|style)[^>]*>[\s\S]*?<\/\1\s*>/gi, "")
    .replace(/<[^>]*>/g, "")
    .replace(/'/g, "&#039;");
  const start = text[0] === "-" ? 1 : 0;
  const end = text.length > start && text.endsWith("-") ? text.length - 1 : text.length;
  return (text.slice(start, end).match(/[A-Za-z'-]+/g) ?? []).length;
}

/** What Yoast needs from the post itself. */
export interface SeoPost {
  /** Rendered title, as stored on the post. */
  title: string;
  /** The editor's own text; derived from `title` when absent. */
  rawTitle?: string;
  /** Raw post_content (what the editor saved, not the_content output). */
  content: string;
  link: string;
  /** Site-local publish time, "2026-10-27T10:22:58". */
  date: string;
  date_gmt: string;
  modified_gmt: string;
  meta?: Record<string, string>;
}

/** The documents a post's head draws on, in the post's own term order. */
export interface SeoRefs {
  author: UserDoc | null;
  /** The author's Person node from an earlier post: its @id is a salted hash Yoast never exposes. */
  person: Record<string, unknown> | null;
  media: MediaDoc | null;
  categories: CategoryDoc[];
  tags: TagDoc[];
  /** Yoast's primary category, only when an editor picked one (it then names it in the description). */
  primaryCategory: CategoryDoc | null;
}

/* Yoast replaces these in a custom title/description the same way it fills its templates. */
function replaceVars(text: string, vars: Record<string, string>): string {
  return text.replace(/%%(\w+)%%/g, (m, name: string) => vars[name] ?? "").replace(/ {2,}/g, " ").trim();
}

function personNode(author: UserDoc, prior: Record<string, unknown> | null): Record<string, unknown> {
  const id = typeof prior?.["@id"] === "string" ? (prior["@id"] as string) : `${SITE_URL}/#/schema/person/${createHash("md5").update(`islamonlive-user-${author._id}`).digest("hex")}`;
  const avatar = author.avatars?.["96"] ?? author.avatar_url;
  const description = plainText(author.description ?? "");
  return {
    "@type": "Person",
    "@id": id,
    name: author.name,
    ...(avatar ? { image: { "@type": "ImageObject", inLanguage: LANG, "@id": avatar, url: avatar, contentUrl: avatar, caption: author.name } } : {}),
    ...(description ? { description } : {}),
    ...(Array.isArray(prior?.sameAs) ? { sameAs: prior.sameAs } : {}),
    url: author.link,
  };
}

/** The Yoast head for one post — pure, so it can be checked against the archive. */
export function buildPostSeo(post: SeoPost, refs: SeoRefs): YoastHead {
  const raw = post.rawTitle ?? rawTitleOf(post.title);
  // Yoast collapses ASCII whitespace only; a trailing NBSP survives
  const ogTitle = raw.replace(/[ \t\n\r\f\v]+/g, " ").replace(/^ | $/g, "");
  // smart_strip_tags on the rendered title: entities stay encoded
  const headline = post.title.replace(/[ \t\n\r\f\v]+/g, " ") || "No title";
  /* Yoast's quirk on Malayalam slugs: canonical and og:url carry the decoded
     permalink, every schema @id and url the percent-encoded one. */
  const url = post.link;
  let canonical = post.link;
  try {
    canonical = decodeURI(post.link);
  } catch {
    /* a malformed escape: keep the link as WordPress built it */
  }
  const primaryName = refs.primaryCategory?.name ?? "";
  const vars = { title: raw, sep: "|", sitename: SITE_NAME, primary_category: primaryName, category: refs.categories.map((c) => c.name).join(", ") };
  const customTitle = post.meta?._yoast_wpseo_title?.trim();
  const customDesc = post.meta?._yoast_wpseo_metadesc?.trim();
  const title = customTitle ? replaceVars(customTitle, vars) : `${raw} | ${SITE_NAME}`;
  // template "%%title%% %%sep%% %%primary_category%%"; Yoast leaves the separator dangling when no primary was picked
  const description = customDesc ? replaceVars(customDesc, vars) : primaryName ? `${raw} | ${primaryName}` : `${raw} |`;

  const published = `${post.date_gmt}+00:00`;
  const modified = post.modified_gmt > post.date_gmt ? `${post.modified_gmt}+00:00` : undefined;
  const m = refs.media;
  const image = m && m.source_url && m.is_file ? m : null;
  const ogImage = image && image.mime_type && OG_IMAGE_TYPES.has(image.mime_type) && image.width && image.height
    ? [{ width: image.width, height: image.height, url: image.source_url, type: image.mime_type }]
    : undefined;
  const author = refs.author;
  const person = author ? personNode(author, refs.person) : null;
  const words = yoastWordCount(raw, post.content);
  const caption = image ? plainText(rawTitleOf((image.caption ?? "").replace(/<[^>]*>/g, " "))) || image.alt_text : "";

  const article: Record<string, unknown> = {
    "@type": "Article",
    "@id": `${url}#article`,
    isPartOf: { "@id": url },
    ...(person ? { author: { name: author!.name, "@id": person["@id"] } } : {}),
    headline,
    datePublished: published,
    ...(modified ? { dateModified: modified } : {}),
    mainEntityOfPage: { "@id": url },
    ...(words ? { wordCount: words } : {}),
    ...(image ? { image: { "@id": `${url}#primaryimage` }, thumbnailUrl: image.source_url } : {}),
    ...(refs.tags.length ? { keywords: refs.tags.map((t) => t.name) } : {}),
    ...(refs.categories.length ? { articleSection: refs.categories.map((c) => c.name) } : {}),
    inLanguage: LANG,
    copyrightYear: post.date.slice(0, 4),
    copyrightHolder: { "@id": `${SITE_URL}/#organization` },
  };
  const webPage: Record<string, unknown> = {
    "@type": "WebPage",
    "@id": url,
    url,
    name: title,
    isPartOf: { "@id": `${SITE_URL}/#website` },
    ...(image ? { primaryImageOfPage: { "@id": `${url}#primaryimage` }, image: { "@id": `${url}#primaryimage` }, thumbnailUrl: image.source_url } : {}),
    datePublished: published,
    ...(modified ? { dateModified: modified } : {}),
    ...(person ? { author: { "@id": person["@id"] } } : {}),
    ...(description ? { description } : {}),
    breadcrumb: { "@id": `${url}#breadcrumb` },
    inLanguage: LANG,
    potentialAction: [{ "@type": "ReadAction", target: [url] }],
  };
  const graph: unknown[] = [article, webPage];
  if (image) {
    graph.push({
      "@type": "ImageObject",
      inLanguage: LANG,
      "@id": `${url}#primaryimage`,
      url: image.source_url,
      contentUrl: image.source_url,
      ...(image.width && image.height ? { width: image.width, height: image.height } : {}),
      ...(caption ? { caption } : {}),
    });
  }
  graph.push(
    {
      "@type": "BreadcrumbList",
      "@id": `${url}#breadcrumb`,
      itemListElement: [
        { "@type": "ListItem", position: 1, name: "Home", item: `${SITE_URL}/` },
        { "@type": "ListItem", position: 2, name: headline },
      ],
    },
    {
      "@type": "WebSite",
      "@id": `${SITE_URL}/#website`,
      url: `${SITE_URL}/`,
      name: SITE_NAME,
      description: SITE_DESCRIPTION,
      potentialAction: [
        {
          "@type": "SearchAction",
          target: { "@type": "EntryPoint", urlTemplate: `${SITE_URL}/?s={search_term_string}` },
          "query-input": { "@type": "PropertyValueSpecification", valueRequired: true, valueName: "search_term_string" },
        },
      ],
      inLanguage: LANG,
    },
  );
  if (person) graph.push(person);

  const minutes = Number(post.meta?.["_yoast_wpseo_estimated-reading-time-minutes"]);
  return {
    title,
    description,
    robots: { index: "index", follow: "follow", "max-snippet": "max-snippet:-1", "max-image-preview": "max-image-preview:large", "max-video-preview": "max-video-preview:-1" },
    canonical,
    og_locale: "en_GB",
    og_type: "article",
    og_title: ogTitle,
    og_description: description,
    og_url: canonical,
    og_site_name: SITE_NAME,
    article_publisher: "https://www.facebook.com/islamonlive",
    article_published_time: published,
    ...(modified ? { article_modified_time: modified } : {}),
    ...(ogImage ? { og_image: ogImage } : {}),
    ...(author ? { author: author.name } : {}),
    twitter_card: "summary_large_image",
    twitter_creator: "@islamonlive",
    twitter_site: "@islamonlive",
    ...(author
      ? { twitter_misc: { "Written by": author.name, ...(minutes > 0 ? { "Estimated reading time": `${minutes} minute${minutes === 1 ? "" : "s"}` } : {}) } }
      : {}),
    schema: { "@context": "https://schema.org", "@graph": graph },
  } as YoastHead;
}

/**
 * The category an editor explicitly made primary, read back from an existing
 * post: Yoast only names a category in the description when one was picked,
 * and it is then the one in the permalink.
 */
export function pickedPrimaryCategory(doc: Pick<PostDoc, "seo" | "path">, categories: CategoryDoc[]): CategoryDoc | null {
  const desc = doc.seo?.description;
  if (!desc) return null;
  const pathSlug = doc.path.split("/").filter(Boolean).slice(-2, -1)[0];
  const cat = categories.find((c) => c.slug === pathSlug);
  return cat && desc.endsWith(` | ${cat.name}`) ? cat : null;
}

/** The earlier Person node Yoast built for this author, so the @id stays the one Google already knows. */
async function priorPerson(authorId: number, excludePostId?: number): Promise<Record<string, unknown> | null> {
  const posts = await collection("posts");
  const doc = await posts.findOne(
    { author_id: authorId, ...(excludePostId ? { _id: { $ne: excludePostId } } : {}), "seo.schema.@graph": { $elemMatch: { "@type": "Person" } } },
    { sort: { published_at: -1 }, projection: { "seo.schema": 1 } },
  );
  const graph = (doc?.seo?.schema?.["@graph"] ?? []) as Record<string, unknown>[];
  return graph.find((n) => n["@type"] === "Person") ?? null;
}

export interface SeoDocInput extends SeoPost {
  _id: number;
  author_id: number | null;
  featured_media_id: number | null;
  categories: number[];
  tags: number[];
  /** Set only when the editor picked a primary category (see pickedPrimaryCategory). */
  picked_primary_category_id?: number | null;
}

/** Load what the head draws on from MongoDB and build it. */
export async function loadSeoRefs(post: SeoDocInput, opts: { excludeSelfFromPerson?: boolean } = {}): Promise<SeoRefs> {
  const [users, media, cats, tags] = await Promise.all([collection("users"), collection("media"), collection("categories"), collection("tags")]);
  const [author, image, catDocs, tagDocs, person] = await Promise.all([
    post.author_id ? users.findOne({ _id: post.author_id }) : null,
    post.featured_media_id ? media.findOne({ _id: post.featured_media_id }) : null,
    post.categories.length ? cats.find({ _id: { $in: post.categories } }).toArray() : [],
    post.tags.length ? tags.find({ _id: { $in: post.tags } }).toArray() : [],
    post.author_id ? priorPerson(post.author_id, opts.excludeSelfFromPerson ? post._id : undefined) : null,
  ]);
  const byOrder = <T extends { _id: number }>(ids: number[], docs: T[]) => ids.map((id) => docs.find((d) => d._id === id)).filter((d): d is T => !!d);
  const categories = byOrder(post.categories, catDocs as CategoryDoc[]);
  return {
    author: author as UserDoc | null,
    person,
    media: image as MediaDoc | null,
    categories,
    tags: byOrder(post.tags, tagDocs as TagDoc[]),
    primaryCategory: categories.find((c) => c._id === post.picked_primary_category_id) ?? null,
  };
}

/** The Yoast head for a post being saved. */
export async function postSeo(post: SeoDocInput): Promise<YoastHead> {
  return buildPostSeo(post, await loadSeoRefs(post));
}

/**
 * @deprecated the original signature posts.ts calls; it has no dates or media,
 * so it publishes "now" and no image. Use postSeo() with the post document.
 */
export async function generateYoastSeo(
  title: string,
  excerpt: string,
  content: string,
  slug: string,
  path: string,
  categories: number[],
  authorId: number | null,
  meta: Record<string, string>,
): Promise<YoastHead> {
  const now = new Date().toISOString().slice(0, 19);
  return postSeo({
    _id: 0,
    title: renderTitle(title),
    rawTitle: title,
    content,
    link: `${SITE_URL}${path}`,
    date: now,
    date_gmt: now,
    modified_gmt: now,
    meta,
    author_id: authorId,
    featured_media_id: null,
    categories,
    tags: [],
  });
}
