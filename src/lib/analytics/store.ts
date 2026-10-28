import { collection } from "@/lib/db/client";
import { deviceOf, sourceOf } from "@/lib/analytics/classify";
import { istDay, type Beacon } from "@/lib/analytics/shared";
import type { AnalyticsViewDoc } from "@/lib/db/types";

/* Writes reader beacons to MongoDB: one document per page view in
   analytics_views, keyed on the browser's random view id.

   Every beacon is a single upsert. The first one to arrive (normally `start`)
   fixes what the view is: its page, source, device, visitor and session. Every
   later one can only raise the active time, scroll depth and last-seen time
   ($max), so a repeated, retried or out-of-order beacon never counts anything
   twice, and a lost `start` is made good by the next ping. */

/** Raw views are kept this long; the daily rollups outlive them. */
export const VIEW_RETENTION_DAYS = 400;

const holder = globalThis as typeof globalThis & { __iolAnalyticsIndexes?: Promise<void>; __iolAnalyticsIndexesFailedAt?: number };
/** after a failed index build, beacons wait this long before trying again */
const INDEX_RETRY_MS = 10 * 60_000;

/** Creates the indexes once per process. Idempotent, so a second process doing the same is harmless. */
export function ensureAnalyticsIndexes(): Promise<void> {
  holder.__iolAnalyticsIndexes ??= (async () => {
    const views = await collection("analytics_views");
    await views.createIndexes([
      { key: { day: 1, k: 1 }, name: "day_kind" },
      { key: { a: 1, day: 1 }, name: "article_day", partialFilterExpression: { a: { $exists: true } } },
      { key: { ls: -1 }, name: "last_seen" },
      { key: { t: 1 }, name: "ttl", expireAfterSeconds: VIEW_RETENTION_DAYS * 86_400 },
    ]);
    await (await collection("analytics_daily")).createIndexes([{ key: { day: 1 }, name: "day" }]);
  })().catch((error: unknown) => {
    holder.__iolAnalyticsIndexes = undefined;
    holder.__iolAnalyticsIndexesFailedAt = Date.now();
    throw error;
  });
  return holder.__iolAnalyticsIndexes;
}

export type BeaconContext = { userAgent: string; siteHost: string; now?: Date };

/** The fields a view is born with; later beacons never change them. */
export function viewIdentity(beacon: Beacon, { userAgent, siteHost, now = new Date() }: BeaconContext): Omit<AnalyticsViewDoc, "_id" | "e" | "sd" | "ls"> {
  const { src, ref } = sourceOf(beacon, siteHost);
  return {
    v: beacon.v,
    s: beacon.s,
    t: now,
    day: istDay(now.getTime()),
    k: beacon.k,
    p: beacon.p,
    ...(beacon.a ? { a: beacon.a, c: beacon.c ?? [] } : {}),
    dev: deviceOf(userAgent, beacon.tp),
    src,
    ...(ref ? { ref } : {}),
    nv: Boolean(beacon.nv),
    en: Boolean(beacon.en),
  };
}

export async function recordBeacon(beacon: Beacon, context: BeaconContext): Promise<void> {
  const now = context.now ?? new Date();
  // a missing index slows reports and stops old views expiring, but must not lose readers: write anyway, retry later
  if (Date.now() - (holder.__iolAnalyticsIndexesFailedAt ?? 0) >= INDEX_RETRY_MS) {
    await ensureAnalyticsIndexes().catch((error: unknown) => console.warn("[analytics] could not create indexes:", error instanceof Error ? error.message : error));
  }
  const views = await collection("analytics_views");
  await views.updateOne(
    { _id: beacon.id },
    { $setOnInsert: viewIdentity(beacon, { ...context, now }), $max: { e: beacon.e, sd: beacon.sd, ls: now } },
    { upsert: true },
  );
}
