import { loadEvents, saveEvent, storageStatus, type AnalyticsEvent, type StorageStatus } from "@/lib/analytics-store";
import { cachedLookup, getThumbnails, idList, wpJson } from "@/lib/wp-lookup";

export type { AnalyticsEvent };

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

export const recordAnalyticsEvent = saveEvent;

type Totals = { views: number; uniqueReaders: number; averageReadingSeconds: number; completionRate: number };
type ArticleMetric = { articleId: number; title: string; path: string; views: number; readers: number; averageReadingSeconds: number; completionRate: number };

export type AnalyticsSummary = Totals & {
  windowDays: number;
  /** First and last UTC day of the window, YYYY-MM-DD. */
  from: string;
  to: string;
  /** The window of equal length right before this one; null when it holds no events. */
  previous: Totals | null;
  /** One entry per day of the window, zero-filled. */
  daily: (Totals & { date: string })[];
  topArticles: (ArticleMetric & { publishedAt?: string | null; imageUrl?: string | null })[];
  /** Where reader events are saved, and whether that currently works. */
  storage?: StorageStatus;
};

const DAY_MS = 86_400_000;

type PostMeta = { date?: string; featuredMedia: number };
const postMetaCache: Map<number, { value: PostMeta; at: number }> = new Map();

function getPostMeta(articleIds: number[]): Promise<Map<number, PostMeta>> {
  return cachedLookup(postMetaCache, articleIds, async (missing) => {
    const rows = await wpJson<{ id?: number; date?: string; featured_media?: number }[]>("/posts", { ...idList(missing), _fields: "id,date,featured_media" });
    return new Map((rows ?? []).flatMap((post) => Number.isInteger(post.id) ? [[Number(post.id), { date: post.date, featuredMedia: post.featured_media ?? 0 }] as const] : []));
  });
}

function measure(events: AnalyticsEvent[]): Totals & { articles: ArticleMetric[] } {
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
  const articles = [...articleMap.entries()].map(([articleId, item]) => {
    const seconds = [...item.maxSeconds.values()];
    return { articleId, title: item.title, path: item.path, views: item.views, readers: item.sessions.size, averageReadingSeconds: seconds.length ? Math.round(seconds.reduce((a, b) => a + b, 0) / seconds.length) : 0, completionRate: item.sessions.size ? Math.round((item.completed.size / item.sessions.size) * 100) : 0 };
  }).sort((a, b) => b.views - a.views);
  const durations = articles.flatMap((article) => Array.from({ length: article.readers }, () => article.averageReadingSeconds));
  const completions = articles.reduce((total, article) => total + Math.round(article.readers * article.completionRate / 100), 0);
  const articleReaders = articles.reduce((total, article) => total + article.readers, 0);
  return { views: views.length, uniqueReaders: readers.size, averageReadingSeconds: durations.length ? Math.round(durations.reduce((a, b) => a + b, 0) / durations.length) : 0, completionRate: articleReaders ? Math.round((completions / articleReaders) * 100) : 0, articles };
}

const totalsOf = ({ views, uniqueReaders, averageReadingSeconds, completionRate }: Totals): Totals => ({ views, uniqueReaders, averageReadingSeconds, completionRate });

export async function getAnalyticsSummary(windowDays = 30): Promise<AnalyticsSummary> {
  // The window is whole UTC days ending today, so the daily series adds up to the totals.
  const now = new Date();
  const today = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  const start = today - (windowDays - 1) * DAY_MS;
  const previousStart = start - windowDays * DAY_MS;
  const [all, storage] = await Promise.all([loadEvents(previousStart), storageStatus()]);
  const events = all.filter((event) => Date.parse(event.ts) >= start);
  const previousEvents = all.filter((event) => Date.parse(event.ts) < start);
  const current = measure(events);

  const eventsByDay = new Map<string, AnalyticsEvent[]>();
  for (const event of events) {
    const day = event.ts.slice(0, 10);
    eventsByDay.set(day, [...(eventsByDay.get(day) ?? []), event]);
  }
  const daily = Array.from({ length: windowDays }, (_, index) => {
    const date = new Date(start + index * DAY_MS).toISOString().slice(0, 10);
    const day = measure(eventsByDay.get(date) ?? []);
    return { date, ...totalsOf(day) };
  });

  // Publish dates and thumbnails come from WordPress; every lookup degrades to
  // "nothing" so the numbers above never wait on it.
  const topArticles = current.articles.slice(0, 10);
  const meta = await getPostMeta(topArticles.map((article) => article.articleId));
  const thumbnails = await getThumbnails(topArticles.flatMap((article) => meta.get(article.articleId)?.featuredMedia || []));

  return {
    windowDays,
    from: new Date(start).toISOString().slice(0, 10),
    to: new Date(today).toISOString().slice(0, 10),
    ...totalsOf(current),
    previous: previousEvents.length ? totalsOf(measure(previousEvents)) : null,
    daily,
    storage,
    topArticles: topArticles.map((article) => {
      const post = meta.get(article.articleId);
      return { ...article, publishedAt: post?.date ?? null, imageUrl: post?.featuredMedia ? thumbnails.get(post.featuredMedia) ?? null : null };
    }),
  };
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
