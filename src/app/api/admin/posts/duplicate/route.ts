import { NextResponse } from "next/server";
import { wpAdminFetch } from "@/lib/wp-admin";
import { invalidateAdminTaxonomyCache } from "@/lib/admin-taxonomy-cache";
import { POST_STATS_CACHE } from "@/lib/admin-posts";

export const dynamic = "force-dynamic";

/** Copies an article into a new draft (same content, author, categories, tags and featured image). */
export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => null) as { id?: number } | null;
    const id = Number(body?.id || 0);
    if (!Number.isInteger(id) || id < 1) return NextResponse.json({ error: "A valid article id is required" }, { status: 400 });
    const source = await wpAdminFetch(`/posts/${id}?${new URLSearchParams({ context: "edit", _fields: "id,title,content,excerpt,author,categories,tags,featured_media" })}`);
    const post = await source.json();
    if (!source.ok) return NextResponse.json({ error: post?.message || "Could not load the article to copy" }, { status: source.status });
    const payload = {
      title: `${post.title?.raw ?? ""} (Copy)`,
      content: post.content?.raw ?? "",
      excerpt: post.excerpt?.raw ?? "",
      status: "draft",
      author: post.author,
      categories: post.categories ?? [],
      tags: post.tags ?? [],
      ...(post.featured_media ? { featured_media: post.featured_media } : {}),
    };
    const created = await wpAdminFetch("/posts", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
    const data = await created.json();
    if (!created.ok) return NextResponse.json({ error: data?.message || "Could not copy the article" }, { status: created.status });
    invalidateAdminTaxonomyCache(POST_STATS_CACHE);
    return NextResponse.json({ id: data.id }, { status: 201 });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "WordPress request failed";
    return NextResponse.json({ error: message }, { status: message.includes("authentication") ? 401 : 502 });
  }
}
