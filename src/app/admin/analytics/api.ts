import { filtersQuery, type Filters } from "@/lib/analytics/filters";
import type { ArticleDetail, ArticleSort, ArticlesPage, ListName, ListPage, ListRow, LiveReport, Summary } from "@/lib/analytics/report-types";

/* The Analytics page's only way to the server. Every call takes an AbortSignal
   so a newer filter choice cancels the request it replaces. */

export type FilterState = Partial<Filters> & { preset: Filters["preset"] };

async function getJson<T>(path: string, signal?: AbortSignal): Promise<T> {
  const response = await fetch(path, { cache: "no-store", credentials: "same-origin", signal });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error((body as { error?: string }).error || "The analytics service returned an error.");
  return body as T;
}

export const fetchSummary = (filters: FilterState, signal?: AbortSignal) => getJson<Summary>(`/api/admin/analytics/summary?${filtersQuery(filters)}`, signal);

export type TableQuery = { q: string; sort: ArticleSort; order: "asc" | "desc"; page: number; pageSize: number };

export function fetchArticles(filters: FilterState, table: TableQuery, signal?: AbortSignal): Promise<ArticlesPage> {
  const params = new URLSearchParams(filtersQuery(filters));
  for (const [key, value] of Object.entries(table)) if (value !== "") params.set(key, String(value));
  return getJson<ArticlesPage>(`/api/admin/analytics/articles?${params}`, signal);
}

export function fetchList<L extends ListName>(filters: FilterState, list: L, page: number, signal?: AbortSignal): Promise<ListPage<ListRow[L]>> {
  const params = new URLSearchParams(filtersQuery(filters));
  params.set("list", list);
  params.set("page", String(page));
  return getJson<ListPage<ListRow[L]>>(`/api/admin/analytics/list?${params}`, signal);
}

export const fetchArticle =(id: number, filters: FilterState, signal?: AbortSignal) => getJson<ArticleDetail>(`/api/admin/analytics/articles/${id}?${filtersQuery(filters)}`, signal);

/** Deletes all reader data. Throws the server's message when it fails. */
export async function deleteReaderData(): Promise<{ views: number; rollups: number }> {
  const response = await fetch("/api/admin/analytics/data", { method: "DELETE", cache: "no-store", credentials: "same-origin" });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error((body as { error?: string }).error || "Could not delete the reader data.");
  return (body as { deleted: { views: number; rollups: number } }).deleted;
}

export const fetchLive =(signal?: AbortSignal) => getJson<LiveReport>("/api/admin/analytics/live", signal);
