import type { Filters, Range } from "@/lib/analytics/filters";
import type { Device, PageKind, Source } from "@/lib/analytics/shared";

/* What the analytics APIs return and the admin dashboard draws. Client-safe.
   A `null` metric means "can't be worked out" (nothing to divide by, or the
   data is past retention) and is shown as "—" with a reason, never as 0. */

export type Metric = number | null;

export type Totals = {
  views: number;
  /** exact distinct visitors; null past raw-data retention */
  visitors: Metric;
  newVisitors: Metric;
  returningVisitors: Metric;
  newViews: number;
  returningViews: number;
  /** active reading seconds, all pages */
  activeSeconds: number;
  articleViews: number;
  articleActiveSeconds: number;
  /** average active seconds per article view */
  avgArticleSeconds: Metric;
  /** average furthest scroll, percent of the article body */
  avgScroll: Metric;
  /** article views scrolled to 90 %, percent */
  completionRate: Metric;
  /** article views reaching each depth */
  reached: { 25: number; 50: number; 75: number; 90: number };
  sessions: number;
  engagedSessions: number;
  /** percent */
  engagementRate: Metric;
  bounceRate: Metric;
  pagesPerSession: Metric;
};

export type SeriesPoint = { day: string; views: number; articleViews: number; activeSeconds: number; articleActiveSeconds: number; /** article views scrolled to 90 % */ completed: number };

export type BreakdownRow<T extends string = string> = { id: T; views: number; activeSeconds: number; sessions: number; share: number };

/** `share` and `timeShare` are percent of all article views and article reading time; an article in two categories counts in both, so they can add up past 100. */
export type CategoryRow = { id: number; name: string; views: number; activeSeconds: number; avgSeconds: Metric; completionRate: Metric; share: number; timeShare: number };

export type ArticleRow = {
  id: number;
  title: string;
  path: string | null;
  category: string | null;
  publishedAt: string | null;
  image: string | null;
  views: number;
  /** only on the table and article detail */
  visitors?: Metric;
  activeSeconds: number;
  avgSeconds: Metric;
  avgScroll: Metric;
  completionRate: Metric;
  previousViews: number;
  /** percent change in views against the previous period; null when it had none */
  change: Metric;
};

export type Insights = {
  minViews: number;
  /** articles with at least minViews, the pool insights are drawn from */
  eligible: number;
  trending: ArticleRow[];
  declining: ArticleRow[];
  skimmed: ArticleRow[];
  gems: ArticleRow[];
};

export type Summary = {
  filters: Filters;
  previousRange: Range;
  /** first day anything was collected; null before the first reader */
  collectingSince: string | null;
  generatedAt: string;
  totals: Totals;
  /** null when the previous period is before collection began */
  previous: Totals | null;
  series: SeriesPoint[];
  categories: CategoryRow[];
  sources: BreakdownRow<Source>[];
  referrers: BreakdownRow[];
  devices: BreakdownRow<Device>[];
  kinds: BreakdownRow<PageKind>[];
  /** the articles readers spent the most active time on, in total */
  topByTime: ArticleRow[];
  topViewed: ArticleRow[];
  topEngaging: ArticleRow[];
  insights: Insights;
};

export const ARTICLE_SORTS = ["views", "activeSeconds", "avgSeconds", "avgScroll", "completionRate", "change", "publishedAt", "title"] as const;
export type ArticleSort = (typeof ARTICLE_SORTS)[number];
export const PAGE_SIZES = [10, 20, 50, 100] as const;

export type ArticlesPage = { data: ArticleRow[]; page: number; pageSize: number; total: number; totalPages: number; sort: ArticleSort; order: "asc" | "desc" };

export type ArticleDetail = {
  article: { id: number; title: string; path: string | null; category: string | null; publishedAt: string | null; image: string | null };
  filters: Filters;
  totals: Totals;
  previous: Totals | null;
  series: SeriesPoint[];
  sources: BreakdownRow<Source>[];
  referrers: BreakdownRow[];
  devices: BreakdownRow<Device>[];
  /** the same figures for all articles in the period, to compare against */
  siteAverage: { avgArticleSeconds: Metric; avgScroll: Metric; completionRate: Metric };
};

export type LiveReport = {
  generatedAt: string;
  windowSeconds: number;
  visitors: number;
  pages: { kind: PageKind; key: number | string; title: string; path: string | null; category: string | null; readers: number }[];
  /** readers on articles in each category; an article in two categories counts in both */
  categories: { id: number; name: string; readers: number }[];
  devices: { id: Device; readers: number }[];
  sources: { id: Source; readers: number }[];
  perMinute: number[];
};
