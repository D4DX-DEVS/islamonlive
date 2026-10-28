import type { Metric } from "@/lib/analytics/report-types";

/* Number formatting for the Analytics page. A null metric is "—": it could not
   be worked out, which is not the same as zero. */

const compactFormat = new Intl.NumberFormat("en", { notation: "compact", maximumFractionDigits: 1 });

/** 1,284 · 12.9K · 1.2M */
export function compact(n: number): string {
  return Math.abs(n) < 10_000 ? n.toLocaleString("en") : compactFormat.format(n);
}

/** 45s · 3m 20s · 2h 15m · 1,255h 33m */
export function duration(seconds: number): string {
  const s = Math.max(0, Math.round(seconds));
  if (s < 60) return `${s}s`;
  if (s < 3600) return `${Math.floor(s / 60)}m ${s % 60}s`;
  return `${Math.floor(s / 3600).toLocaleString("en")}h ${Math.floor((s % 3600) / 60)}m`;
}

/** "1 view", "2,400 views" */
export const viewCount = (n: number): string => `${compact(n)} ${n === 1 ? "view" : "views"}`;

/** Axis ticks: 0 · 30s · 40m · 2h · 120h */
export function shortDuration(seconds: number): string {
  if (seconds <= 0) return "0";
  if (seconds < 60) return `${Math.round(seconds)}s`;
  if (seconds < 3600) return `${Math.round(seconds / 60)}m`;
  return `${compact(Math.round((seconds / 3600) * 10) / 10)}h`;
}

export const percent = (value: number): string => `${Number.isInteger(value) ? value : value.toFixed(1)}%`;

export function metric(value: Metric, format: (value: number) => string = (v) => v.toLocaleString("en")): string {
  return value === null ? "—" : format(value);
}

/** Percent change against the previous period: null when there was nothing to compare with. */
export function delta(current: Metric, previous: Metric | undefined): number | null {
  if (current === null || previous === null || previous === undefined || previous === 0) return null;
  return Math.round(((current - previous) / previous) * 100);
}

const dayFormat = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });

export function longDay(day: string | null): string {
  if (!day) return "—";
  const date = new Date(`${day.slice(0, 10)}T00:00:00Z`);
  return Number.isNaN(date.getTime()) ? "—" : dayFormat.format(date);
}

export const SOURCE_LABELS: Record<string, string> = { direct: "Direct", search: "Search engines", social: "Social media", referral: "Other websites", internal: "Within the site", email: "Email", campaign: "Campaigns" };
export const DEVICE_LABELS: Record<string, string> = { mobile: "Mobile", tablet: "Tablet", desktop: "Desktop" };
export const KIND_LABELS: Record<string, string> = { article: "Articles", home: "Home page", category: "Category pages", tag: "Tag pages", author: "Author pages", page: "Pages", search: "Search", listen: "Listen", watch: "Watch", other: "Other" };
