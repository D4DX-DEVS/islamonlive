import { collection } from "@/lib/db/client";

/* WordPress keeps two clocks per post: `date` / `modified` in the site's
   timezone (Settings → General, Asia/Kolkata here) and `*_gmt` in UTC. The REST
   API reads an incoming `date` as site-local too, so the admin's date picker
   means IST. Everything that writes dates goes through here so the stored
   strings line up with the 22k migrated posts, and published_at (the instant
   every public query sorts and filters on) is the same moment. */

const FALLBACK_TZ = "Asia/Kolkata";
let cachedTz: string | null = null;

/** The site's IANA timezone from the migrated WordPress settings. */
export async function siteTimezone(): Promise<string> {
  if (cachedTz) return cachedTz;
  try {
    const settings = await (await collection("settings")).findOne({ _id: "site" });
    const tz = typeof settings?.timezone === "string" && settings.timezone ? settings.timezone : FALLBACK_TZ;
    new Intl.DateTimeFormat("en", { timeZone: tz }); // throws on an unknown zone
    cachedTz = tz;
  } catch {
    cachedTz = FALLBACK_TZ;
  }
  return cachedTz;
}

/** "YYYY-MM-DDTHH:MM:SS" as a wall clock in `tz`. */
export function wallClock(instant: Date, tz: string): string {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-GB", { timeZone: tz, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit" })
      .formatToParts(instant)
      .map((p) => [p.type, p.value])
  );
  return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}:${parts.second}`;
}

/** "YYYY-MM-DDTHH:MM:SS" in UTC, WordPress's *_gmt format. */
export const gmtClock = (instant: Date): string => instant.toISOString().slice(0, 19);

const LOCAL = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?$/;

/**
 * The instant a site-local wall clock ("2026-10-27T10:22" or with seconds)
 * names, or null when the string is not one. Two passes settle the offset
 * across a DST change for zones that have one.
 */
export function fromWallClock(local: string, tz: string): Date | null {
  const m = LOCAL.exec(local.trim());
  if (!m) return null;
  const asUtc = Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], +(m[6] ?? 0));
  if (Number.isNaN(asUtc)) return null;
  let guess = asUtc;
  for (let i = 0; i < 2; i++) {
    const shown = Date.parse(`${wallClock(new Date(guess), tz)}Z`);
    guess -= shown - asUtc;
  }
  return new Date(guess);
}

/** The four WordPress date strings for a post or attachment. */
export function postClocks(published: Date, modified: Date, tz: string): { date: string; date_gmt: string; modified: string; modified_gmt: string } {
  return { date: wallClock(published, tz), date_gmt: gmtClock(published), modified: wallClock(modified, tz), modified_gmt: gmtClock(modified) };
}
