import { NextResponse } from "next/server";
import { wpAdminFetch } from "@/lib/wp-admin";
import { decodeEntities } from "@/lib/wordpress";
import { invalidateAdminTaxonomyCache } from "@/lib/admin-taxonomy-cache";
import { parsePublishDate, parseSeo, POST_STATS_CACHE, resolveTagIds } from "@/lib/admin-posts";
import { parseVideoChange, readFeaturedVideo, saveFeaturedVideo, type VideoChange } from "@/lib/featured-video";

export const dynamic = "force-dynamic";

const PER_PAGE = 10;
const STATUSES = ["any", "publish", "draft", "pending", "private", "future", "trash"];
const DATE_WINDOWS = [7, 30, 90, 365];

function errorResponse(error: unknown) {
  const message = error instanceof Error ? error.message : "WordPress request failed";
  return NextResponse.json({ error: message }, { status: message.includes("authentication") ? 401 : 502 });
}

/** The SEO fields and featured video the editor sent, or an error response when the video is not one WordPress would take. */
function readExtras(form: FormData): { meta: Record<string, string> | null; video: VideoChange | null } | NextResponse {
  const video = parseVideoChange(form.get("featuredVideo"));
  if (video === "invalid") return NextResponse.json({ error: "The featured video link is not a YouTube, Vimeo or Dailymotion address, or its upload is missing." }, { status: 400 });
  return { meta: parseSeo(form.get("seo")), video };
}

/** Attaches the featured video once the article exists; a failure is reported, not thrown, as the article is saved. */
async function attachVideo(postId: number, video: VideoChange | null): Promise<string[]> {
  if (!video) return [];
  const problem = await saveFeaturedVideo(postId, video);
  return problem ? [`The article was saved, but its featured video was not: ${problem}`] : [];
}

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const idParam = url.searchParams.get("id");
    const id = Number(idParam || 0);
    if (idParam !== null && (!Number.isInteger(id) || id < 1)) return NextResponse.json({ error: "A valid article id is required" }, { status: 400 });
    if (id) {
      const query = new URLSearchParams({ context: "edit", _embed: "1", _fields: "id,date,date_gmt,modified,modified_gmt,status,slug,link,title,excerpt,content,author,categories,tags,featured_media,meta,_links,_embedded" });
      const response = await wpAdminFetch(`/posts/${id}?${query}`);
      const data = await response.json();
      if (!response.ok) return NextResponse.json({ error: data?.message || "Could not load article" }, { status: response.status });
      const terms = (data._embedded?.["wp:term"] ?? []).flat() as { taxonomy?: string; name?: string }[];
      const tags = terms.filter((term) => term.taxonomy === "post_tag" && term.name).map((term) => decodeEntities(String(term.name)));
      const featuredVideo = await readFeaturedVideo(id, String(data.title?.raw || data.title?.rendered || ""));
      return NextResponse.json({ item: data, tags, featuredVideo });
    }
    const page = Math.max(1, Number(url.searchParams.get("page") || 1));
    const search = url.searchParams.get("search")?.trim();
    const status = url.searchParams.get("status") || "any";
    if (!STATUSES.includes(status)) return NextResponse.json({ error: "Invalid article status" }, { status: 400 });
    const query = new URLSearchParams({ context: "edit", page: String(page), per_page: String(PER_PAGE), orderby: "date", order: "desc", _fields: "id,date,date_gmt,modified,status,title,author,categories,link" });
    if (search) query.set("search", search);
    if (status !== "any") query.set("status", status);
    const author = Number(url.searchParams.get("author") || 0);
    if (Number.isInteger(author) && author > 0) query.set("author", String(author));
    const category = Number(url.searchParams.get("category") || 0);
    if (Number.isInteger(category) && category > 0) query.set("categories", String(category));
    const days = Number(url.searchParams.get("days") || 0);
    if (DATE_WINDOWS.includes(days)) query.set("after", new Date(Date.now() - days * 86_400_000).toISOString());
    const response = await wpAdminFetch(`/posts?${query}`);
    const data = await response.json();
    if (!response.ok) return NextResponse.json({ error: data?.message || "Could not load articles" }, { status: response.status });
    return NextResponse.json({ items: data, total: Number(response.headers.get("X-WP-Total") || 0), totalPages: Number(response.headers.get("X-WP-TotalPages") || 0) });
  } catch (error: unknown) {
    return errorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    const form = await request.formData();
    const title = String(form.get("title") || "").trim();
    const content = String(form.get("content") || "").trim();
    const status = String(form.get("status") || "draft");
    if (!title || !content) return NextResponse.json({ error: "Title and content are required" }, { status: 400 });
    if (!["draft", "publish", "pending", "private"].includes(status)) return NextResponse.json({ error: "Invalid article status" }, { status: 400 });
    const extras = readExtras(form);
    if (extras instanceof NextResponse) return extras;
    let featuredMedia = 0;
    const image = form.get("featuredImage");
    const imageAlt = String(form.get("featuredImageAlt") || "").trim();
    if (image instanceof File && image.size > 0) {
      if (image.size > 10 * 1024 * 1024) return NextResponse.json({ error: "Featured image must be 10 MB or smaller" }, { status: 413 });
      const bytes = await image.arrayBuffer();
      const media = await wpAdminFetch("/media", { method: "POST", headers: { "Content-Type": image.type || "application/octet-stream", "Content-Disposition": `attachment; filename="${image.name.replace(/[^\w.\-]/g, "_")}"` }, body: bytes });
      const mediaData = await media.json();
      if (!media.ok) return NextResponse.json({ error: mediaData?.message || "Featured image upload failed" }, { status: media.status });
      featuredMedia = Number(mediaData.id || 0);
      if (featuredMedia && form.has("featuredImageAlt")) await wpAdminFetch(`/media/${featuredMedia}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ alt_text: imageAlt }) }).catch(() => undefined);
    }
    const payload: Record<string, unknown> = { title, content, status, excerpt: String(form.get("excerpt") || "") };
    const author = Number(form.get("author") || 0);
    const categories = String(form.get("categories") || "[]");
    if (author) payload.author = author;
    try { payload.categories = JSON.parse(categories); } catch { payload.categories = []; }
    const date = parsePublishDate(form.get("date"));
    if (date) payload.date = date;
    if (form.has("tags")) payload.tags = await resolveTagIds(String(form.get("tags")));
    if (featuredMedia) payload.featured_media = featuredMedia;
    if (extras.meta) payload.meta = extras.meta;
    const response = await wpAdminFetch("/posts", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
    const data = await response.json();
    if (!response.ok) {
      if (featuredMedia) await wpAdminFetch(`/media/${featuredMedia}?force=true`, { method: "DELETE" }).catch(() => undefined);
      return NextResponse.json({ error: data?.message || "Article could not be created" }, { status: response.status });
    }
    invalidateAdminTaxonomyCache(POST_STATS_CACHE);
    return NextResponse.json({ item: data, warnings: await attachVideo(Number(data.id), extras.video) }, { status: 201 });
  } catch (error: unknown) {
    return errorResponse(error);
  }
}

export async function PUT(request: Request) {
  let featuredMedia = 0;
  try {
    const url = new URL(request.url);
    const id = Number(url.searchParams.get("id") || 0);
    if (!Number.isInteger(id) || id < 1) return NextResponse.json({ error: "A valid article id is required" }, { status: 400 });
    const form = await request.formData();
    const title = String(form.get("title") || "").trim();
    const content = String(form.get("content") || "").trim();
    const status = String(form.get("status") || "draft");
    if (!title || !content) return NextResponse.json({ error: "Title and content are required" }, { status: 400 });
    if (!["draft", "publish", "pending", "private"].includes(status)) return NextResponse.json({ error: "Invalid article status" }, { status: 400 });
    const extras = readExtras(form);
    if (extras instanceof NextResponse) return extras;

    const image = form.get("featuredImage");
    const imageAlt = String(form.get("featuredImageAlt") || "").trim();
    if (image instanceof File && image.size > 0) {
      if (image.size > 10 * 1024 * 1024) return NextResponse.json({ error: "Featured image must be 10 MB or smaller" }, { status: 413 });
      const bytes = await image.arrayBuffer();
      const media = await wpAdminFetch("/media", { method: "POST", headers: { "Content-Type": image.type || "application/octet-stream", "Content-Disposition": `attachment; filename="${image.name.replace(/[^\w.\-]/g, "_")}"` }, body: bytes });
      const mediaData = await media.json();
      if (!media.ok) return NextResponse.json({ error: mediaData?.message || "Featured image upload failed" }, { status: media.status });
      featuredMedia = Number(mediaData.id || 0);
      if (featuredMedia && imageAlt) await wpAdminFetch(`/media/${featuredMedia}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ alt_text: imageAlt }) }).catch(() => undefined);
    }

    const payload: Record<string, unknown> = { title, content, status, excerpt: String(form.get("excerpt") || "") };
    const author = Number(form.get("author") || 0);
    const categories = String(form.get("categories") || "[]");
    if (author) payload.author = author;
    try { payload.categories = JSON.parse(categories); } catch { payload.categories = []; }
    const date = parsePublishDate(form.get("date"));
    if (date) payload.date = date;
    if (form.has("tags")) payload.tags = await resolveTagIds(String(form.get("tags")));
    if (featuredMedia) payload.featured_media = featuredMedia;
    else if (form.get("removeFeaturedImage") === "true") payload.featured_media = 0;
    if (extras.meta) payload.meta = extras.meta;

    const response = await wpAdminFetch(`/posts/${id}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
    const data = await response.json();
    if (!response.ok) {
      if (featuredMedia) await wpAdminFetch(`/media/${featuredMedia}?force=true`, { method: "DELETE" }).catch(() => undefined);
      return NextResponse.json({ error: data?.message || "Article could not be updated" }, { status: response.status });
    }

    const existingMedia = Number(form.get("existingFeaturedMedia") || 0);
    if (!featuredMedia && existingMedia && form.has("featuredImageAlt")) {
      await wpAdminFetch(`/media/${existingMedia}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ alt_text: imageAlt }) }).catch(() => undefined);
    }
    invalidateAdminTaxonomyCache(POST_STATS_CACHE);
    return NextResponse.json({ item: data, warnings: await attachVideo(id, extras.video) });
  } catch (error: unknown) {
    if (featuredMedia) await wpAdminFetch(`/media/${featuredMedia}?force=true`, { method: "DELETE" }).catch(() => undefined);
    return errorResponse(error);
  }
}

/** Moves an article to the WordPress trash (recoverable there); never deletes it for good. */
export async function DELETE(request: Request) {
  try {
    const id = Number(new URL(request.url).searchParams.get("id") || 0);
    if (!Number.isInteger(id) || id < 1) return NextResponse.json({ error: "A valid article id is required" }, { status: 400 });
    const response = await wpAdminFetch(`/posts/${id}`, { method: "DELETE" });
    const data = await response.json();
    if (!response.ok) return NextResponse.json({ error: data?.message || "Could not move the article to the trash" }, { status: response.status });
    invalidateAdminTaxonomyCache(POST_STATS_CACHE);
    return NextResponse.json({ ok: true });
  } catch (error: unknown) {
    return errorResponse(error);
  }
}
