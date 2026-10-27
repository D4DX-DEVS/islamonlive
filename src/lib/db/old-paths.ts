import { collection } from "@/lib/db/client";
import { publicFilter } from "@/lib/db/posts";
import { safeDecode } from "@/lib/urls";

/* URLs that published posts have left (admin-rest/posts.ts keeps them in
   old_paths when an editor renames a slug), answered by src/proxy.ts with a
   301 before the page cache is consulted.

   Why not in the article route: that page is ISR-cached. When a URL that was
   cached as the article turns into a redirect, Next regenerates the entry in
   the background and then replays it as a 308 without its Location header,
   so readers and Google get a redirect to nowhere (caught by
   scripts/e2e-local.mjs). The proxy runs before the cache, so the answer is
   always whole.

   The set is small (only renames made through the new admin), so it is held
   in memory and re-read every minute; a save on this instance clears it at
   once. The state lives on globalThis because Next bundles the proxy and the
   route handlers separately: a module-level variable would give the admin's
   save and the proxy two different copies. */

const TTL_MS = 60_000;
type State = { cache: { at: number; map: Map<string, string> } | null; loading: Promise<Map<string, string>> | null };
const KEY = Symbol.for("islamonlive.movedPaths");
const state: State = ((globalThis as Record<symbol, State>)[KEY] ??= { cache: null, loading: null });

/** Decoded, lower-case, single trailing slash: how two spellings of one URL compare equal. */
export function pathKey(path: string): string {
  return `${safeDecode(path).toLowerCase().replace(/\/+$/, "")}/`;
}

async function load(): Promise<Map<string, string>> {
  const posts = await collection("posts");
  // $gt "" rather than "old_paths.0" exists: the former walks the sparse old_paths index, the latter scans every post
  const docs = await posts.find({ ...publicFilter(), old_paths: { $gt: "" } }, { projection: { old_paths: 1, path: 1 } }).toArray();
  const map = new Map<string, string>();
  for (const doc of docs) for (const old of doc.old_paths ?? []) if (old !== doc.path) map.set(pathKey(old), doc.path);
  return map;
}

/** Where a renamed post now lives, or null. Never throws: a database hiccup just means no redirect this time. */
export async function movedTo(path: string): Promise<string | null> {
  try {
    if (!state.cache || Date.now() - state.cache.at > TTL_MS) {
      state.loading ??= load().finally(() => (state.loading = null));
      state.cache = { at: Date.now(), map: await state.loading };
    }
    return state.cache.map.get(pathKey(path)) ?? null;
  } catch {
    return null;
  }
}

/** Drop the in-memory set after a save that moved a post, so this instance redirects at once. */
export function forgetMovedPaths(): void {
  state.cache = null;
}
