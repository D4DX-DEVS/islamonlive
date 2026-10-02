import { decodeEntities } from "@/lib/wordpress";
import { wpAdminFetch } from "@/lib/wp-admin";

/** Cache-key prefix for the dashboard's article counts; clear it after any write. */
export const POST_STATS_CACHE = "admin-stats:";

/**
 * Turns the tag names typed in the editor into WordPress tag ids, reusing a tag
 * whose name already matches (case-insensitively) and creating the rest.
 */
export async function resolveTagIds(raw: string): Promise<number[]> {
  let parsed: unknown;
  try { parsed = JSON.parse(raw); } catch { parsed = []; }
  const unique = new Map<string, string>();
  for (const entry of Array.isArray(parsed) ? parsed : []) {
    const name = String(entry).trim().slice(0, 100);
    if (name && unique.size < 20) unique.set(name.toLocaleLowerCase(), name);
  }
  return Promise.all([...unique.entries()].map(async ([key, name]) => {
    const found = await wpAdminFetch(`/tags?${new URLSearchParams({ search: name, per_page: "20", _fields: "id,name" })}`);
    if (found.ok) {
      const rows = await found.json() as { id: number; name: string }[];
      const match = rows.find((row) => decodeEntities(row.name).toLocaleLowerCase() === key);
      if (match) return match.id;
    }
    const created = await wpAdminFetch("/tags", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name }) });
    const data = await created.json();
    if (created.ok) return Number(data.id);
    // Lost a race with another editor creating the same tag: WordPress hands back the existing id.
    if (data?.code === "term_exists" && data?.data?.term_id) return Number(data.data.term_id);
    throw new Error(data?.message || `Could not create the tag “${name}”`);
  }));
}

/** WordPress site-time ISO date ("2026-09-30T10:15:00") from the editor, or null when it is not one. */
export function parsePublishDate(value: FormDataEntryValue | null): string | null {
  const text = typeof value === "string" ? value.trim() : "";
  return /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2})?$/.test(text) ? text : null;
}

/** The Yoast SEO fields, as the editor names them and as WordPress registers them in a post's `meta`. */
const SEO_META = { focusKeyword: ["_yoast_wpseo_focuskw", 100], title: ["_yoast_wpseo_title", 300], description: ["_yoast_wpseo_metadesc", 500] } as const;

/**
 * The `meta` to send with a post for the SEO fields the editor changed, or null
 * when it sent none. An empty string is kept: it is how a field is cleared.
 */
export function parseSeo(raw: FormDataEntryValue | null): Record<string, string> | null {
  if (typeof raw !== "string" || !raw) return null;
  let parsed: unknown;
  try { parsed = JSON.parse(raw); } catch { return null; }
  if (!parsed || typeof parsed !== "object") return null;
  const meta: Record<string, string> = {};
  for (const [field, [key, max]] of Object.entries(SEO_META)) {
    const value = (parsed as Record<string, unknown>)[field];
    if (typeof value === "string") meta[key] = value.replace(/\s+/g, " ").trim().slice(0, max);
  }
  return Object.keys(meta).length ? meta : null;
}

/** Total number of posts WordPress reports for a filter, without downloading any of them. */
export async function countPosts(params: Record<string, string>): Promise<number> {
  const response = await wpAdminFetch(`/posts?${new URLSearchParams({ context: "edit", per_page: "1", _fields: "id", ...params })}`);
  if (!response.ok) throw new Error((await response.json().catch(() => null))?.message || "Could not count articles");
  return Number(response.headers.get("X-WP-Total") || 0);
}
