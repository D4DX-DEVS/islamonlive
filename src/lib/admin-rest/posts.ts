import { createHash } from "node:crypto";
import type { Filter } from "mongodb";
import { collection } from "@/lib/db/client";
import type { PostDoc, PostStatus } from "@/lib/db/types";
import { escapeRegex, json, list, notFound, pastTheEnd, paging, pickFields, readJson, staffRef, wpError, type AdminRequest } from "@/lib/admin-rest/http";
import { recordActivity, type ActivityTarget } from "@/lib/activity";
import { nextId } from "@/lib/admin-rest/ids";
import { sanitizeTitle, uniqueSlug } from "@/lib/admin-rest/slug";
import { fromWallClock, postClocks, siteTimezone } from "@/lib/admin-rest/site-time";
import { toWPPost, type ListPostDoc } from "@/lib/db/adapt";
import { loadRefs } from "@/lib/db/posts";
import { generatePermalink } from "@/lib/admin-rest/posts-permalink";
import { pickedPrimaryCategory, postSeo, rawTitleOf, renderTitle } from "@/lib/admin-rest/posts-seo";
import { generateAutoExcerpt, getDefaultCategory, stripHtml } from "@/lib/admin-rest/posts-helpers";
import { pingIndexNow } from "@/lib/indexnow";
import { forgetMovedPaths } from "@/lib/db/old-paths";
import { SITE_URL } from "@/lib/env";

/* /wp/v2/posts — the slice of WordPress's posts endpoint the admin uses: list,
   read, create, update, trash, all in edit context. wp_insert_post's rules are
   kept where the public site or search engines can see the difference: dates
   in site time, slugs sanitised and unique, drafts slug-less until published,
   a floating draft date that becomes "now" on publish, scheduled posts as
   status future. One deliberate difference: a published post keeps its URL
   when only its categories change (WordPress would move it), and any URL it
   does leave is kept in old_paths so the public lookup can 301 it. */

const STATUSES: PostStatus[] = ["publish", "future", "draft", "pending", "private"];
const LIST_STATUSES = [...STATUSES, "trash"];
const PUBLIC = new Set<string>(["publish", "future"]);
// wp_unique_post_slug refuses these for flat post types: they are feed and embed endpoints
const RESERVED_SLUGS = new Set(["feed", "rdf", "rss", "rss2", "atom", "embed"]);

const sha256 = (text: string) => createHash("sha256").update(text).digest("hex");
const intList = (value: unknown): number[] | null =>
  Array.isArray(value) ? [...new Set(value.map(Number).filter((n) => Number.isInteger(n) && n > 0))] : null;

/** A WordPress auto-excerpt ends in "[&hellip;]"; a typed one is the editor's and is kept. */
const isAutoExcerpt = (rendered: string) => /\[&hellip;\]<\/p>\s*$/.test(rendered);
/** Posts saved here record it (excerpt_raw ""); migrated ones are judged by the ending. */
const hasAutoExcerpt = (doc: PostDoc) => (doc.excerpt_raw !== undefined ? doc.excerpt_raw === "" : isAutoExcerpt(doc.excerpt));

const NAMED: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ", hellip: "…" };
/** Exact inverse of the escaping WordPress (and escText) apply, for the `raw` fields the editor edits. */
function decodeEntities(text: string): string {
  return text.replace(/&(#x[\da-f]+|#\d+|[a-z]+);/gi, (m, e: string) => {
    if (e[0] !== "#") return NAMED[e.toLowerCase()] ?? m;
    const code = e[1] === "x" || e[1] === "X" ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
    return code > 0 && code <= 0x10ffff ? String.fromCodePoint(code) : m;
  });
}

/** Text made safe as HTML/XML character data, leaving entities already present alone (WP's titles are stored rendered). */
const escText = (raw: string) => raw.replace(/&(?!#?\w+;)/g, "&#038;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

/**
 * The stored (rendered) excerpt for what the editor sent. Empty, or an
 * auto-excerpt echoed back by the form, means "derive it from the content"; an
 * HTML excerpt passes through as WordPress keeps it; plain text is wrapped the
 * way wpautop wraps one paragraph.
 */
function renderExcerpt(raw: string, content: string): { excerpt: string; excerpt_raw: string } {
  if (!raw || isAutoExcerpt(raw)) return { excerpt: generateAutoExcerpt(content), excerpt_raw: "" };
  if (/<[a-z][^>]*>/i.test(raw)) return { excerpt: raw.endsWith("\n") ? raw : `${raw}\n`, excerpt_raw: raw };
  return { excerpt: `<p>${escText(raw).replace(/\r?\n/g, "<br />\n")}</p>\n`, excerpt_raw: raw };
}

/** The post in edit context: the public REST shape plus the raw fields and ids the admin reads. */
async function adminPost(doc: PostDoc, full: boolean): Promise<Record<string, unknown>> {
  const refs = await loadRefs([doc as ListPostDoc]);
  const post = toWPPost(doc as ListPostDoc, refs, full) as unknown as Record<string, unknown>;
  const excerptRaw = hasAutoExcerpt(doc) ? "" : doc.excerpt_raw ?? stripHtml(doc.excerpt);
  return {
    ...post,
    date_gmt: doc.date_gmt,
    featured_media: doc.featured_media_id ?? 0,
    title: { raw: rawTitleOf(doc.title), rendered: doc.title },
    excerpt: { raw: decodeEntities(excerptRaw), rendered: doc.excerpt },
    ...(full ? { content: { raw: doc.content_raw ?? doc.content, rendered: doc.content } } : {}),
    meta: doc.meta ?? {},
    // not a WordPress field: lets the admin routes purge cached pages at URLs the post has left
    old_paths: doc.old_paths ?? [],
    // not WordPress fields: the staff accounts that added and last saved the post
    created_by: doc.created_by ?? 0,
    updated_by: doc.updated_by ?? 0,
  };
}

async function postsCollection() {
  return collection("posts");
}

/** wp_unique_post_slug for a flat post type: unique among other posts of any status, never a feed name. */
async function freeSlug(slug: string, postId: number): Promise<string> {
  const posts = await postsCollection();
  const base = RESERVED_SLUGS.has(slug) ? `${slug}-2` : slug;
  return uniqueSlug(base, async (candidate) => RESERVED_SLUGS.has(candidate) || (await posts.countDocuments({ slug: candidate, _id: { $ne: postId } }, { limit: 1 })) > 0);
}

/** The instant an incoming `date` (site-local) or `date_gmt` names, a 400 if it names none, or null if absent. */
function readDate(body: Record<string, unknown>, tz: string): Date | Response | null {
  if (typeof body.date === "string" && body.date) return fromWallClock(body.date, tz) ?? wpError("rest_invalid_param", "Invalid parameter(s): date", 400);
  if (typeof body.date_gmt === "string" && body.date_gmt) {
    const at = new Date(`${body.date_gmt.replace(/Z$/, "")}Z`);
    return Number.isNaN(at.getTime()) ? wpError("rest_invalid_param", "Invalid parameter(s): date_gmt", 400) : at;
  }
  return null;
}

async function checkAuthor(id: number): Promise<boolean> {
  return (await (await collection("users")).countDocuments({ _id: id }, { limit: 1 })) > 0;
}

async function checkMedia(id: number): Promise<boolean> {
  return (await (await collection("media")).countDocuments({ _id: id }, { limit: 1 })) > 0;
}

/* ---------- list / read ---------- */

async function handleList(req: AdminRequest): Promise<Response> {
  const pg = paging(req.query);
  if (pg instanceof Response) return pg;
  const status = req.query.get("status") || "any";
  const filter: Filter<PostDoc> = {};
  if (status === "any") filter.status = { $ne: "trash" };
  else if (status.split(",").every((s) => LIST_STATUSES.includes(s))) filter.status = { $in: status.split(",") as PostStatus[] };
  else return wpError("rest_invalid_param", "Invalid parameter(s): status", 400);

  const author = Number(req.query.get("author") || 0);
  if (Number.isInteger(author) && author > 0) filter.author_id = author;
  const category = Number(req.query.get("categories") || 0);
  if (Number.isInteger(category) && category > 0) filter.categories = category;
  const after = req.query.get("after");
  const before = req.query.get("before");
  if (after && !Number.isNaN(Date.parse(after))) filter.published_at = { $gt: new Date(after) };
  if (before && !Number.isNaN(Date.parse(before))) filter.published_at = { ...(filter.published_at as object), $lt: new Date(before) };
  const search = req.query.get("search")?.trim();
  if (search) {
    // WP ANDs each word, matching title, excerpt or content
    filter.$and = search.split(/\s+/).map((word) => {
      const re = new RegExp(escapeRegex(word), "i");
      return { $or: [{ title: re }, { excerpt: re }, { content: re }] };
    });
  }

  const dir: 1 | -1 = req.query.get("order") === "asc" ? 1 : -1;
  const orderby = req.query.get("orderby") || "date";
  const sort: Record<string, 1 | -1> = orderby === "id" ? { _id: dir } : orderby === "modified" ? { updated_at: dir, _id: dir } : orderby === "title" ? { title: dir, _id: dir } : { published_at: dir, _id: dir };

  const posts = await postsCollection();
  const [docs, total] = await Promise.all([
    posts.find(filter, { projection: { content: 0, content_raw: 0, seo: 0 } }).sort(sort).skip((pg.page - 1) * pg.perPage).limit(pg.perPage).toArray(),
    posts.countDocuments(filter),
  ]);
  const past = pastTheEnd(pg.page, total, pg.perPage);
  if (past) return past;
  const items = await Promise.all(docs.map((d) => adminPost(d as PostDoc, false)));
  const fields = req.query.get("_fields");
  return list(fields ? items.map((item) => pickFields(item, fields)) : items, total, pg.perPage);
}

async function handleGet(req: AdminRequest, id: number): Promise<Response> {
  const doc = await (await postsCollection()).findOne({ _id: id });
  if (!doc) return notFound("post");
  return json(pickFields(await adminPost(doc, true), req.query.get("_fields")));
}

/* ---------- create / update ---------- */

/**
 * Apply an incoming body to a post (a fresh one for create), returning the
 * document to store or a WP error. All of wp_insert_post's derivations live
 * here so create and update cannot drift apart.
 */
async function applyBody(body: Record<string, unknown>, prev: PostDoc | null, id: number, userId: number): Promise<PostDoc | Response> {
  const tz = await siteTimezone();
  // whole seconds, as MySQL's DATETIME kept them, so published_at and date_gmt name the same instant
  const now = new Date(Math.floor(Date.now() / 1000) * 1000);

  const title = typeof body.title === "string" ? body.title.trim() : prev ? rawTitleOf(prev.title) : "";
  const content = typeof body.content === "string" ? body.content.trim() : prev ? prev.content_raw ?? prev.content : "";
  if (!prev && !title && !content) return wpError("empty_content", "Content, title, and excerpt are empty.", 400);

  let status = (typeof body.status === "string" ? body.status : prev?.status ?? "draft") as PostStatus;
  if (!STATUSES.includes(status) && !(prev && status === prev.status)) return wpError("rest_invalid_param", "Invalid parameter(s): status", 400);

  const given = readDate(body, tz);
  if (given instanceof Response) return given;
  const wasPublic = prev ? PUBLIC.has(prev.status) : false;
  // A draft's date floats until it is set: publishing it without one stamps "now", as WordPress does
  const floating = given ? false : prev ? prev.date_floating ?? false : true;
  const published = given ?? (prev && !(floating && PUBLIC.has(status) && !wasPublic) ? prev.published_at ?? now : now);
  if (status === "publish" && published > now) status = "future";
  if (status === "future" && published <= now) status = "publish";

  let slug = typeof body.slug === "string" ? sanitizeTitle(body.slug) : prev ? prev.slug : "";
  // drafts and pending posts stay slug-less until published; then the title supplies one
  if (!slug && !["draft", "pending"].includes(status)) slug = sanitizeTitle(title) || String(id);
  if (slug && slug !== prev?.slug) slug = await freeSlug(slug, id);

  const categories = intList(body.categories) ?? prev?.categories ?? [];
  if (!categories.length) categories.push(await getDefaultCategory());
  const tags = intList(body.tags) ?? prev?.tags ?? [];

  let author = prev?.author_id ?? userId;
  if (body.author !== undefined) {
    author = Number(body.author);
    if (!Number.isInteger(author) || !(await checkAuthor(author))) return wpError("rest_invalid_author", "Invalid author ID.", 400);
  }

  let featured = prev?.featured_media_id ?? null;
  if (body.featured_media !== undefined) {
    const mediaId = Number(body.featured_media);
    if (!Number.isInteger(mediaId) || mediaId < 0) return wpError("rest_invalid_param", "Invalid parameter(s): featured_media", 400);
    if (mediaId > 0 && !(await checkMedia(mediaId))) return wpError("rest_invalid_featured_media", "Invalid featured media ID.", 400);
    featured = mediaId || null;
  }

  // no excerpt sent: keep the stored one, refreshing an auto-excerpt when the body changed
  const excerpts =
    typeof body.excerpt === "string" || !prev
      ? renderExcerpt(typeof body.excerpt === "string" ? body.excerpt.trim() : "", content)
      : hasAutoExcerpt(prev)
        ? { excerpt: generateAutoExcerpt(content), excerpt_raw: "" }
        : { excerpt: prev.excerpt, excerpt_raw: prev.excerpt_raw ?? stripHtml(prev.excerpt) };

  const meta = { ...(prev?.meta ?? {}) };
  if (body.meta && typeof body.meta === "object") {
    for (const [key, value] of Object.entries(body.meta as Record<string, unknown>)) if (typeof value === "string") meta[key] = value;
  }

  /* Yoast's primary category: the one the editor sends, else the one an
     existing post was given (only Yoast's description reveals it). */
  const sentPrimary = Number(meta._yoast_wpseo_primary_category) || null;
  const picked = sentPrimary && categories.includes(sentPrimary) ? sentPrimary : prev ? pickedPrimaryCategory(prev, await (await collection("categories")).find({ _id: { $in: prev.categories } }).toArray())?._id ?? null : null;

  /* The URL. A post that was public keeps its category part for good and
     moves only when its slug changes; a draft's is derived when it goes out.
     A path it leaves while public goes to old_paths. */
  const keepPath = prev && wasPublic && prev.slug === slug && prev.path;
  const permalink = keepPath
    ? { path: prev.path, link: prev.link, primaryCategoryId: prev.primary_category_id }
    : slug
      ? await generatePermalink(id, slug, categories, prev && wasPublic ? prev.path : undefined, picked ?? (wasPublic ? prev?.primary_category_id : null))
      : { path: "", link: `${SITE_URL}/?p=${id}`, primaryCategoryId: null };
  const oldPaths = new Set(prev?.old_paths ?? []);
  if (prev && wasPublic && prev.path && prev.path !== permalink.path) oldPaths.add(prev.path);
  oldPaths.delete(permalink.path);

  const doc: PostDoc = {
    ...(prev ?? { content_raw: null, password: null, format: "standard", sticky: false, comment_status: "closed", featured_video: null }),
    _id: id,
    status,
    slug,
    link: permalink.link,
    path: permalink.path,
    // stored rendered, as WordPress shows it; < and > escaped too, since feeds print titles as-is
    title: renderTitle(title.replace(/</g, "&lt;").replace(/>/g, "&gt;")),
    ...excerpts,
    content,
    // the editor saves HTML; once saved here the stored body is the source
    content_raw: null,
    content_sha256: sha256(content),
    author_id: author,
    featured_media_id: featured,
    categories,
    primary_category_id: permalink.primaryCategoryId,
    tags,
    meta,
    date_floating: floating && !PUBLIC.has(status) ? true : undefined,
    ...postClocks(published, now, tz),
    published_at: published,
    updated_at: now,
    seo: null,
  } as PostDoc;
  if (oldPaths.size) doc.old_paths = [...oldPaths];
  else delete doc.old_paths;
  doc.seo = slug ? await postSeo({ ...doc, rawTitle: title, content, meta, picked_primary_category_id: picked }) : prev?.seo ?? null;
  return doc;
}

function postTarget(doc: PostDoc): ActivityTarget {
  return { type: "post", id: doc._id, title: decodeEntities(doc.title), link: doc.path || null };
}

/** Tell IndexNow about a URL that just appeared or changed in public. Best effort, never awaited by the caller's response. */
function announce(doc: PostDoc, prev: PostDoc | null): void {
  if (doc.status !== "publish") return;
  const urls = [doc.link];
  if (prev?.status === "publish" && prev.link !== doc.link) urls.push(prev.link);
  void pingIndexNow(urls);
}

async function handleCreate(req: AdminRequest): Promise<Response> {
  const body = await readJson(req);
  if (body instanceof Response) return body;
  if (body.id !== undefined) return wpError("rest_post_exists", "Cannot create existing post.", 400);
  const id = await nextId("post");
  const doc = await applyBody(body, null, id, req.user.id);
  if (doc instanceof Response) return doc;
  doc.created_by = req.user.id;
  doc.updated_by = req.user.id;
  await (await postsCollection()).insertOne(doc);
  announce(doc, null);
  await recordActivity(staffRef(req.user), PUBLIC.has(doc.status) ? "post.publish" : "post.create", postTarget(doc));
  return json(await adminPost(doc, true), 201);
}

async function handleUpdate(req: AdminRequest, id: number): Promise<Response> {
  const posts = await postsCollection();
  const prev = await posts.findOne({ _id: id });
  if (!prev) return notFound("post");
  const body = await readJson(req);
  if (body instanceof Response) return body;
  const doc = await applyBody(body, prev, id, req.user.id);
  if (doc instanceof Response) return doc;
  doc.updated_by = req.user.id;
  await posts.replaceOne({ _id: id }, doc);
  if (doc.path !== prev.path || doc.status !== prev.status) forgetMovedPaths();
  announce(doc, prev);
  await recordActivity(staffRef(req.user), PUBLIC.has(doc.status) && !PUBLIC.has(prev.status) ? "post.publish" : "post.update", postTarget(doc));
  return json(await adminPost(doc, true));
}

/** DELETE without force moves to the trash, as wp_trash_post does: the slug gets __trashed so it is free again. */
async function handleTrash(req: AdminRequest, id: number): Promise<Response> {
  const posts = await postsCollection();
  const prev = await posts.findOne({ _id: id });
  if (!prev) return notFound("post");
  if (req.query.get("force") === "true") return wpError("rest_cannot_delete", "Permanent deletion is not available here; use the trash.", 501);
  if (prev.status === "trash") return wpError("rest_already_trashed", "The post has already been deleted.", 410);
  const tz = await siteTimezone();
  const now = new Date();
  const { modified, modified_gmt } = postClocks(prev.published_at ?? now, now, tz);
  const update = { status: "trash" as const, slug: `${prev.slug || sanitizeTitle(decodeEntities(prev.title)) || id}__trashed`, desired_slug: prev.slug, trashed_from: prev.status, modified, modified_gmt, updated_at: now, updated_by: req.user.id };
  await posts.updateOne({ _id: id }, { $set: update });
  await recordActivity(staffRef(req.user), "post.trash", postTarget(prev));
  return json(await adminPost({ ...prev, ...update }, true));
}

export async function handlePosts(req: AdminRequest): Promise<Response | null> {
  const [ns, version, type, idPart, extra] = req.segments;
  if (ns !== "wp" || version !== "v2" || type !== "posts" || extra !== undefined) return null;
  if (idPart === undefined) {
    if (req.method === "GET") return handleList(req);
    if (req.method === "POST") return handleCreate(req);
    return null;
  }
  const id = Number(idPart);
  if (!Number.isInteger(id) || id < 1) return notFound("post");
  if (req.method === "GET") return handleGet(req, id);
  if (req.method === "POST" || req.method === "PUT" || req.method === "PATCH") return handleUpdate(req, id);
  if (req.method === "DELETE") return handleTrash(req, id);
  return null;
}
