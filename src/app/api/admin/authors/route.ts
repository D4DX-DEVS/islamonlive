import { NextResponse } from "next/server";
import { getAdminSession, wpAdminFetch, wpAdminRoute } from "@/lib/wp-admin";
import { mediaOriginUrl } from "@/lib/urls";
import { uploadMedia } from "@/lib/admin-media";
import { PHOTO_LIMIT_BYTES } from "@/lib/admin-upload";
import { adminTaxonomyCacheHeaders, getAdminTaxonomyCached, invalidateAdminTaxonomyCache } from "@/lib/admin-taxonomy-cache";

export const dynamic = "force-dynamic";

/**
 * The author's own uploaded photo (Metronet Profile Picture). WordPress's
 * Gravatar `avatar_urls` is always the grey placeholder on this site, so it is
 * ignored; `mpp_avatar` is an {errors} object when the user has no photo.
 */
function withAvatar<T extends { mpp_avatar?: unknown }>({ mpp_avatar: photo, ...user }: T): Omit<T, "mpp_avatar"> & { avatar: string | null } {
  const sizes = photo && typeof photo === "object" ? photo as Record<string, unknown> : {};
  const url = [sizes["96"], sizes["150"], sizes["48"], sizes["full"]].find((value) => typeof value === "string" && value);
  return { ...user, avatar: typeof url === "string" ? mediaOriginUrl(url) : null };
}

export async function GET() {
  try {
    const session = await getAdminSession();
    if (!session) throw new Error("Admin authentication required");
    const result = await getAdminTaxonomyCached(`admin-taxonomy:${session.username}:authors`, async () => {
      const base = new URLSearchParams({ context: "edit", per_page: "100", orderby: "name", order: "asc", roles: "author,editor,administrator", _fields: "id,name,slug,email,roles,registered_date,mpp_avatar" });
      const first = await wpAdminFetch(`/users?${base}&page=1`);
      const firstData = await first.json();
      if (!first.ok) throw new Error(firstData?.message || "Could not load authors");
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
      return { items: [firstData, ...remaining].flat().map(withAvatar), total: Number(first.headers.get("X-WP-Total") || 0) };
    });
    return NextResponse.json(result, { headers: adminTaxonomyCacheHeaders() });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Could not load authors";
    return NextResponse.json({ error: message }, { status: message.includes("authentication") ? 401 : 502 });
  }
}

const PHOTO_TYPES = ["image/jpeg", "image/png", "image/webp"];

/** Makes the uploaded image the author's profile picture, through the Metronet Profile Picture plugin. */
async function setProfilePhoto(userId: number, photo: File): Promise<string | null> {
  try {
    const media = await uploadMedia(photo, { allowed: PHOTO_TYPES, limit: PHOTO_LIMIT_BYTES, limitLabel: "2 MB", alt: "" });
    const response = await wpAdminRoute("/mpp/v2/profile-image/change", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ user_id: userId, media_id: media.id }) });
    if (response.ok) return null;
    const data = await response.json().catch(() => null);
    return response.status === 404 ? "the profile picture plugin is not active on WordPress" : data?.message || `the profile picture plugin answered ${response.status}`;
  } catch (error) {
    return error instanceof Error ? error.message : "the photo could not be stored";
  }
}

export async function POST(request: Request) {
  try {
    const form = await request.formData();
    const field = (name: string) => String(form.get(name) || "").trim();
    const username = field("username");
    const email = field("email");
    const password = String(form.get("password") || "");
    const name = field("name");
    if (!username || !email || !password || !name) return NextResponse.json({ error: "Name, username, email and password are required" }, { status: 400 });
    const upload = form.get("photo");
    const photo = upload instanceof File && upload.size > 0 ? upload : null;
    // Check the photo before anything is created, so a bad photo never leaves a half-made author behind.
    if (photo && !PHOTO_TYPES.includes(photo.type)) return NextResponse.json({ error: "The profile photo must be a PNG, JPG or WebP image." }, { status: 415 });
    if (photo && photo.size > PHOTO_LIMIT_BYTES) return NextResponse.json({ error: "The profile photo must be 2 MB or smaller." }, { status: 413 });
    const payload = { username, email, password, name, slug: field("slug"), description: String(form.get("description") || ""), roles: ["author"] };
    const response = await wpAdminFetch("/users", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
    const data = await response.json();
    if (!response.ok) return NextResponse.json({ error: data?.message || "Author could not be created" }, { status: response.status });
    const problem = photo ? await setProfilePhoto(Number(data.id), photo) : null;
    const session = await getAdminSession();
    if (session) invalidateAdminTaxonomyCache(`admin-taxonomy:${session.username}:authors`);
    return NextResponse.json({ item: data, ...(problem ? { warning: `The author was created, but the profile photo was not saved: ${problem}.` } : {}) }, { status: 201 });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Author could not be created";
    return NextResponse.json({ error: message }, { status: message.includes("authentication") ? 401 : 502 });
  }
}
