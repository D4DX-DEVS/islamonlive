import { access, appendFile, mkdir, readFile } from "node:fs/promises";
import { constants } from "node:fs";
import path from "node:path";

/*
 * Where reader events are kept.
 *
 * With an Upstash Redis database connected (UPSTASH_REDIS_REST_URL and
 * UPSTASH_REDIS_REST_TOKEN, or the KV_REST_API_URL / KV_REST_API_TOKEN pair the
 * Vercel integration sets) events go there; without one they are appended to a
 * local file. The file is fine for `next dev` or a server with a disk, but a
 * serverless host such as Vercel cannot write to it, which is why Redis exists.
 *
 * The reader sends a heartbeat every 15 seconds, so one read is ~14 events.
 * Redis therefore keeps one small record per (day, reader, article) instead of
 * every event: how many times it was opened, the longest time spent, how far
 * down the page they got and whether they finished. That is all the dashboard
 * reads, and it keeps a day's worth to a few kilobytes per hundred reads.
 *
 * This file imports nothing from the app so it can be exercised on its own.
 */

export type AnalyticsEvent = {
  ts: string;
  sessionId: string;
  articleId: number;
  path: string;
  title: string;
  type: "view" | "heartbeat" | "complete";
  seconds: number;
  progress: number;
};

export type StorageStatus = { kind: "file" | "redis"; ok: boolean; message?: string };

const DAY_MS = 86_400_000;
/** Long enough for a 90-day window plus the 90 days it is compared with. */
const RETENTION_SECONDS = 200 * 86_400;
const READS_PREFIX = "iol:analytics:reads:";
const ARTICLES_KEY = "iol:analytics:articles";

const redisUrl = () => (process.env.UPSTASH_REDIS_REST_URL ?? process.env.KV_REST_API_URL ?? "").replace(/\/+$/, "");
const redisToken = () => process.env.UPSTASH_REDIS_REST_TOKEN ?? process.env.KV_REST_API_TOKEN ?? "";
const redisConfigured = () => Boolean(redisUrl() && redisToken());

const fileStorePath = () => process.env.ANALYTICS_STORE_PATH || path.join(process.cwd(), ".data", "analytics.ndjson");
let fileWriteQueue = Promise.resolve();

async function redis(commands: (string | number)[][]): Promise<unknown[]> {
  const response = await fetch(`${redisUrl()}/pipeline`, {
    method: "POST",
    headers: { Authorization: `Bearer ${redisToken()}`, "Content-Type": "application/json" },
    body: JSON.stringify(commands),
    cache: "no-store",
    signal: AbortSignal.timeout(8000),
  });
  if (!response.ok) throw new Error(`Redis responded with ${response.status}`);
  const results = await response.json() as { result?: unknown; error?: string }[];
  return results.map((entry) => { if (entry.error) throw new Error(entry.error); return entry.result; });
}

/**
 * Folds one event into its (day, reader, article) record, atomically, in a
 * single command. The record is "views,longestSeconds,furthestProgress,finished".
 */
const RECORD_SCRIPT = `
local reads, articles = KEYS[1], KEYS[2]
local field, kind = ARGV[1], ARGV[2]
local seconds, progress = tonumber(ARGV[3]), tonumber(ARGV[4])
local views, longest, furthest, finished = 0, 0, 0, 0
local current = redis.call('HGET', reads, field)
if current then
  local v, s, p, f = string.match(current, '^(%d+),(%d+),([%d%.]+),([01])$')
  if v then views, longest, furthest, finished = tonumber(v), tonumber(s), tonumber(p), tonumber(f) end
end
if kind == 'view' then views = views + 1 end
if seconds > longest then longest = seconds end
if progress > furthest then furthest = progress end
if kind == 'complete' then finished = 1 end
redis.call('HSET', reads, field, string.format('%d,%d,%.3f,%d', views, longest, furthest, finished))
if redis.call('TTL', reads) < 0 then redis.call('EXPIRE', reads, tonumber(ARGV[5])) end
redis.call('HSET', articles, ARGV[6], ARGV[7])
return 1
`.trim();

export async function saveEvent(event: AnalyticsEvent): Promise<void> {
  if (redisConfigured()) {
    const day = event.ts.slice(0, 10);
    await redis([["EVAL", RECORD_SCRIPT, 2, `${READS_PREFIX}${day}`, ARTICLES_KEY, `${event.sessionId}|${event.articleId}`, event.type, Math.round(event.seconds), event.progress, RETENTION_SECONDS, event.articleId, JSON.stringify([event.title, event.path])]]);
    return;
  }
  fileWriteQueue = fileWriteQueue.catch(() => undefined).then(async () => {
    await mkdir(path.dirname(fileStorePath()), { recursive: true });
    await appendFile(fileStorePath(), `${JSON.stringify(event)}\n`, "utf8");
  });
  return fileWriteQueue;
}

async function loadFileEvents(sinceMs: number): Promise<AnalyticsEvent[]> {
  try {
    const raw = await readFile(/* turbopackIgnore: true */ fileStorePath(), "utf8");
    return raw.split("\n").filter(Boolean).flatMap((line) => {
      try {
        const parsed = JSON.parse(line) as AnalyticsEvent;
        return parsed && typeof parsed.articleId === "number" && Date.parse(parsed.ts) >= sinceMs ? [parsed] : [];
      } catch {
        return [];
      }
    });
  } catch (error: unknown) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return [];
    throw error;
  }
}

async function loadRedisEvents(sinceMs: number): Promise<AnalyticsEvent[]> {
  const days: string[] = [];
  for (let ms = Date.parse(new Date(sinceMs).toISOString().slice(0, 10)); ms <= Date.now(); ms += DAY_MS) days.push(new Date(ms).toISOString().slice(0, 10));
  const perDay = await redis(days.map((day) => ["HGETALL", `${READS_PREFIX}${day}`]));

  type Read = { day: string; sessionId: string; articleId: number; views: number; seconds: number; progress: number; finished: boolean };
  const reads: Read[] = [];
  perDay.forEach((flat, index) => {
    const entries = Array.isArray(flat) ? flat as string[] : [];
    for (let i = 0; i + 1 < entries.length; i += 2) {
      const [sessionId, article] = entries[i].split("|");
      const match = entries[i + 1].match(/^(\d+),(\d+),([\d.]+),([01])$/);
      if (sessionId && article && match) reads.push({ day: days[index], sessionId, articleId: Number(article), views: Number(match[1]), seconds: Number(match[2]), progress: Number(match[3]), finished: match[4] === "1" });
    }
  });

  // Titles and paths are stored once per article, not once per read.
  const ids = [...new Set(reads.map((read) => read.articleId))];
  const meta = new Map<number, [string, string]>();
  for (let i = 0; i < ids.length; i += 500) {
    const chunk = ids.slice(i, i + 500);
    const [values] = await redis([["HMGET", ARTICLES_KEY, ...chunk]]);
    (values as (string | null)[]).forEach((value, index) => {
      try { const [title, articlePath] = JSON.parse(value ?? "null") as [string, string]; if (title && articlePath) meta.set(chunk[index], [title, articlePath]); } catch { /* an article without details is skipped below */ }
    });
  }

  // Replay each record as the events that would have produced it, so the
  // dashboard maths is the same whichever store the events came from.
  return reads.flatMap((read) => {
    const details = meta.get(read.articleId);
    if (!details) return [];
    const base = { sessionId: read.sessionId, articleId: read.articleId, title: details[0], path: details[1], ts: `${read.day}T12:00:00.000Z` };
    return [
      ...Array.from({ length: read.views }, (): AnalyticsEvent => ({ ...base, type: "view", seconds: 0, progress: 0 })),
      { ...base, type: "heartbeat", seconds: read.seconds, progress: read.progress },
      ...(read.finished ? [{ ...base, type: "complete" as const, seconds: read.seconds, progress: read.progress }] : []),
    ];
  });
}

/** Events from `sinceMs` on (whole days when kept in Redis). */
export function loadEvents(sinceMs: number): Promise<AnalyticsEvent[]> {
  return redisConfigured() ? loadRedisEvents(sinceMs) : loadFileEvents(sinceMs);
}

/** Whether events can be saved here right now, for the dashboard to report. */
export async function storageStatus(): Promise<StorageStatus> {
  if (redisConfigured()) {
    try {
      await redis([["PING"]]);
      return { kind: "redis", ok: true };
    } catch (error) {
      return { kind: "redis", ok: false, message: `Redis could not be reached (${error instanceof Error ? error.message : "unknown error"}).` };
    }
  }
  const store = fileStorePath();
  // Check the closest folder that exists, without creating anything.
  let directory = path.dirname(store);
  for (let depth = 0; depth < 4; depth++) {
    try {
      await access(directory, constants.W_OK);
      return { kind: "file", ok: true };
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") return { kind: "file", ok: false, message: `The events file (${store}) can't be written to here.` };
      directory = path.dirname(directory);
    }
  }
  return { kind: "file", ok: false, message: `The events file (${store}) cannot be created.` };
}
