import { siteUrl } from "@/lib/env";

/* Purging the CDN copy, which revalidatePath() cannot reach.

   Cloudflare sits in front of the app and caches HTML: the pages go out
   `s-maxage=60, stale-while-revalidate=31535940`, so an edit that lands in
   Next's cache is still served from Cloudflare's until its own 60s is up, and
   then served *stale* once more while the edge refreshes behind the reader.
   For an ordinary publish that is a minute of lag nobody notices.

   It is corrections and takedowns that need this. "Unpublish the article" has
   to mean gone now, not gone after the edge happens to notice, and a retracted
   paragraph sitting at the CDN for another cycle is exactly the failure a
   newsroom cannot explain. So the same call that drops the Next cache drops the
   edge copy of the same URLs.

   Unset credentials are not an error: a local checkout and a preview deploy
   have no zone in front of them, and the endpoint has to keep working there.
   The revalidate response reports which of the two caches it actually cleared.

   Token needs one permission — Zone → Cache Purge → Purge. */

const ZONE_ID = process.env.CLOUDFLARE_ZONE_ID ?? "";
const API_TOKEN = process.env.CLOUDFLARE_API_TOKEN ?? "";

/** Cloudflare's per-request ceiling for purge-by-URL on every plan. */
const BATCH = 30;

/* Every batch is bounded. fetch() on its own waits forever, and this call is
   awaited inside the revalidate handler — an unreachable Cloudflare would pin
   the request open and hold a slot on a single-instance deployment for as long
   as it took to notice. Five seconds also keeps a one-batch purge inside the
   10s timeout the WP plugin's settings-screen test button uses. */
const TIMEOUT_MS = 5000;

export function cloudflareConfigured(): boolean {
  return Boolean(ZONE_ID && API_TOKEN);
}

export interface PurgeResult {
  attempted: boolean;
  ok: boolean;
  purged: number;
  errors?: string[];
}

/**
 * Purge site-relative paths from the Cloudflare edge.
 *
 * Paths, not URLs, because the callers deal in paths — they are made absolute
 * here through siteUrl() so the host can only ever be the one Cloudflare has a
 * zone for.
 */
export async function purgePaths(paths: Iterable<string>): Promise<PurgeResult> {
  if (!cloudflareConfigured()) return { attempted: false, ok: true, purged: 0 };

  const files = [...new Set([...paths].map((p) => siteUrl(p)))];
  if (files.length === 0) return { attempted: false, ok: true, purged: 0 };

  const errors: string[] = [];
  let purged = 0;

  for (let i = 0; i < files.length; i += BATCH) {
    const batch = files.slice(i, i + BATCH);
    try {
      const res = await fetch(`https://api.cloudflare.com/client/v4/zones/${ZONE_ID}/purge_cache`, {
        method: "POST",
        headers: { Authorization: `Bearer ${API_TOKEN}`, "Content-Type": "application/json" },
        body: JSON.stringify({ files: batch }),
        cache: "no-store",
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
      const json = (await res.json().catch(() => ({}))) as { success?: boolean; errors?: unknown };
      if (res.ok && json.success) purged += batch.length;
      else errors.push(JSON.stringify(json.errors ?? { status: res.status }));
    } catch (e) {
      // a CDN that cannot be reached — or one that ran out the clock above —
      // must not fail the revalidation that already succeeded; Next's own cache
      // is dropped either way
      errors.push(e instanceof Error ? e.message : String(e));
    }
  }

  return { attempted: true, ok: errors.length === 0, purged, ...(errors.length ? { errors } : {}) };
}
