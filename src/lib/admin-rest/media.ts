import { collection } from "@/lib/db/client";
import type { MediaDoc } from "@/lib/db/types";
import { json, notFound, pickFields, readJson, staffRef, wpError, type AdminRequest } from "@/lib/admin-rest/http";
import { recordActivity } from "@/lib/activity";
import { getImageDimensions } from "@/lib/admin-rest/image-dimensions";
import { nextId } from "@/lib/admin-rest/ids";
import { postClocks, siteTimezone, wallClock } from "@/lib/admin-rest/site-time";
import { sanitizeTitle, uniqueSlug } from "@/lib/admin-rest/slug";
import { deleteFromSpaces, existsInSpaces, uploadToSpaces } from "@/lib/spaces";

/* /wp/v2/media — upload, alt/caption/title, delete, read. Files go to Spaces
   under the same wp-content/uploads/YYYY/MM/ keys the migrated library uses, so
   source_url keeps the https://islamonlive.in/wp-content/uploads/… form that
   lib/urls.ts already maps to the CDN. Only the types the admin offers
   (lib/admin-upload.ts) are accepted, and only when the bytes agree with the
   declared type: a renamed HTML or SVG file never reaches the public bucket. */

const TYPES: Record<string, { ext: string; sniff: (b: Uint8Array) => boolean }> = {
  "image/jpeg": { ext: "jpg", sniff: (b) => b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff },
  "image/png": { ext: "png", sniff: (b) => ascii(b, 1, 3) === "PNG" && b[0] === 0x89 },
  "image/gif": { ext: "gif", sniff: (b) => ascii(b, 0, 4) === "GIF8" },
  "image/webp": { ext: "webp", sniff: (b) => ascii(b, 0, 4) === "RIFF" && ascii(b, 8, 4) === "WEBP" },
  "image/avif": { ext: "avif", sniff: (b) => ascii(b, 4, 4) === "ftyp" && /^avi[fs]|^mif1/.test(ascii(b, 8, 4)) },
  "video/mp4": { ext: "mp4", sniff: (b) => ascii(b, 4, 4) === "ftyp" },
  "video/quicktime": { ext: "mov", sniff: (b) => ["ftyp", "moov", "mdat", "free", "wide", "skip"].includes(ascii(b, 4, 4)) },
  "video/webm": { ext: "webm", sniff: (b) => b[0] === 0x1a && b[1] === 0x45 && b[2] === 0xdf && b[3] === 0xa3 },
  "video/ogg": { ext: "ogv", sniff: (b) => ascii(b, 0, 4) === "OggS" },
};

function ascii(bytes: Uint8Array, start: number, length: number): string {
  return String.fromCharCode(...bytes.subarray(start, start + length));
}

/** The request body as bytes, whatever form the caller passed (the admin sends an ArrayBuffer). */
async function bodyBytes(body: AdminRequest["body"]): Promise<Uint8Array | null> {
  if (body == null) return null;
  if (body instanceof Uint8Array) return body;
  if (body instanceof ArrayBuffer) return new Uint8Array(body);
  if (ArrayBuffer.isView(body)) return new Uint8Array(body.buffer, body.byteOffset, body.byteLength);
  try {
    return new Uint8Array(await new Response(body as BodyInit).arrayBuffer());
  } catch {
    return null;
  }
}

/** sanitize_file_name, reduced to what reaches us: the admin already maps everything outside [\w.-] to "_". */
function fileName(disposition: string, ext: string): { base: string; ext: string } {
  const quoted = /filename\*?=(?:UTF-8'')?"?([^";]+)"?/i.exec(disposition)?.[1] ?? "";
  let name = quoted;
  try {
    name = decodeURIComponent(quoted);
  } catch {
    /* keep it as sent */
  }
  name = name.split(/[\\/]/).pop() ?? "";
  const dot = name.lastIndexOf(".");
  const stem = (dot > 0 ? name.slice(0, dot) : name).replace(/[^\w.-]+/g, "-").replace(/[-_.]{2,}/g, "-").replace(/^[-_.]+|[-_.]+$/g, "");
  return { base: stem || "upload", ext };
}

const mediaType = (mime: string | null) => (mime?.startsWith("video/") ? "video" : mime?.startsWith("image/") ? "image" : "file");

/** The attachment as WP REST returns it in edit context, trimmed to the fields any caller reads. */
function attachment(doc: MediaDoc): Record<string, unknown> {
  const file = doc.key?.replace(/^wp-content\/uploads\//, "") ?? "";
  return {
    id: doc._id,
    date: doc.date,
    modified: doc.modified,
    slug: doc.slug,
    status: doc.status,
    type: "attachment",
    link: doc.source_url,
    title: { raw: doc.title, rendered: doc.title },
    author: doc.author_id ?? 0,
    post: doc.post_id,
    alt_text: doc.alt_text,
    caption: { raw: doc.caption, rendered: doc.caption ? `<p>${doc.caption}</p>\n` : "" },
    media_type: mediaType(doc.mime_type),
    mime_type: doc.mime_type,
    media_details: { width: doc.width ?? undefined, height: doc.height ?? undefined, file, filesize: doc.filesize ?? undefined, sizes: doc.sizes ?? {} },
    source_url: doc.source_url,
  };
}

async function upload(req: AdminRequest): Promise<Response> {
  const mime = (req.headers.get("Content-Type") || "").split(";")[0].trim().toLowerCase();
  const type = TYPES[mime];
  if (!type) return wpError("rest_upload_sideload_error", "Sorry, you are not allowed to upload this file type.", 415);
  const bytes = await bodyBytes(req.body);
  if (!bytes?.length) return wpError("rest_upload_no_data", "No data supplied.", 400);
  if (!type.sniff(bytes)) return wpError("rest_upload_sideload_error", "The file's content does not match its type.", 415);

  const tz = await siteTimezone();
  const now = new Date();
  // the uploads folder follows the site's calendar, as wp_upload_dir does
  const month = wallClock(now, tz).slice(0, 7).replace("-", "/");
  const { base, ext } = fileName(req.headers.get("Content-Disposition") || "", type.ext);

  // wp_unique_filename: name.ext, name-1.ext, name-2.ext … against the library and the bucket
  const media = await collection("media");
  let name = `${base}.${ext}`;
  for (let n = 1; ; n++) {
    const key = `wp-content/uploads/${month}/${name}`;
    const taken = (await media.countDocuments({ key: { $regex: `^${key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`, $options: "i" } }, { limit: 1 })) > 0 || (await existsInSpaces(key));
    if (!taken) break;
    if (n > 999) return wpError("rest_upload_unknown_error", "Could not find a free file name.", 500);
    name = `${base}-${n}.${ext}`;
  }
  const key = `wp-content/uploads/${month}/${name}`;
  const objectKey = await uploadToSpaces(key, mime, bytes);
  if (!objectKey) return wpError("rest_upload_unknown_error", "The file could not be stored.", 500);

  const id = await nextId("post");
  const title = name.replace(/\.[^.]+$/, "");
  const slug = await uniqueSlug(sanitizeTitle(title) || String(id), async (c) => (await media.countDocuments({ slug: c }, { limit: 1 })) > 0);
  const dims = mime.startsWith("image/") ? getImageDimensions(bytes) : null;
  const { date, modified } = postClocks(now, now, tz);
  const doc: MediaDoc = {
    _id: id,
    post_id: null,
    status: "inherit",
    slug,
    title,
    alt_text: "",
    caption: "",
    mime_type: mime,
    key,
    spaces_key: objectKey,
    source_url: `https://islamonlive.in/${key.split("/").map(encodeURIComponent).join("/")}`,
    width: dims?.width ?? null,
    height: dims?.height ?? null,
    filesize: bytes.length,
    sizes: {},
    original_file: null,
    is_file: true,
    date,
    modified,
    uploaded_at: now,
    author_id: req.user.id,
  };
  await media.insertOne(doc);
  await recordActivity(staffRef(req.user), "media.upload", { type: "media", id: doc._id, title: doc.title || doc.slug, link: doc.source_url });
  return json(attachment(doc), 201);
}

async function update(req: AdminRequest, id: number): Promise<Response> {
  const body = await readJson(req);
  if (body instanceof Response) return body;
  const media = await collection("media");
  const doc = await media.findOne({ _id: id });
  if (!doc) return notFound("post");
  const set: Partial<MediaDoc> = {};
  for (const field of ["alt_text", "caption", "title"] as const) {
    const value = body[field];
    if (typeof value === "string") set[field] = value.trim();
  }
  if (Object.keys(set).length) {
    const tz = await siteTimezone();
    set.modified = wallClock(new Date(), tz);
    await media.updateOne({ _id: id }, { $set: set });
  }
  return json(attachment({ ...doc, ...set }));
}

/** force=true deletes the record and its file(s); attachments have no trash, exactly as in WordPress. */
async function remove(req: AdminRequest, id: number): Promise<Response> {
  if (req.query.get("force") !== "true") return wpError("rest_trash_not_supported", "Attachments do not support trashing. Set 'force' to true to delete.", 501);
  const media = await collection("media");
  const doc = await media.findOne({ _id: id });
  if (!doc) return notFound("post");
  if (doc.spaces_key) {
    const folder = doc.spaces_key.slice(0, doc.spaces_key.lastIndexOf("/") + 1);
    const sized = Object.values(doc.sizes ?? {}).map((s) => `${folder}${s.file}`);
    await Promise.all([doc.spaces_key, ...sized].map((k) => deleteFromSpaces(k)));
  }
  await media.deleteOne({ _id: id });
  await recordActivity(staffRef(req.user), "media.delete", { type: "media", id, title: doc.title || doc.slug, link: null });
  return json({ deleted: true, previous: attachment(doc) });
}

export async function handleMedia(req: AdminRequest): Promise<Response | null> {
  const [ns, version, type, idPart, extra] = req.segments;
  if (ns !== "wp" || version !== "v2" || type !== "media" || extra !== undefined) return null;
  if (idPart === undefined) return req.method === "POST" ? upload(req) : null;
  const id = Number(idPart);
  if (!Number.isInteger(id) || id < 1) return notFound("post");
  if (req.method === "GET") {
    const doc = await (await collection("media")).findOne({ _id: id });
    return doc ? json(pickFields(attachment(doc), req.query.get("_fields"))) : notFound("post");
  }
  if (req.method === "POST" || req.method === "PUT" || req.method === "PATCH") return update(req, id);
  if (req.method === "DELETE") return remove(req, id);
  return null;
}
