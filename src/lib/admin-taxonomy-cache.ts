type CacheEntry<T> = {
  expiresAt: number;
  value?: T;
  pending?: Promise<T>;
};

type AdminTaxonomyCache = Map<string, CacheEntry<unknown>>;

const globalCache = globalThis as typeof globalThis & { __iolAdminTaxonomyCache?: AdminTaxonomyCache };
const cache = globalCache.__iolAdminTaxonomyCache ??= new Map();

const TTL_MS = 60_000;

export async function getAdminTaxonomyCached<T>(key: string, loader: () => Promise<T>): Promise<T> {
  const now = Date.now();
  const existing = cache.get(key) as CacheEntry<T> | undefined;
  if (existing?.value !== undefined && existing.expiresAt > now) return existing.value;
  if (existing?.pending) return existing.pending;

  const pending = loader().then((value) => {
    cache.set(key, { value, expiresAt: Date.now() + TTL_MS });
    return value;
  }).catch((error) => {
    cache.delete(key);
    throw error;
  });
  cache.set(key, { pending, expiresAt: now + TTL_MS });
  return pending;
}

export function invalidateAdminTaxonomyCache(prefix: string): void {
  for (const key of cache.keys()) if (key.startsWith(prefix)) cache.delete(key);
}

export function adminTaxonomyCacheHeaders(): HeadersInit {
  // These responses include user-specific author details. Keep the optimization
  // on the server so logout/login cannot reuse another account's browser cache.
  return { "Cache-Control": "private, no-store" };
}
