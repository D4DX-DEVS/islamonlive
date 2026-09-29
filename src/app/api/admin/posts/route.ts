import { NextResponse } from "next/server";
import { wpAdminFetch } from "@/lib/wp-admin";

export const dynamic = "force-dynamic";

function errorResponse(error: unknown) {
  const message = error instanceof Error ? error.message : "WordPress request failed";
  return NextResponse.json({ error: message }, { status: message.includes("authentication") ? 401 : 502 });
}

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const idParam = url.searchParams.get("id");
    const id = Number(idParam || 0);
    if (idParam !== null && (!Number.isInteger(id) || id < 1)) return NextResponse.json({ error: "A valid article id is required" }, { status: 400 });
    if (id) {
      const query = new URLSearchParams({ context: "edit", _embed: "1", _fields: "id,date,date_gmt,modified,modified_gmt,status,slug,link,title,excerpt,content,author,categories,featured_media,_links,_embedded" });
      const response = await wpAdminFetch(`/posts/${id}?${query}`);
      const data = await response.json();
      if (!response.ok) return NextResponse.json({ error: data?.message || "Could not load article" }, { status: response.status });
      return NextResponse.json({ item: data });
    }
    const page = Math.max(1, Number(url.searchParams.get("page") || 1));
    const search = url.searchParams.get("search")?.trim();
    const status = url.searchParams.get("status") || "any";
    const query = new URLSearchParams({ context: "edit", page: String(page), per_page: "20", orderby: "date", order: "desc", _fields: "id,date,date_gmt,modified,status,title,author" });
    if (search) query.set("search", search);
    if (status !== "any") query.set("status", status);
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
    if (featuredMedia) payload.featured_media = featuredMedia;
    const response = await wpAdminFetch("/posts", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
    const data = await response.json();
    if (!response.ok) {
      if (featuredMedia) await wpAdminFetch(`/media/${featuredMedia}?force=true`, { method: "DELETE" }).catch(() => undefined);
      return NextResponse.json({ error: data?.message || "Article could not be created" }, { status: response.status });
    }
    return NextResponse.json({ item: data }, { status: 201 });
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
    if (featuredMedia) payload.featured_media = featuredMedia;
    else if (form.get("removeFeaturedImage") === "true") payload.featured_media = 0;

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
    return NextResponse.json({ item: data });
  } catch (error: unknown) {
    if (featuredMedia) await wpAdminFetch(`/media/${featuredMedia}?force=true`, { method: "DELETE" }).catch(() => undefined);
    return errorResponse(error);
  }
}
