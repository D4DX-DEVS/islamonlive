import { appendFile, mkdir, readFile } from "node:fs/promises";
import path from "node:path";
import { WP_API } from "@/lib/env";

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

const storePath = process.env.ANALYTICS_STORE_PATH || path.join(process.cwd(), ".data", "analytics.ndjson");
let writeQueue = Promise.resolve();

function clampNumber(value: unknown, min: number, max: number): number {
  const number = typeof value === "number" && Number.isFinite(value) ? value : 0;
  return Math.max(min, Math.min(max, number));
}

export function normaliseEvent(input: Partial<AnalyticsEvent>): AnalyticsEvent | null {
  const articleId = Number(input.articleId);
  const sessionId = typeof input.sessionId === "string" ? input.sessionId.trim() : "";
  const articlePath = typeof input.path === "string" ? input.path.trim() : "";
  const title = typeof input.title === "string" ? input.title.trim() : "";
  const type = input.type;
  if (!Number.isInteger(articleId) || articleId < 1 || sessionId.length < 12 || sessionId.length > 128) return null;
  if (!articlePath.startsWith("/") || articlePath.length > 500 || !title || title.length > 500) return null;
  if (type !== "view" && type !== "heartbeat" && type !== "complete") return null;
  return {
    ts: new Date().toISOString(),
    sessionId,
    articleId,
    path: articlePath,
    title,
    type,
    seconds: Math.round(clampNumber(input.seconds, 0, 24 * 60 * 60)),
    progress: clampNumber(input.progress, 0, 1),
  };
}

export async function recordAnalyticsEvent(event: AnalyticsEvent): Promise<void> {
  writeQueue = writeQueue.catch(() => undefined).then(async () => {
    await mkdir(path.dirname(storePath), { recursive: true });
    await appendFile(storePath, `${JSON.stringify(event)}\n`, "utf8");
  });
  return writeQueue;
}

async function readEvents(): Promise<AnalyticsEvent[]> {
  try {
    const raw = await readFile(/* turbopackIgnore: true */ storePath, "utf8");
    return raw.split("\n").filter(Boolean).flatMap((line) => {
      try {
        const parsed = JSON.parse(line) as AnalyticsEvent;
        return parsed && typeof parsed.articleId === "number" ? [parsed] : [];
      } catch {
        return [];
      }
    });
  } catch (error: unknown) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return [];
    throw error;
  }
}

export type AnalyticsSummary = {
  windowDays: number;
  views: number;
  uniqueReaders: number;
  averageReadingSeconds: number;
  completionRate: number;
  daily: { date: string; views: number; readers: number }[];
  topArticles: { articleId: number; title: string; path: string; views: number; readers: number; averageReadingSeconds: number; completionRate: number; publishedAt?: string | null }[];
};

async function getPublishDates(articleIds: number[]): Promise<Map<number, string>> {
  const dates = new Map<number, string>();
  if (!articleIds.length) return dates;
  try {
    const query = new URLSearchParams({ include: articleIds.join(","), per_page: String(articleIds.length), _fields: "id,date" });
    const response = await fetch(`${WP_API}/posts?${query}`, { cache: "no-store", signal: AbortSignal.timeout(2500) });
    if (!response.ok) return dates;
    const posts = await response.json() as { id?: number; date?: string }[];
    posts.forEach((post) => { if (Number.isInteger(post.id) && post.date) dates.set(Number(post.id), post.date); });
  } catch { /* Analytics should still render when WordPress is slow or unavailable. */ }
  return dates;
}

export async function getAnalyticsSummary(windowDays = 30): Promise<AnalyticsSummary> {
  const cutoff = Date.now() - windowDays * 86_400_000;
  const events = (await readEvents()).filter((event) => Date.parse(event.ts) >= cutoff);
  const views = events.filter((event) => event.type === "view");
  const readers = new Set(views.map((event) => event.sessionId));
  const articleMap = new Map<number, { title: string; path: string; sessions: Set<string>; views: number; maxSeconds: Map<string, number>; completed: Set<string> }>();
  for (const event of events) {
    const current = articleMap.get(event.articleId) ?? { title: event.title, path: event.path, sessions: new Set(), views: 0, maxSeconds: new Map(), completed: new Set() };
    current.title = event.title || current.title;
    current.path = event.path || current.path;
    current.maxSeconds.set(event.sessionId, Math.max(current.maxSeconds.get(event.sessionId) ?? 0, event.seconds));
    if (event.type === "view") { current.views += 1; current.sessions.add(event.sessionId); }
    if (event.type === "complete" || event.progress >= 0.9) current.completed.add(event.sessionId);
    articleMap.set(event.articleId, current);
  }
  const articleMetrics = [...articleMap.entries()].map(([articleId, item]) => {
    const seconds = [...item.maxSeconds.values()];
    return { articleId, title: item.title, path: item.path, views: item.views, readers: item.sessions.size, averageReadingSeconds: seconds.length ? Math.round(seconds.reduce((a, b) => a + b, 0) / seconds.length) : 0, completionRate: item.sessions.size ? Math.round((item.completed.size / item.sessions.size) * 100) : 0 };
  }).sort((a, b) => b.views - a.views);
  const topArticles = articleMetrics.slice(0, 10);
  const publishDates = await getPublishDates(topArticles.map((article) => article.articleId));
  const topArticlesWithDates = topArticles.map((article) => ({ ...article, publishedAt: publishDates.get(article.articleId) || null }));
  const dailyMap = new Map<string, { views: number; readers: Set<string> }>();
  for (const event of views) {
    const date = event.ts.slice(0, 10);
    const current = dailyMap.get(date) ?? { views: 0, readers: new Set() };
    current.views += 1;
    current.readers.add(event.sessionId);
    dailyMap.set(date, current);
  }
  const daily = [...dailyMap.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([date, item]) => ({ date, views: item.views, readers: item.readers.size }));
  const durations = articleMetrics.flatMap((article) => Array.from({ length: article.readers }, () => article.averageReadingSeconds));
  const completions = articleMetrics.reduce((total, article) => total + Math.round(article.readers * article.completionRate / 100), 0);
  const articleReaders = articleMetrics.reduce((total, article) => total + article.readers, 0);
  return { windowDays, views: views.length, uniqueReaders: readers.size, averageReadingSeconds: durations.length ? Math.round(durations.reduce((a, b) => a + b, 0) / durations.length) : 0, completionRate: articleReaders ? Math.round((completions / articleReaders) * 100) : 0, daily, topArticles: topArticlesWithDates };
}

export async function forwardToGoogleAnalytics(event: AnalyticsEvent): Promise<void> {
  const measurementId = process.env.GA_MEASUREMENT_ID;
  const apiSecret = process.env.GA_API_SECRET;
  if (!measurementId || !apiSecret) return;
  const clientId = `${event.sessionId.slice(0, 16)}.1`;
  await fetch(`https://www.google-analytics.com/mp/collect?measurement_id=${encodeURIComponent(measurementId)}&api_secret=${encodeURIComponent(apiSecret)}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ client_id: clientId, events: [{ name: event.type === "view" ? "page_view" : "user_engagement", params: { page_location: event.path, page_title: event.title, engagement_time_msec: event.seconds * 1000, percent_scrolled: Math.round(event.progress * 100) } }] }),
    signal: AbortSignal.timeout(3000),
    cache: "no-store",
  }).catch(() => undefined);
}
