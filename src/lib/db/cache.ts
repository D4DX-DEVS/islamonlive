import { unstable_cache } from "next/cache";

/* The data cache for MongoDB reads — the counterpart of the `next: { revalidate,
   tags }` every WordPress fetch carries.

   Same TTL tiers (lib/cache.ts) and the same tags ("wp" plus "wp:posts",
   "wp:categories", …), so /api/revalidate and the admin's cache purge drop the
   Mongo reads exactly as they drop the WP fetches today — no second purge path.

   Every public read must go through here: the Atlas cluster is shared and
   capped in operations per second, and a crawler walking 22k archive URLs
   uncached would spend that budget for every app on it.

   Results are JSON-serialised by the cache, so cached functions return plain
   REST-shaped objects (strings, not Dates). Outside a Next runtime (Vitest) there
   is no incremental cache to talk to, so the function runs directly — but its
   result still takes the same JSON round trip, so a test sees exactly what a
   page would: a Set, Map or Date returned here would arrive in production as
   {} or a string, and must fail in the tests first. */

export interface CacheOptions {
  revalidate: number;
  tags: string[];
}

export function cached<A extends unknown[], R>(name: string, fn: (...args: A) => Promise<R>, { revalidate, tags }: CacheOptions): (...args: A) => Promise<R> {
  if (process.env.VITEST) return async (...args: A) => JSON.parse(JSON.stringify(await fn(...args)) ?? "null") as R;
  return unstable_cache(fn, ["mongo", name], { revalidate, tags });
}
