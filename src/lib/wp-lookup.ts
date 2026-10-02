import { WP_API } from "@/lib/env";
import { decodeEntities } from "@/lib/wordpress";
import { mediaOriginUrl } from "@/lib/urls";

/*
 * Small, failure-tolerant lookups against WordPress's public REST API for the
 * admin dashboard (thumbnails, category names, author names and photos).
 *
 * Every lookup degrades to "nothing found" instead of throwing, so a slow or
 * unavailable WordPress never takes the numbers on the dashboard down with it,
 * and results are remembered for a few minutes because they rarely change.
 */

const TTL_MS = 10 * 60_000;
const MAX_ENTRIES = 5_000;

type CacheStore<T> = Map<number, { value: T; at: number }>;
const thumbnailCache: CacheStore<string> = new Map();
const categoryNameCache: CacheStore<string> = new Map();
const authorCache: CacheStore<AuthorProfile> = new Map();

export type AuthorProfile = { name: string; avatar: string | null };

export async function wpJson<T>(path: string, params: Record<string, string>): Promise<T | null> {
  try {
    const response = await fetch(`${WP_API}${path}?${new URLSearchParams(params)}`, { cache: "no-store", signal: AbortSignal.timeout(2500) });
    return response.ok ? await response.json() as T : null;
  } catch { return null; } // Analytics should still render when WordPress is slow or unavailable.
}

/** Looks ids up in `store`, asking `load` only for the ones it has not seen recently. */
export async function cachedLookup<T>(store: CacheStore<T>, ids: number[], load: (missing: number[]) => Promise<Map<number, T>>): Promise<Map<number, T>> {
  const now = Date.now();
  const found = new Map<number, T>();
  const missing: number[] = [];
  for (const id of [...new Set(ids)]) {
    const hit = store.get(id);
    if (hit && now - hit.at < TTL_MS) found.set(id, hit.value); else missing.push(id);
  }
  if (!missing.length) return found;
  if (store.size > MAX_ENTRIES) store.clear();
  for (const [id, value] of await load(missing)) { store.set(id, { value, at: now }); found.set(id, value); }
  return found;
}

export const idList = (ids: number[]) => ({ include: ids.join(","), per_page: String(Math.min(ids.length, 100)) });

/** Small image URL for each featured-media id. */
export function getThumbnails(mediaIds: number[]): Promise<Map<number, string>> {
  return cachedLookup(thumbnailCache, mediaIds.filter((id) => id > 0), async (missing) => {
    const rows = await wpJson<{ id?: number; source_url?: string; media_details?: { sizes?: Record<string, { source_url?: string }> } }[]>("/media", { ...idList(missing), _fields: "id,source_url,media_details" });
    return new Map((rows ?? []).flatMap((row) => {
      const url = row.media_details?.sizes?.thumbnail?.source_url ?? row.media_details?.sizes?.medium?.source_url ?? row.source_url;
      return Number.isInteger(row.id) && url ? [[Number(row.id), url] as const] : [];
    }));
  });
}

export function getCategoryNames(ids: number[]): Promise<Map<number, string>> {
  return cachedLookup(categoryNameCache, ids, async (missing) => {
    const rows = await wpJson<{ id?: number; name?: string }[]>("/categories", { ...idList(missing), _fields: "id,name" });
    return new Map((rows ?? []).flatMap((row) => Number.isInteger(row.id) && row.name ? [[Number(row.id), decodeEntities(row.name)] as const] : []));
  });
}

/**
 * Author names and uploaded photos. The photo is the Metronet `mpp_avatar`
 * (Gravatar is always the grey placeholder on this site); it is an {errors}
 * object when the author has none.
 */
export function getAuthorProfiles(ids: number[]): Promise<Map<number, AuthorProfile>> {
  return cachedLookup(authorCache, ids, async (missing) => {
    const rows = await wpJson<{ id?: number; name?: string; mpp_avatar?: unknown }[]>("/users", { ...idList(missing), _fields: "id,name,mpp_avatar" });
    return new Map((rows ?? []).flatMap((row) => {
      if (!Number.isInteger(row.id) || !row.name) return [];
      const sizes = row.mpp_avatar && typeof row.mpp_avatar === "object" ? row.mpp_avatar as Record<string, unknown> : {};
      const photo = [sizes["96"], sizes["150"], sizes["48"], sizes["full"]].find((value) => typeof value === "string" && value);
      return [[Number(row.id), { name: decodeEntities(row.name), avatar: typeof photo === "string" ? mediaOriginUrl(photo) : null }] as const];
    }));
  });
}
