export type Tab = "overview" | "articles" | "new" | "edit" | "authors";

export const cardClass = "rounded-2xl border border-slate-200/70 bg-white p-4 shadow-[0_1px_2px_rgba(76,29,149,0.05),0_6px_20px_-12px_rgba(76,29,149,0.12)] sm:p-6";
export const inputClass = "flex min-h-11 w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus-visible:border-violet-500 focus-visible:ring-4 focus-visible:ring-violet-100 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-400";
export const iconProps = { "aria-hidden": true, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.8, strokeLinecap: "round", strokeLinejoin: "round" } as const;
/** Soft icon/avatar backgrounds, cycled by rank so neighbouring rows stay distinguishable. */
export const tints = ["bg-violet-100 text-violet-600", "bg-teal-100 text-teal-600", "bg-emerald-100 text-emerald-600", "bg-orange-100 text-orange-600", "bg-pink-100 text-pink-600"];

export function Skeleton({ className = "" }: { className?: string }) {
  return <span aria-hidden className={`block animate-pulse rounded-md bg-slate-200/80 ${className}`} />;
}

export function formatDuration(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  return `${Math.floor(seconds / 60)}m ${seconds % 60}s`;
}

/** Plain text of an HTML snippet, entities decoded. Browser-only (list/forms render after load). */
export function stripHtml(value: string): string {
  if (!value) return "";
  return (new DOMParser().parseFromString(value, "text/html").body.textContent ?? "").replace(/\s+/g, " ").trim();
}

const graphemes = new Intl.Segmenter();

/** Latin names get two initials; other scripts (Malayalam) get one whole letter so vowel signs stay attached. */
export function initials(name: string): string {
  const words = name.split(/\s+/).filter(Boolean);
  const first = (word: string) => graphemes.segment(word)[Symbol.iterator]().next().value?.segment ?? "";
  return (/^[A-Za-z]/.test(name) ? words.slice(0, 2).map(first).join("") : first(words[0] ?? "")).toUpperCase();
}

const dayFormat = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });

/** "1 Oct 2026" from a WordPress date string; its wall-clock date is kept, so no time-zone shift. */
export function formatDay(value?: string | null): string {
  const match = value?.match(/^(\d{4})-(\d{2})-(\d{2})/);
  return match ? dayFormat.format(new Date(`${match[1]}-${match[2]}-${match[3]}T12:00:00Z`)) : "—";
}

export type Author = { id: number; name: string; slug?: string; description?: string; email?: string; roles?: string[]; registered_date?: string; /** The author's uploaded profile photo, when they have one. */ avatar?: string | null };
export type Category = { id: number; name: string; count: number };
