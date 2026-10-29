/* The homepage as data: an ordered list of sections the admin's Homepage screen
   edits and app/page.tsx renders (docs/admin-homepage-roles-plan.md).

   Pure module: the admin UI imports it for the types, defaults and the same
   validation the server applies, so nothing here may touch the database. */

export type Placement = "full" | "main" | "side";
export type Visibility = "all" | "desktop" | "mobile";
export type PostStyle = "tabbed" | "featured_list" | "compact_tabs" | "slider" | "portrait_grid" | "grid";

export interface SectionTab {
  label: string;
  categoryId: number;
}

interface Base {
  id: string;
  enabled: boolean;
  placement: Placement;
  visibility: Visibility;
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
  count: number;
}

export interface BannersSection extends Base {
  kind: "banners";
}

export interface WatchSection extends Base {
  kind: "watch";
  title: string;
  href: string;
  count: number;
}

export interface ListenSection extends Base {
  kind: "listen";
  title: string;
  href: string;
  perPage: number;
}

export interface PostsSection extends Base {
  kind: "posts";
  title: string;
  /** "See all" link; empty = derived from the source. */
  href: string;
  style: PostStyle;
  /** Posts from these categories and their sub-categories; empty with no tag = latest posts. */
  categoryIds: number[];
  /** A tag source wins over categories. */
  tagId: number | null;
  count: number;
  /** Extra tabs after "All" (tabbed and compact_tabs styles). */
  tabs: SectionTab[];
}

export interface ImageSection extends Base {
  kind: "image";
  img: string;
  href: string;
  alt: string;
  width: number;
  height: number;
}

export type HomeSection = HeroSection | ReelsSection | BannersSection | WatchSection | ListenSection | PostsSection | ImageSection;
export type SectionKind = HomeSection["kind"];

export const MAX_SECTIONS = 40;
const MAX_TABS = 8;
const MAX_IDS = 30;

export const KIND_LABELS: Record<SectionKind, string> = {
  hero: "Hero slider",
  reels: "Reels",
  banners: "Promo banners",
  watch: "Watch (videos)",
  listen: "Listen (podcast)",
  posts: "Article list",
  image: "Image banner",
};

export const STYLE_LABELS: Record<PostStyle, string> = {
  tabbed: "Tabbed: featured card + list",
  featured_list: "Featured card + list",
  compact_tabs: "Compact list with topic menu",
  slider: "Horizontal card slider",
  portrait_grid: "Portrait tiles (infographics)",
  grid: "Card grid",
};

/* Count limits per section, so a typo cannot ask the database for 10,000 posts. */
const COUNT = { posts: [1, 24], reels: [1, 12], watch: [1, 10], listen: [1, 20], heroMain: [1, 8], heroSide: [0, 4] } as const;

let seq = 0;
export function newSectionId(): string {
  seq = (seq + 1) % 1_000_000;
  return `s${Date.now().toString(36)}${seq.toString(36)}${Math.floor(Math.random() * 1296).toString(36)}`;
}

const base = (id: string, placement: Placement, visibility: Visibility = "all"): Base => ({ id, enabled: true, placement, visibility });

/* The homepage as it was hand-built (2026-09-02 clone of the live site). The
   category ids are the section parents; sub-categories are included at render. */
export const DEFAULT_LAYOUT: HomeSection[] = [
  { ...base("hero", "full"), kind: "hero", categoryIds: [7899, 3, 28, 4], mainCount: 4, sideCount: 2 },
  { ...base("reels", "full"), kind: "reels", title: "Reels", href: "/reels", count: 6 },
  { ...base("picks-mobile", "full", "mobile"), kind: "posts", title: "Editor's Picks", href: "/tag/editorspicks", style: "slider", categoryIds: [], tagId: 28542, count: 5, tabs: [] },
  { ...base("banners", "full"), kind: "banners" },
  {
    ...base("shariah", "main"), kind: "posts", title: "Shari'ah", href: "/category/shariah", style: "tabbed", categoryIds: [3], tagId: null, count: 5,
    tabs: [{ label: "Quran", categoryId: 22 }, { label: "Faith", categoryId: 51 }, { label: "Fiqh", categoryId: 24 }, { label: "Sunnah", categoryId: 23 }, { label: "Tharbiya", categoryId: 30 }],
  },
  { ...base("picks", "side", "desktop"), kind: "posts", title: "Editor's Picks", href: "/tag/editorspicks", style: "featured_list", categoryIds: [], tagId: 28542, count: 4, tabs: [] },
  { ...base("watch", "main"), kind: "watch", title: "Watch", href: "/watch-videos", count: 5 },
  { ...base("listen", "main"), kind: "listen", title: "Listen", href: "/listen", perPage: 6 },
  { ...base("columns", "side"), kind: "posts", title: "Columns", href: "/category/columns", style: "featured_list", categoryIds: [28], tagId: null, count: 12, tabs: [] },
  {
    ...base("opinion", "main"), kind: "posts", title: "Opinion", href: "/category/opinion", style: "tabbed", categoryIds: [7899], tagId: null, count: 5,
    tabs: [{ label: "India Today", categoryId: 26 }, { label: "Kerala Voice", categoryId: 28543 }, { label: "Palestine", categoryId: 3147 }, { label: "Top Stories", categoryId: 25802 }, { label: "World Wide", categoryId: 28544 }],
  },
  {
    ...base("culture", "side"), kind: "posts", title: "Culture", href: "/category/culture", style: "compact_tabs", categoryIds: [4], tagId: null, count: 4,
    tabs: [{ label: "History", categoryId: 25 }, { label: "Civilization", categoryId: 31 }, { label: "Art & Literature", categoryId: 9 }, { label: "Travel", categoryId: 7 }],
  },
  { ...base("infographics", "full"), kind: "posts", title: "Infographics", href: "/category/infographics", style: "portrait_grid", categoryIds: [28546], tagId: null, count: 6, tabs: [] },
];

/** A fresh section of a kind, for the "Add section" menu. */
export function blankSection(kind: SectionKind): HomeSection {
  const id = newSectionId();
  switch (kind) {
    case "hero": return { ...base(id, "full"), kind, categoryIds: [], mainCount: 4, sideCount: 2 };
    case "reels": return { ...base(id, "full"), kind, title: "Reels", href: "/reels", count: 6 };
    case "banners": return { ...base(id, "full"), kind };
    case "watch": return { ...base(id, "main"), kind, title: "Watch", href: "/watch-videos", count: 5 };
    case "listen": return { ...base(id, "main"), kind, title: "Listen", href: "/listen", perPage: 6 };
    case "image": return { ...base(id, "full"), kind, img: "", href: "", alt: "", width: 1440, height: 120 };
    default: return { ...base(id, "full"), kind: "posts", title: "New section", href: "", style: "grid", categoryIds: [], tagId: null, count: 8, tabs: [] };
  }
}

/* ---------- validation ---------- */

type Raw = Record<string, unknown>;

function text(value: unknown, max: number): string {
  return typeof value === "string" ? value.replace(/[\u0000-\u001f]/g, " ").trim().slice(0, max) : "";
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
  if (!href) return "";
  if (href.startsWith("/") && !href.startsWith("//")) return href;
  return /^https?:\/\/[^\s]+$/i.test(href) ? href : "";
}

function pick<T extends string>(value: unknown, allowed: readonly T[], fallback: T): T {
  return allowed.includes(value as T) ? (value as T) : fallback;
}

const PLACEMENTS = ["full", "main", "side"] as const;
const VISIBILITIES = ["all", "desktop", "mobile"] as const;
const STYLES = ["tabbed", "featured_list", "compact_tabs", "slider", "portrait_grid", "grid"] as const;

function sanitizeSection(raw: Raw, used: Set<string>): HomeSection | null {
  let id = text(raw.id, 40).replace(/[^A-Za-z0-9_-]/g, "");
  if (!id || used.has(id)) id = newSectionId();
  used.add(id);
  const shared: Base = { id, enabled: raw.enabled !== false, placement: pick(raw.placement, PLACEMENTS, "full"), visibility: pick(raw.visibility, VISIBILITIES, "all") };
  switch (raw.kind) {
    case "hero":
      // the hero is a full-width row; in a column it would not fit
      return { ...shared, placement: "full", kind: "hero", categoryIds: ids(raw.categoryIds), mainCount: int(raw.mainCount, COUNT.heroMain, 4), sideCount: int(raw.sideCount, COUNT.heroSide, 2) };
    case "reels":
      return { ...shared, kind: "reels", title: text(raw.title, 80), href: safeHref(raw.href), count: int(raw.count, COUNT.reels, 6) };
    case "banners":
      return { ...shared, kind: "banners" };
    case "watch":
      return { ...shared, kind: "watch", title: text(raw.title, 80), href: safeHref(raw.href), count: int(raw.count, COUNT.watch, 5) };
    case "listen":
      return { ...shared, kind: "listen", title: text(raw.title, 80), href: safeHref(raw.href), perPage: int(raw.perPage, COUNT.listen, 6) };
    case "image": {
      const img = safeHref(raw.img);
      return { ...shared, kind: "image", img, href: safeHref(raw.href), alt: text(raw.alt, 200), width: int(raw.width, [50, 4000], 1440), height: int(raw.height, [20, 4000], 120) };
    }
    case "posts": {
      const tagId = Number(raw.tagId);
      const tabs = Array.isArray(raw.tabs)
        ? (raw.tabs as Raw[]).filter((tab) => tab && typeof tab === "object").map((tab) => ({ label: text(tab.label, 60), categoryId: Number(tab.categoryId) })).filter((tab) => tab.label && Number.isInteger(tab.categoryId) && tab.categoryId > 0).slice(0, MAX_TABS)
        : [];
      return {
        ...shared,
        kind: "posts",
        title: text(raw.title, 80),
        href: safeHref(raw.href),
        style: pick(raw.style, STYLES, "grid"),
        categoryIds: ids(raw.categoryIds),
        tagId: Number.isInteger(tagId) && tagId > 0 ? tagId : null,
        count: int(raw.count, COUNT.posts, 5),
        tabs,
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
