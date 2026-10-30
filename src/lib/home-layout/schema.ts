/* The homepage as data: an ordered list of sections the admin's Homepage screen
   edits and app/page.tsx renders (docs/admin-homepage-roles-plan.md).

   Pure module: the admin UI imports it for the types, defaults and the same
   validation the server applies, so nothing here may touch the database. */

import { DEFAULT_LOOK, isDark, sanitizeLook, type SectionLook } from "./theme";

export type Placement = "full" | "main" | "side";
export type Visibility = "all" | "desktop" | "mobile";
export type PostStyle = "tabbed" | "featured_list" | "compact_tabs" | "slider" | "portrait_grid" | "grid" | "list";
/** Phones: cards stacked one under another, or one row that swipes sideways. */
export type PhoneLayout = "stack" | "row";
/** Card picture shape; "" = the style's own. */
export type ImageShape = "" | "wide" | "video" | "square" | "tall";

export interface SectionTab {
  label: string;
  categoryId: number;
}

interface Base {
  id: string;
  enabled: boolean;
  placement: Placement;
  visibility: Visibility;
  look: SectionLook;
  /** YYYY-MM-DD in India time; "" = no limit. Outside the window readers do not see the section. */
  showFrom: string;
  showUntil: string;
}

export interface HeroSection extends Base {
  kind: "hero";
  /** The slider and side cards rotate the newest posts of these categories (and their sub-categories). */
  categoryIds: number[];
  mainCount: number;
  sideCount: number;
}

export interface ReelsSection extends Base {
  kind: "reels";
  title: string;
  href: string;
  /** Text of the "See all" link; "" = "See all". */
  linkLabel: string;
  count: number;
}

export interface BannerItem {
  img: string;
  href: string;
  alt: string;
  width: number;
  height: number;
}

export interface BannersSection extends Base {
  kind: "banners";
  /** Banners set in the builder; empty = the saved promo strip (banners collection). */
  items: BannerItem[];
}

export interface WatchSection extends Base {
  kind: "watch";
  title: string;
  href: string;
  linkLabel: string;
  count: number;
}

export interface ListenSection extends Base {
  kind: "listen";
  title: string;
  href: string;
  linkLabel: string;
  perPage: number;
}

export interface PostsSection extends Base {
  kind: "posts";
  title: string;
  /** "See all" link; empty = derived from the source. */
  href: string;
  linkLabel: string;
  style: PostStyle;
  /** Posts from these categories and their sub-categories; empty with no tag = latest posts. */
  categoryIds: number[];
  /** A tag source wins over categories. */
  tagId: number | null;
  count: number;
  /** Extra tabs after "All" (tabbed and compact_tabs styles). */
  tabs: SectionTab[];
  /** Cards per row on computers (grid, list, portrait tiles); 0 = automatic. */
  columns: number;
  phoneLayout: PhoneLayout;
  imageShape: ImageShape;
}

export interface ImageSection extends Base {
  kind: "image";
  img: string;
  href: string;
  alt: string;
  width: number;
  height: number;
}

/** Free text with an optional button and an embedded player, form or map from a known host. */
export interface CustomSection extends Base {
  kind: "custom";
  title: string;
  /** Plain text; blank lines separate paragraphs. */
  text: string;
  buttonLabel: string;
  buttonHref: string;
  /** A YouTube, Vimeo, Spotify, Google Forms or Google Maps link (see embedFor). */
  embedUrl: string;
  align: "left" | "center";
}

export type HomeSection = HeroSection | ReelsSection | BannersSection | WatchSection | ListenSection | PostsSection | ImageSection | CustomSection;
export type SectionKind = HomeSection["kind"];

export const MAX_SECTIONS = 40;
const MAX_TABS = 8;
export const MAX_BANNERS = 10;
/** Room for a Google Maps embed address, whose pb parameter runs to 2000 characters. */
export const MAX_EMBED_URL = 2200;
const MAX_IDS = 30;

export const KIND_LABELS: Record<SectionKind, string> = {
  hero: "Hero slider",
  reels: "Reels",
  banners: "Promo banners",
  watch: "Watch (videos)",
  listen: "Listen (podcast)",
  posts: "Article list",
  image: "Image banner",
  custom: "Text & embed",
};

export const STYLE_LABELS: Record<PostStyle, string> = {
  tabbed: "Tabbed: featured card + list",
  featured_list: "Featured card + list",
  compact_tabs: "Compact list with topic menu",
  slider: "One row, swipes sideways",
  portrait_grid: "Portrait tiles (infographics)",
  grid: "Card grid",
  list: "List, one under another",
};

export const SHAPE_LABELS: Record<ImageShape, string> = { "": "The layout's own", wide: "Wide (16:10)", video: "Video (16:9)", square: "Square", tall: "Tall (4:5)" };
/** The styles whose picture shape can be chosen. */
export const SHAPEABLE: readonly PostStyle[] = ["grid", "slider", "portrait_grid"];

/** The styles whose cards per row and phone arrangement can be chosen. */
export const ARRANGEABLE: readonly PostStyle[] = ["grid", "portrait_grid", "list"];
export const MAX_COLUMNS = 6;

/* Count limits per section, so a typo cannot ask the database for 10,000 posts. */
const COUNT = { posts: [1, 24], reels: [1, 12], watch: [1, 10], listen: [1, 20], heroMain: [1, 8], heroSide: [0, 4] } as const;

let seq = 0;
export function newSectionId(): string {
  seq = (seq + 1) % 1_000_000;
  return `s${Date.now().toString(36)}${seq.toString(36)}${Math.floor(Math.random() * 1296).toString(36)}`;
}

const base = (id: string, placement: Placement, visibility: Visibility = "all"): Base => ({ id, enabled: true, placement, visibility, look: DEFAULT_LOOK, showFrom: "", showUntil: "" });
/** Cards per row and phone arrangement as each style always had them. */
const arrange = (style: PostStyle): { columns: number; phoneLayout: PhoneLayout; imageShape: ImageShape } => ({ columns: 0, phoneLayout: style === "portrait_grid" || style === "slider" ? "row" : "stack", imageShape: "" });

/* The homepage as it was hand-built (2026-09-02 clone of the live site). The
   category ids are the section parents; sub-categories are included at render. */
export const DEFAULT_LAYOUT: HomeSection[] = [
  { ...base("hero", "full"), kind: "hero", categoryIds: [7899, 3, 28, 4], mainCount: 4, sideCount: 2 },
  { ...base("reels", "full"), kind: "reels", title: "Reels", href: "/reels", linkLabel: "", count: 6 },
  { ...base("picks-mobile", "full", "mobile"), kind: "posts", title: "Editor's Picks", href: "/tag/editorspicks", linkLabel: "", style: "slider", categoryIds: [], tagId: 28542, count: 5, tabs: [], ...arrange("slider") },
  { ...base("banners", "full"), kind: "banners", items: [] },
  {
    ...base("shariah", "main"), kind: "posts", title: "Shari'ah", href: "/category/shariah", linkLabel: "", style: "tabbed", categoryIds: [3], tagId: null, count: 5,
    tabs: [{ label: "Quran", categoryId: 22 }, { label: "Faith", categoryId: 51 }, { label: "Fiqh", categoryId: 24 }, { label: "Sunnah", categoryId: 23 }, { label: "Tharbiya", categoryId: 30 }], ...arrange("tabbed"),
  },
  { ...base("picks", "side", "desktop"), kind: "posts", title: "Editor's Picks", href: "/tag/editorspicks", linkLabel: "", style: "featured_list", categoryIds: [], tagId: 28542, count: 4, tabs: [], ...arrange("featured_list") },
  { ...base("watch", "main"), kind: "watch", title: "Watch", href: "/watch-videos", linkLabel: "", count: 5 },
  { ...base("listen", "main"), kind: "listen", title: "Listen", href: "/listen", linkLabel: "", perPage: 6 },
  { ...base("columns", "side"), kind: "posts", title: "Columns", href: "/category/columns", linkLabel: "", style: "featured_list", categoryIds: [28], tagId: null, count: 12, tabs: [], ...arrange("featured_list") },
  {
    ...base("opinion", "main"), kind: "posts", title: "Opinion", href: "/category/opinion", linkLabel: "", style: "tabbed", categoryIds: [7899], tagId: null, count: 5,
    tabs: [{ label: "India Today", categoryId: 26 }, { label: "Kerala Voice", categoryId: 28543 }, { label: "Palestine", categoryId: 3147 }, { label: "Top Stories", categoryId: 25802 }, { label: "World Wide", categoryId: 28544 }], ...arrange("tabbed"),
  },
  {
    ...base("culture", "side"), kind: "posts", title: "Culture", href: "/category/culture", linkLabel: "", style: "compact_tabs", categoryIds: [4], tagId: null, count: 4,
    tabs: [{ label: "History", categoryId: 25 }, { label: "Civilization", categoryId: 31 }, { label: "Art & Literature", categoryId: 9 }, { label: "Travel", categoryId: 7 }], ...arrange("compact_tabs"),
  },
  { ...base("infographics", "full"), kind: "posts", title: "Infographics", href: "/category/infographics", linkLabel: "", style: "portrait_grid", categoryIds: [28546], tagId: null, count: 6, tabs: [], ...arrange("portrait_grid") },
];

/** A fresh section of a kind, for the "Add section" menu. */
export function blankSection(kind: SectionKind): HomeSection {
  const id = newSectionId();
  switch (kind) {
    case "hero": return { ...base(id, "full"), kind, categoryIds: [], mainCount: 4, sideCount: 2 };
    case "reels": return { ...base(id, "full"), kind, title: "Reels", href: "/reels", linkLabel: "", count: 6 };
    case "banners": return { ...base(id, "full"), kind, items: [] };
    case "custom": return { ...base(id, "full"), kind, title: "", text: "", buttonLabel: "", buttonHref: "", embedUrl: "", align: "left" };
    case "watch": return { ...base(id, "main"), kind, title: "Watch", href: "/watch-videos", linkLabel: "", count: 5 };
    case "listen": return { ...base(id, "main"), kind, title: "Listen", href: "/listen", linkLabel: "", perPage: 6 };
    case "image": return { ...base(id, "full"), kind, img: "", href: "", alt: "", width: 1440, height: 120 };
    default: return { ...base(id, "full"), kind: "posts", title: "New section", href: "", linkLabel: "", style: "grid", categoryIds: [], tagId: null, count: 8, tabs: [], ...arrange("grid") };
  }
}

/* ---------- validation ---------- */

type Raw = Record<string, unknown>;

function text(value: unknown, max: number): string {
  return typeof value === "string" ? value.replace(/[\u0000-\u001f]/g, " ").trim().slice(0, max) : "";
}

/** Like text(), but keeps line breaks (one blank line between paragraphs at most). */
function multiline(value: unknown, max: number): string {
  return typeof value === "string" ? value.replace(/\r\n?/g, "\n").replace(/[\u0000-\u0009\u000b-\u001f]/g, " ").replace(/\n{3,}/g, "\n\n").trim().slice(0, max) : "";
}

/** "YYYY-MM-DD" for a real calendar date, else "". */
export function safeDay(value: unknown): string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return "";
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value ? value : "";
}

function int(value: unknown, [min, max]: readonly [number, number], fallback: number): number {
  const n = Number(value);
  return Number.isFinite(n) ? Math.min(max, Math.max(min, Math.round(n))) : fallback;
}

function ids(value: unknown): number[] {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.map(Number).filter((n) => Number.isInteger(n) && n > 0))].slice(0, MAX_IDS);
}

/** A link a reader may follow: site-relative, or http(s). Anything else (javascript:, data:) becomes "". */
export function safeHref(value: unknown): string {
  const href = text(value, 500);
  // browsers treat a backslash as "/", so a path like /\evil.com would lead to another site
  if (!href || href.includes("\\")) return "";
  if (href.startsWith("/") && !href.startsWith("//")) return href;
  return /^https?:\/\/[^\s]+$/i.test(href) ? href : "";
}

function pick<T extends string>(value: unknown, allowed: readonly T[], fallback: T): T {
  return allowed.includes(value as T) ? (value as T) : fallback;
}

const PLACEMENTS = ["full", "main", "side"] as const;
const VISIBILITIES = ["all", "desktop", "mobile"] as const;
const STYLES = ["tabbed", "featured_list", "compact_tabs", "slider", "portrait_grid", "grid", "list"] as const;
const PHONE_LAYOUTS = ["stack", "row"] as const;
const SHAPES = ["", "wide", "video", "square", "tall"] as const;

function banner(raw: Raw): BannerItem | null {
  const img = safeHref(raw.img);
  if (!img) return null;
  return { img, href: safeHref(raw.href), alt: text(raw.alt, 200), width: int(raw.width, [50, 4000], 1440), height: int(raw.height, [20, 4000], 120) };
}

function sanitizeSection(raw: Raw, used: Set<string>): HomeSection | null {
  let id = text(raw.id, 40).replace(/[^A-Za-z0-9_-]/g, "");
  if (!id || used.has(id)) id = newSectionId();
  used.add(id);
  const showFrom = safeDay(raw.showFrom);
  let showUntil = safeDay(raw.showUntil);
  if (showFrom && showUntil && showUntil < showFrom) showUntil = "";
  const shared: Base = { id, enabled: raw.enabled !== false, placement: pick(raw.placement, PLACEMENTS, "full"), visibility: pick(raw.visibility, VISIBILITIES, "all"), look: sanitizeLook(raw.look), showFrom, showUntil };
  const linkLabel = text(raw.linkLabel, 40);
  switch (raw.kind) {
    case "hero":
      // the hero is a full-width row; in a column it would not fit
      return { ...shared, placement: "full", kind: "hero", categoryIds: ids(raw.categoryIds), mainCount: int(raw.mainCount, COUNT.heroMain, 4), sideCount: int(raw.sideCount, COUNT.heroSide, 2) };
    case "reels":
      return { ...shared, kind: "reels", title: text(raw.title, 80), href: safeHref(raw.href), linkLabel, count: int(raw.count, COUNT.reels, 6) };
    case "banners": {
      const items = Array.isArray(raw.items) ? (raw.items as Raw[]).filter((item) => item && typeof item === "object").map(banner).filter((item): item is BannerItem => item !== null).slice(0, MAX_BANNERS) : [];
      return { ...shared, kind: "banners", items };
    }
    case "custom":
      return {
        ...shared,
        kind: "custom",
        title: text(raw.title, 80),
        text: multiline(raw.text, 2000),
        buttonLabel: text(raw.buttonLabel, 40),
        buttonHref: safeHref(raw.buttonHref),
        // only links embedFor() turns into a player; anything else is dropped
        embedUrl: embedFor(text(raw.embedUrl, MAX_EMBED_URL)) ? text(raw.embedUrl, MAX_EMBED_URL) : "",
        align: raw.align === "center" ? "center" : "left",
      };
    case "watch":
      // the video panel's text is white: it keeps a dark box (built-in, dark or a custom colour)
      return { ...shared, look: { ...shared.look, ...(["plain", "soft", "tint"].includes(shared.look.background) || (shared.look.background === "custom" && !isDark(shared.look.bgColor)) ? { background: "" as const, bgColor: "" } : {}) }, kind: "watch", title: text(raw.title, 80), href: safeHref(raw.href), linkLabel, count: int(raw.count, COUNT.watch, 5) };
    case "listen":
      return { ...shared, kind: "listen", title: text(raw.title, 80), href: safeHref(raw.href), linkLabel, perPage: int(raw.perPage, COUNT.listen, 6) };
    case "image": {
      const img = safeHref(raw.img);
      return { ...shared, kind: "image", img, href: safeHref(raw.href), alt: text(raw.alt, 200), width: int(raw.width, [50, 4000], 1440), height: int(raw.height, [20, 4000], 120) };
    }
    case "posts": {
      const tagId = Number(raw.tagId);
      const tabs = Array.isArray(raw.tabs)
        ? (raw.tabs as Raw[]).filter((tab) => tab && typeof tab === "object").map((tab) => ({ label: text(tab.label, 60), categoryId: Number(tab.categoryId) })).filter((tab) => tab.label && Number.isInteger(tab.categoryId) && tab.categoryId > 0).slice(0, MAX_TABS)
        : [];
      const style = pick(raw.style, STYLES, "grid");
      return {
        ...shared,
        kind: "posts",
        title: text(raw.title, 80),
        href: safeHref(raw.href),
        linkLabel,
        style,
        categoryIds: ids(raw.categoryIds),
        tagId: Number.isInteger(tagId) && tagId > 0 ? tagId : null,
        count: int(raw.count, COUNT.posts, 5),
        tabs,
        columns: int(raw.columns, [0, MAX_COLUMNS], 0),
        phoneLayout: pick(raw.phoneLayout, PHONE_LAYOUTS, arrange(style).phoneLayout),
        imageShape: pick(raw.imageShape, SHAPES, ""),
      };
    }
    default:
      return null;
  }
}

/** The layout to store: unknown kinds dropped, every field typed, clamped and safe. */
export function sanitizeLayout(input: unknown): HomeSection[] {
  if (!Array.isArray(input)) throw new Error("The layout must be a list of sections.");
  if (input.length > MAX_SECTIONS) throw new Error(`A homepage can have at most ${MAX_SECTIONS} sections.`);
  const used = new Set<string>();
  return input.flatMap((raw) => {
    const section = raw && typeof raw === "object" ? sanitizeSection(raw as Raw, used) : null;
    return section ? [section] : [];
  });
}

/* ---------- schedule ---------- */

/** Today's date in India (the newsroom's day), as YYYY-MM-DD. */
export function todayInIndia(now: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata", year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
}

/** Whether readers see the section on `day` (both ends inclusive). */
export function isScheduledOn(section: Pick<HomeSection, "showFrom" | "showUntil">, day: string): boolean {
  return (!section.showFrom || day >= section.showFrom) && (!section.showUntil || day <= section.showUntil);
}

/* ---------- embeds ---------- */

export interface Embed {
  src: string;
  /** CSS aspect-ratio for players, or a fixed pixel height for forms and audio. */
  aspect?: string;
  height?: number;
  title: string;
}

/**
 * The iframe for a link from a host we know how to embed, or null. Only these
 * hosts are allowed, and the src is rebuilt from the parts we parsed, so a
 * pasted link can never put an arbitrary page or script on the homepage.
 */
export function embedFor(input: string): Embed | null {
  let url: URL;
  try { url = new URL(input.trim()); } catch { return null; }
  if (url.protocol !== "https:") return null;
  const host = url.hostname.replace(/^www\./, "").replace(/^m\./, "");
  const id = (value: string | null | undefined, pattern: RegExp) => (value && pattern.test(value) ? value : null);

  if (host === "youtube.com" || host === "youtu.be" || host === "youtube-nocookie.com") {
    const video = host === "youtu.be" ? url.pathname.slice(1) : url.pathname.startsWith("/embed/") || url.pathname.startsWith("/shorts/") || url.pathname.startsWith("/live/") ? url.pathname.split("/")[2] : url.searchParams.get("v");
    const ok = id(video, /^[\w-]{11}$/);
    return ok ? { src: `https://www.youtube-nocookie.com/embed/${ok}`, aspect: "16 / 9", title: "YouTube video" } : null;
  }
  if (host === "vimeo.com" || host === "player.vimeo.com") {
    // vimeo.com/123456789, vimeo.com/123456789/abcdef1234 (unlisted), player.vimeo.com/video/123456789?h=abcdef1234
    const parts = url.pathname.split("/").filter(Boolean).filter((p) => p !== "video");
    const ok = id(parts[0], /^\d{5,12}$/);
    const hash = id(parts[1] ?? url.searchParams.get("h"), /^[0-9a-f]{6,20}$/);
    return ok ? { src: `https://player.vimeo.com/video/${ok}${hash ? `?h=${hash}` : ""}`, aspect: "16 / 9", title: "Vimeo video" } : null;
  }
  if (host === "open.spotify.com") {
    // links shared from some countries carry /intl-xx first
    const [, type, ref] = url.pathname.replace(/^\/intl-[a-z]{2}(-[a-z]{2})?/i, "").replace(/^\/embed/, "").split("/");
    const kinds = ["episode", "show", "track", "playlist", "album"];
    const ok = kinds.includes(type) ? id(ref, /^[A-Za-z0-9]{22}$/) : null;
    return ok ? { src: `https://open.spotify.com/embed/${type}/${ok}`, height: type === "episode" || type === "track" ? 152 : 352, title: "Spotify player" } : null;
  }
  if (host === "docs.google.com" && url.pathname.startsWith("/forms/d/")) {
    const [, , , kind, form] = url.pathname.split("/");
    const ok = kind === "e" ? id(form, /^[\w-]{20,80}$/) : null;
    return ok ? { src: `https://docs.google.com/forms/d/e/${ok}/viewform?embedded=true`, height: 760, title: "Form" } : null;
  }
  if (host === "google.com" && url.pathname === "/maps/embed") {
    // the raw, still percent-encoded value: place names arrive as %20, %2C or Malayalam %E0%B4…
    const pb = id(/[?&]pb=([^&#]*)/.exec(url.search)?.[1], /^[\w!.:%*+-]{10,2000}$/);
    return pb ? { src: `https://www.google.com/maps/embed?pb=${pb}`, aspect: "16 / 9", title: "Map" } : null;
  }
  return null;
}

/* ---------- arrangement ---------- */

export type LayoutGroup =
  | { type: "full"; section: HomeSection }
  | { type: "columns"; rows: { main: HomeSection[]; side: HomeSection[] }[] };

/**
 * Enabled sections in render order. Consecutive main/side sections form one
 * two-column block; inside it a row closes when a main section follows a side
 * one, so "Shari'ah, Picks, Watch, Listen, Columns" pairs Shari'ah with Picks
 * and Watch+Listen with Columns.
 */
export function groupSections(sections: HomeSection[]): LayoutGroup[] {
  const groups: LayoutGroup[] = [];
  let block: { main: HomeSection[]; side: HomeSection[] }[] | null = null;
  for (const section of sections) {
    if (!section.enabled) continue;
    if (section.placement === "full") {
      block = null;
      groups.push({ type: "full", section });
      continue;
    }
    if (!block) {
      block = [];
      groups.push({ type: "columns", rows: block });
    }
    let row = block[block.length - 1];
    if (!row || (section.placement === "main" && row.side.length > 0)) {
      row = { main: [], side: [] };
      block.push(row);
    }
    row[section.placement].push(section);
  }
  return groups;
}
