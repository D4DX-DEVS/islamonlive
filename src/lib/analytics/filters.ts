import { DEVICES, SOURCES, addDays, istDay, type Device, type Source } from "@/lib/analytics/shared";

/* The dashboard's filters, read from a query string and checked against
   allow-lists. Pure and client-safe: the admin page builds the same query
   string the API reads. Days are IST calendar days, inclusive. */

export const RANGE_PRESETS = ["today", "7", "30", "90", "custom"] as const;
export type RangePreset = (typeof RANGE_PRESETS)[number];
export type VisitorType = "new" | "returning";

/** The longest custom range: the raw views are kept 400 days. */
export const MAX_RANGE_DAYS = 400;

export type Range = { from: string; to: string };
export type Filters = Range & {
  preset: RangePreset;
  category?: number;
  article?: number;
  device?: Device;
  source?: Source;
  visitor?: VisitorType;
};

const DAY = /^\d{4}-\d{2}-\d{2}$/;

export function daysIn({ from, to }: Range): number {
  return Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000) + 1;
}

/** Every day of a range, oldest first. */
export function eachDay(range: Range): string[] {
  return Array.from({ length: daysIn(range) }, (_, i) => addDays(range.from, i));
}

/** The range of the same length that ends the day before this one starts. */
export function previousRange(range: Range): Range {
  const length = daysIn(range);
  return { from: addDays(range.from, -length), to: addDays(range.from, -1) };
}

/** A YYYY-MM-DD that names a real date: 2026-02-31 would otherwise roll over to 3 March. */
function realDay(value: string): boolean {
  if (!DAY.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

function positiveInt(value: string | null): number | undefined {
  if (!value) return undefined;
  const n = Number(value);
  return Number.isInteger(n) && n > 0 ? n : Number.NaN;
}

/** The filters in a query string, or what is wrong with it. `now` is for tests. */
export function parseFilters(params: URLSearchParams, now = Date.now()): Filters | { error: string } {
  const today = istDay(now);
  const preset = (params.get("range") ?? "30") as RangePreset;
  if (!RANGE_PRESETS.includes(preset)) return { error: "Unknown date range." };
  let range: Range;
  if (preset === "custom") {
    const from = params.get("from") ?? "";
    const to = params.get("to") ?? "";
    if (!realDay(from) || !realDay(to)) return { error: "Choose a start and an end date." };
    if (from > to) return { error: "The start date is after the end date." };
    if (to > today) return { error: "The end date is in the future." };
    if (daysIn({ from, to }) > MAX_RANGE_DAYS) return { error: `Choose at most ${MAX_RANGE_DAYS} days.` };
    range = { from, to };
  } else {
    const days = preset === "today" ? 1 : Number(preset);
    range = { from: addDays(today, -(days - 1)), to: today };
  }

  const filters: Filters = { preset, ...range };
  const category = positiveInt(params.get("category"));
  const article = positiveInt(params.get("article"));
  if (Number.isNaN(category) || Number.isNaN(article)) return { error: "Unknown category or article." };
  if (category) filters.category = category;
  if (article) filters.article = article;
  const device = params.get("device");
  if (device) {
    if (!(DEVICES as readonly string[]).includes(device)) return { error: "Unknown device." };
    filters.device = device as Device;
  }
  const source = params.get("source");
  if (source) {
    if (!(SOURCES as readonly string[]).includes(source)) return { error: "Unknown traffic source." };
    filters.source = source as Source;
  }
  const visitor = params.get("visitor");
  if (visitor) {
    if (visitor !== "new" && visitor !== "returning") return { error: "Unknown visitor type." };
    filters.visitor = visitor;
  }
  return filters;
}

/** The query string for some filters: what the admin page sends. */
export function filtersQuery(filters: Partial<Filters>): string {
  const params = new URLSearchParams();
  params.set("range", filters.preset ?? "30");
  if (filters.preset === "custom" && filters.from && filters.to) { params.set("from", filters.from); params.set("to", filters.to); }
  for (const key of ["category", "article", "device", "source", "visitor"] as const) {
    const value = filters[key];
    if (value !== undefined) params.set(key, String(value));
  }
  return params.toString();
}
