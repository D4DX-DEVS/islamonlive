import type { CategoryDoc, MediaDoc, PageDoc, PostDoc, TagDoc, UserDoc } from "@/lib/db/types";
import type { WPCategory, WPPage, WPPost, WPUser } from "@/lib/wp-model";

/* MongoDB documents → the WordPress REST shapes the site already renders.

   Pages and components read posts through WPPost and its helpers (featuredImage,
   primaryCategory, author, …). Producing those same shapes keeps every page and
   its HTML unchanged when DATA_SOURCE flips, which is what the SEO crawl diff
   checks. Field order and embed order follow what the live API returned
   (verified 2026-10-27: embedded terms come in the post's own categories/tags
   order, categories group first). */

type Embedded = NonNullable<WPPost["_embedded"]>;
type EmbeddedAuthor = NonNullable<Embedded["author"]>[number];
type EmbeddedMedia = NonNullable<Embedded["wp:featuredmedia"]>[number];
type EmbeddedTerm = NonNullable<Embedded["wp:term"]>[number][number];

/** Everything a set of posts points at, keyed by WordPress id. */
export interface PostRefs {
  users: Map<number, UserDoc>;
  media: Map<number, MediaDoc>;
  categories: Map<number, CategoryDoc>;
  tags: Map<number, TagDoc>;
}

const GRAVATAR = /(^|\.)gravatar\.com$/i;

function isGravatar(url: string): boolean {
  try {
    return GRAVATAR.test(new URL(url).host);
  } catch {
    return false;
  }
}

/* The migration merged WP's avatar_urls (Gravatar, keys 24/48/96) and the
   Metronet profile photo sizes into one `avatars` map, so a "96" key may be
   either. Split them back: Gravatar URLs are avatar_urls, the rest is
   mpp_avatar — and no photo means no mpp_avatar at all, which the helpers read
   as "draw the fallback icon", exactly as WP's {errors} object did. */
export function splitAvatars(avatars: Record<string, string> | undefined): { avatar_urls: Record<string, string>; mpp_avatar?: Record<string, string> } {
  const avatar_urls: Record<string, string> = {};
  const mpp: Record<string, string> = {};
  for (const [size, url] of Object.entries(avatars ?? {})) {
    if (typeof url !== "string") continue;
    (isGravatar(url) ? avatar_urls : mpp)[size] = url;
  }
  return Object.keys(mpp).length ? { avatar_urls, mpp_avatar: mpp } : { avatar_urls };
}

export function toEmbeddedAuthor(user: UserDoc): EmbeddedAuthor {
  return { id: user._id, slug: user.slug, name: user.name, description: user.description, ...splitAvatars(user.avatars) };
}

/** A generated size lives next to the original: same folder, its own file name. */
function sizeUrl(sourceUrl: string, file: string): string {
  return `${sourceUrl.slice(0, sourceUrl.lastIndexOf("/") + 1)}${file}`;
}

export function toEmbeddedMedia(media: MediaDoc): EmbeddedMedia {
  const sizes: Record<string, { source_url: string; width: number; height?: number }> = {};
  for (const [name, size] of Object.entries(media.sizes ?? {})) {
    if (!size?.file) continue;
    sizes[name] = { source_url: sizeUrl(media.source_url, size.file), width: size.width, height: size.height };
  }
  return {
    source_url: media.source_url,
    alt_text: media.alt_text ?? "",
    caption: { rendered: media.caption ?? "" },
    media_details: {
      ...(media.width != null ? { width: media.width } : {}),
      ...(media.height != null ? { height: media.height } : {}),
      sizes,
    },
  };
}

function toEmbeddedTerm(term: CategoryDoc | TagDoc, taxonomy: "category" | "post_tag"): EmbeddedTerm {
  return { id: term._id, name: term.name, slug: term.slug, taxonomy, link: term.link };
}

/** A post as the list endpoints return it — no body, no SEO head. */
export type ListPostDoc = Omit<PostDoc, "content" | "content_raw" | "seo"> & Partial<Pick<PostDoc, "content" | "seo">>;

/**
 * One post in the REST shape. `full` adds the body and Yoast head, which only
 * the single-article request asks WordPress for; lists leave them out, as WP did.
 */
export function toWPPost(doc: ListPostDoc, refs: PostRefs, full = false): WPPost {
  const embedded: Embedded = {};
  const author = doc.author_id != null ? refs.users.get(doc.author_id) : undefined;
  if (author) embedded.author = [toEmbeddedAuthor(author)];
  const media = doc.featured_media_id ? refs.media.get(doc.featured_media_id) : undefined;
  if (media) embedded["wp:featuredmedia"] = [toEmbeddedMedia(media)];
  embedded["wp:term"] = [
    doc.categories.flatMap((id) => (refs.categories.has(id) ? [toEmbeddedTerm(refs.categories.get(id)!, "category")] : [])),
    doc.tags.flatMap((id) => (refs.tags.has(id) ? [toEmbeddedTerm(refs.tags.get(id)!, "post_tag")] : [])),
  ];

  const post = {
    id: doc._id,
    date: doc.date,
    modified: doc.modified,
    modified_gmt: doc.modified_gmt,
    status: doc.status,
    slug: doc.slug,
    link: doc.link,
    author: doc.author_id,
    title: { rendered: doc.title },
    excerpt: { rendered: doc.excerpt },
    ...(full ? { content: { rendered: doc.content ?? "" } } : {}),
    categories: doc.categories,
    tags: doc.tags,
    ...(full && doc.seo ? { yoast_head_json: doc.seo } : {}),
    _embedded: embedded,
  };
  // Lists carry no `content`, exactly like WP's _fields response; nothing that
  // renders a list reads it.
  return post as WPPost;
}

export function toWPCategory(doc: CategoryDoc | TagDoc, withSeo = false): WPCategory {
  return {
    id: doc._id,
    name: doc.name,
    slug: doc.slug,
    count: doc.count,
    description: doc.description,
    ...("parent_id" in doc ? { parent: doc.parent_id } : {}),
    link: doc.link,
    ...(withSeo && doc.seo ? { yoast_head_json: doc.seo } : {}),
  };
}

export function toWPUser(doc: UserDoc, withSeo = false): WPUser {
  const { avatar_urls, mpp_avatar } = splitAvatars(doc.avatars);
  return {
    id: doc._id,
    name: doc.name,
    slug: doc.slug,
    description: doc.description,
    link: doc.link,
    avatar_urls,
    ...(mpp_avatar ? { mpp_avatar } : {}),
    ...(withSeo && doc.seo ? { yoast_head_json: doc.seo } : {}),
  };
}

export function toWPPage(doc: PageDoc): WPPage {
  return {
    id: doc._id,
    slug: doc.slug,
    link: doc.link,
    modified: doc.modified,
    title: { rendered: doc.title },
    content: { rendered: doc.content },
    ...(doc.seo ? { yoast_head_json: doc.seo } : {}),
  };
}
