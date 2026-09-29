import { NextResponse } from "next/server";
import { wpAdminFetch } from "@/lib/wp-admin";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const base = new URLSearchParams({ context: "edit", per_page: "100", orderby: "name", order: "asc", _fields: "id,name,slug,count,parent" });
    const first = await wpAdminFetch(`/categories?${base}&page=1`);
    const firstData = await first.json();
    if (!first.ok) return NextResponse.json({ error: firstData?.message || "Could not load categories" }, { status: first.status });
    const totalPages = Math.max(1, Number(first.headers.get("X-WP-TotalPages") || 1));
    const remaining = await Promise.all(Array.from({ length: totalPages - 1 }, (_, index) => wpAdminFetch(`/categories?${base}&page=${index + 2}`).then(async (response) => {
      const data = await response.json();
      if (!response.ok) throw new Error(data?.message || "Could not load categories");
      return data;
    })));
    return NextResponse.json({ items: [firstData, ...remaining].flat(), total: Number(first.headers.get("X-WP-Total") || 0) });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Could not load categories";
    return NextResponse.json({ error: message }, { status: message.includes("authentication") ? 401 : 502 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json() as { name?: string; slug?: string; description?: string };
    const name = String(body.name || "").trim();
    if (!name) return NextResponse.json({ error: "Category name is required" }, { status: 400 });
    const response = await wpAdminFetch("/categories", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name, slug: String(body.slug || "").trim(), description: String(body.description || "") }) });
    const data = await response.json();
    if (!response.ok) return NextResponse.json({ error: data?.message || "Category could not be created" }, { status: response.status });
    return NextResponse.json({ item: data }, { status: 201 });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Category could not be created";
    return NextResponse.json({ error: message }, { status: message.includes("authentication") ? 401 : 502 });
  }
}
