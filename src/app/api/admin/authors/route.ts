import { NextResponse } from "next/server";
import { wpAdminFetch } from "@/lib/wp-admin";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const base = new URLSearchParams({ context: "edit", per_page: "100", orderby: "name", order: "asc", roles: "author,editor,administrator", _fields: "id,name,slug,email,roles" });
    const first = await wpAdminFetch(`/users?${base}&page=1`);
    const firstData = await first.json();
    if (!first.ok) return NextResponse.json({ error: firstData?.message || "Could not load authors" }, { status: first.status });
    const totalPages = Math.max(1, Number(first.headers.get("X-WP-TotalPages") || 1));
    const remaining: unknown[][] = [];
    for (let page = 2; page <= totalPages; page += 5) {
      const pages = await Promise.all(Array.from({ length: Math.min(5, totalPages - page + 1) }, (_, index) => wpAdminFetch(`/users?${base}&page=${page + index}`).then(async (response) => {
        const data = await response.json();
        if (!response.ok) throw new Error(data?.message || "Could not load authors");
        return data as unknown[];
      })));
      remaining.push(...pages);
    }
    return NextResponse.json({ items: [firstData, ...remaining].flat(), total: Number(first.headers.get("X-WP-Total") || 0) });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Could not load authors";
    return NextResponse.json({ error: message }, { status: message.includes("authentication") ? 401 : 502 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json() as Record<string, unknown>;
    const username = String(body.username || "").trim();
    const email = String(body.email || "").trim();
    const password = String(body.password || "");
    const name = String(body.name || "").trim();
    if (!username || !email || !password || !name) return NextResponse.json({ error: "Name, username, email and password are required" }, { status: 400 });
    const payload = { username, email, password, name, slug: String(body.slug || "").trim(), description: String(body.description || ""), roles: ["author"] };
    const response = await wpAdminFetch("/users", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
    const data = await response.json();
    if (!response.ok) return NextResponse.json({ error: data?.message || "Author could not be created" }, { status: response.status });
    return NextResponse.json({ item: data }, { status: 201 });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Author could not be created";
    return NextResponse.json({ error: message }, { status: message.includes("authentication") ? 401 : 502 });
  }
}
