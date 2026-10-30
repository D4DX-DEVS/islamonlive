/* The homepage's page-wide style (fonts, text colours, sizes, weights, page
   background, spacing) and each section's look (background, accent, which card
   details show). Edited in the builder's Style panel, stored next to the
   sections in home_layout, rendered as one scoped <style>: under .home-theme
   on the homepage, or on <body> for every public page when the style is set
   to apply site-wide.

   Pure module like schema.ts: the builder imports it for the options and the
   same validation the server applies. Every value that reaches CSS is a key
   from a fixed list, a clamped number or a #rrggbb colour, so nothing an
   administrator types can break out of the stylesheet. */

export interface FontOption {
  key: string;
  label: string;
  /** The next/font variable (app/fonts.ts declares it on <body>). */
  cssVar: string;
  serif: boolean;
}

/* Malayalam faces also carry Latin glyphs; an English face, when chosen, goes
   first in the stack, so the browser takes Latin letters from it and falls
   through to the Malayalam face for Malayalam letters. */
export const ML_FONTS: FontOption[] = [
  { key: "noto-sans", label: "Noto Sans Malayalam", cssVar: "--font-noto-ml", serif: false },
  { key: "anek", label: "Anek Malayalam", cssVar: "--font-anek-ml", serif: false },
  { key: "noto-serif", label: "Noto Serif Malayalam", cssVar: "--font-serif-ml", serif: true },
  { key: "manjari", label: "Manjari", cssVar: "--font-manjari", serif: false },
  { key: "baloo-chettan", label: "Baloo Chettan 2", cssVar: "--font-baloo-ml", serif: false },
  { key: "gayathri", label: "Gayathri", cssVar: "--font-gayathri", serif: false },
  { key: "arima", label: "Arima", cssVar: "--font-arima", serif: false },
  { key: "chilanka", label: "Chilanka (handwritten)", cssVar: "--font-chilanka", serif: false },
];

export const EN_FONTS: FontOption[] = [
  { key: "inter", label: "Inter", cssVar: "--font-inter", serif: false },
  { key: "poppins", label: "Poppins", cssVar: "--font-poppins", serif: false },
  { key: "roboto", label: "Roboto", cssVar: "--font-roboto", serif: false },
  { key: "montserrat", label: "Montserrat", cssVar: "--font-montserrat", serif: false },
  { key: "merriweather", label: "Merriweather", cssVar: "--font-merriweather", serif: true },
  { key: "playfair", label: "Playfair Display", cssVar: "--font-playfair", serif: true },
  { key: "lora", label: "Lora", cssVar: "--font-lora", serif: true },
];

/** English font "" = use the Malayalam font's own Latin letters. */
export const SAME_AS_MALAYALAM = "";

export type ThemeScope = "home" | "site";
export type Spacing = "compact" | "normal" | "roomy";

export interface HomeTheme {
  /** The homepage only, or every public page (header, footer, article and archive pages too). */
  scope: ThemeScope;
  mlHeadingFont: string;
  mlBodyFont: string;
  enHeadingFont: string;
  enBodyFont: string;
  /** Section headings ("Shari'ah", "Opinion"). "" = site default. */
  headingColor: string;
  /** Article headlines on light backgrounds. */
  titleColor: string;
  /** Summaries, bylines and dates. */
  textColor: string;
  /** Heading bars, "See all", category labels, hover colour. */
  accentColor: string;
  /** Percentages of the built-in sizes. */
  headingSize: number;
  titleSize: number;
  textSize: number;
  /** 0 = each heading's built-in weight; otherwise 400–900. */
  headingWeight: number;
  titleWeight: number;
  /** Behind the whole page; "" = the site's light grey. */
  pageBackground: string;
  /** Space between homepage sections. */
  spacing: Spacing;
}

export const DEFAULT_THEME: HomeTheme = {
  scope: "home",
  mlHeadingFont: "anek",
  mlBodyFont: "noto-sans",
  enHeadingFont: SAME_AS_MALAYALAM,
  enBodyFont: SAME_AS_MALAYALAM,
  headingColor: "",
  titleColor: "",
  textColor: "",
  accentColor: "",
  headingSize: 100,
  titleSize: 100,
  textSize: 100,
  headingWeight: 0,
  titleWeight: 0,
  pageBackground: "",
  spacing: "normal",
};

export const SIZE_RANGE = [80, 150] as const;
export const WEIGHTS = [400, 500, 600, 700, 800, 900] as const;

/* Where the site-wide style applies: every page except the admin and the
   builder's preview (which renders its own draft style instead). */
export const SITE_SCOPE = "body.site-theme:not(:has([data-admin-root],[data-preview-root]))";
/** The builder preview of a draft style that applies site-wide. */
export const PREVIEW_SITE_SCOPE = "body:has([data-preview-root])";

/* ---------- section look ---------- */

/** "" = the section's built-in look (Reels' grey box, Watch's dark panel, nothing for the rest). */
export type SectionBackground = "" | "plain" | "soft" | "tint" | "dark" | "custom";

/** Card details a section can leave out; components mark them with data-meta (globals.css hides them). */
export type MetaPart = "category" | "author" | "date" | "excerpt";
export const META_PARTS: { key: MetaPart; label: string }[] = [
  { key: "category", label: "Category label" },
  { key: "author", label: "Author" },
  { key: "date", label: "Date" },
  { key: "excerpt", label: "Summary" },
];

export interface SectionLook {
  background: SectionBackground;
  /** #rrggbb, used when background is "custom". */
  bgColor: string;
  /** #rrggbb; "" = the page accent. */
  accent: string;
  /** Card details hidden in this section. */
  hide: MetaPart[];
}

export const DEFAULT_LOOK: SectionLook = { background: "", bgColor: "", accent: "", hide: [] };

export const BACKGROUND_LABELS: Record<SectionBackground, string> = {
  "": "Built-in",
  plain: "None (page background)",
  soft: "Light grey box",
  tint: "Accent-tinted box",
  dark: "Dark box",
  custom: "Custom colour box",
};

const BACKGROUNDS = ["", "plain", "soft", "tint", "dark", "custom"] as const;

/* ---------- validation ---------- */

/** "#abc" or "#aabbcc" → "#aabbcc"; anything else → "". */
export function safeColor(value: unknown): string {
  if (typeof value !== "string") return "";
  const v = value.trim().toLowerCase();
  if (/^#[0-9a-f]{6}$/.test(v)) return v;
  if (/^#[0-9a-f]{3}$/.test(v)) return `#${v[1]}${v[1]}${v[2]}${v[2]}${v[3]}${v[3]}`;
  return "";
}

function fontKey(value: unknown, list: FontOption[], fallback: string): string {
  return list.some((f) => f.key === value) ? (value as string) : fallback;
}

function weight(value: unknown): number {
  const n = Number(value);
  return (WEIGHTS as readonly number[]).includes(n) ? n : 0;
}

function size(value: unknown): number {
  const n = Number(value);
  return Number.isFinite(n) ? Math.min(SIZE_RANGE[1], Math.max(SIZE_RANGE[0], Math.round(n))) : 100;
}

export function sanitizeTheme(input: unknown): HomeTheme {
  const raw = (input && typeof input === "object" ? input : {}) as Record<string, unknown>;
  return {
    scope: raw.scope === "site" ? "site" : "home",
    mlHeadingFont: fontKey(raw.mlHeadingFont, ML_FONTS, DEFAULT_THEME.mlHeadingFont),
    mlBodyFont: fontKey(raw.mlBodyFont, ML_FONTS, DEFAULT_THEME.mlBodyFont),
    enHeadingFont: fontKey(raw.enHeadingFont, EN_FONTS, SAME_AS_MALAYALAM),
    enBodyFont: fontKey(raw.enBodyFont, EN_FONTS, SAME_AS_MALAYALAM),
    headingColor: safeColor(raw.headingColor),
    titleColor: safeColor(raw.titleColor),
    textColor: safeColor(raw.textColor),
    accentColor: safeColor(raw.accentColor),
    headingSize: size(raw.headingSize),
    titleSize: size(raw.titleSize),
    textSize: size(raw.textSize),
    headingWeight: weight(raw.headingWeight),
    titleWeight: weight(raw.titleWeight),
    pageBackground: safeColor(raw.pageBackground),
    spacing: raw.spacing === "compact" || raw.spacing === "roomy" ? raw.spacing : "normal",
  };
}

export function sanitizeLook(input: unknown): SectionLook {
  const raw = (input && typeof input === "object" ? input : {}) as Record<string, unknown>;
  const background = BACKGROUNDS.includes(raw.background as SectionBackground) ? (raw.background as SectionBackground) : "";
  const bgColor = safeColor(raw.bgColor);
  const parts = META_PARTS.map((p) => p.key);
  const hide = Array.isArray(raw.hide) ? parts.filter((p) => (raw.hide as unknown[]).includes(p)) : [];
  return { background: background === "custom" && !bgColor ? "" : background, bgColor: background === "custom" ? bgColor : "", accent: safeColor(raw.accent), hide };
}

/* ---------- rendering ---------- */

/** Relative luminance of #rrggbb, 0 (black) … 1 (white). */
function luminance(hex: string): number {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** White text reads better than dark text on this colour. */
export function isDark(hex: string): boolean {
  return safeColor(hex) !== "" && luminance(safeColor(hex)) < 0.22;
}

/** The brand-purple scale Tailwind's purple-* utilities read, rebuilt around one colour. */
export function accentVars(hex: string): Record<string, string> {
  const c = safeColor(hex);
  if (!c) return {};
  const tint = (pct: number) => `color-mix(in srgb, ${c} ${pct}%, white)`;
  return {
    "--color-purple-50": tint(7),
    "--color-purple-100": tint(14),
    "--color-purple-200": tint(28),
    "--color-purple-300": tint(45),
    "--color-purple-500": tint(80),
    "--color-purple-700": c,
    "--color-purple-800": c,
    "--color-purple-900": `color-mix(in srgb, ${c} 80%, black)`,
    "--color-purple-950": `color-mix(in srgb, ${c} 60%, black)`,
    // the hero and side sliders paint their labels and buttons in a fixed violet unless this is set
    "--accent-chip": c,
    "--accent-chip-hover": `color-mix(in srgb, ${c} 85%, black)`,
  };
}

const BOX_BG: Record<"soft" | "tint" | "dark", string> = {
  soft: "#f4f4f5",
  tint: "var(--color-purple-50)",
  dark: "#18181b",
};

/** A section's wrapper: inline style, whether it is a padded box, and whether its text turns light. */
export function lookStyle(look: SectionLook): { style: Record<string, string>; boxed: boolean; dark: boolean } {
  const style: Record<string, string> = { ...accentVars(look.accent) };
  if (look.background === "soft" || look.background === "tint" || look.background === "dark") style.background = BOX_BG[look.background];
  if (look.background === "custom" && look.bgColor) style.background = look.bgColor;
  const boxed = look.background !== "" && look.background !== "plain";
  const dark = look.background === "dark" || (look.background === "custom" && isDark(look.bgColor));
  return { style, boxed, dark };
}

function stack(en: string, ml: string): string {
  const english = EN_FONTS.find((f) => f.key === en);
  const malayalam = ML_FONTS.find((f) => f.key === ml) ?? ML_FONTS[0];
  const parts = [english && `var(${english.cssVar})`, `var(${malayalam.cssVar})`, `var(--font-noto-ml)`, malayalam.serif ? "serif" : "system-ui, sans-serif"];
  return parts.filter(Boolean).join(", ");
}

const rem = (base: number, pct: number) => `${+(base * pct / 100).toFixed(4)}rem`;

/* Tailwind v4 utilities read their sizes and colours from custom properties
   (text-sm → var(--text-sm), text-zinc-900 → var(--color-zinc-900)), so
   re-pointing those properties on the right elements restyles the existing
   markup without touching a component. */
const ZINC = { 900: "oklch(21% 0.006 285.885)", 700: "oklch(37% 0.013 285.805)", 600: "oklch(44.2% 0.017 285.786)", 500: "oklch(55.2% 0.016 285.938)" };

const HEAD = ":is(h2,div.font-display)";
const weightVars = (w: number) => `--font-weight-medium:${w};--font-weight-semibold:${w};--font-weight-bold:${w};--font-weight-extrabold:${w};--font-weight-black:${w}`;

/**
 * The stylesheet for one theme, every selector under `scope`; the page
 * background goes on `page`, and the accent on `accent` (for a site-wide
 * style that is the page content, so the header, footer and phone tab bar keep
 * the brand purple they are painted in). Rules for values left at the default
 * are omitted.
 */
export function themeCss(input: HomeTheme, scope = ".home-theme", page = "body:has(.home-theme)", accent = scope): string {
  const t = sanitizeTheme(input);
  const rules: string[] = [];
  const s = scope;

  if (t.pageBackground) rules.push(`${page}{background-color:${t.pageBackground}}`);
  if (t.mlBodyFont !== DEFAULT_THEME.mlBodyFont || t.enBodyFont) {
    // .pill keeps system-ui: it exists to centre Latin labels (globals.css)
    rules.push(`${s},${s} :is(button,input,select,textarea):not(.pill){font-family:${stack(t.enBodyFont, t.mlBodyFont)}}`);
  }
  if (t.mlHeadingFont !== DEFAULT_THEME.mlHeadingFont || t.enHeadingFont) {
    rules.push(`${s} :is(h1,h2,h3,h4,.font-display){font-family:${stack(t.enHeadingFont, t.mlHeadingFont)}}`);
  }

  // HEAD covers the hero's waiting plates (div.font-display), which must measure exactly like the live h2
  if (t.headingSize !== 100) rules.push(`${s} ${HEAD}{--text-lg:${rem(1.125, t.headingSize)};--text-xl:${rem(1.25, t.headingSize)};--text-2xl:${rem(1.5, t.headingSize)}}`);
  if (t.titleSize !== 100) rules.push(`${s} h3{--text-sm:${rem(0.875, t.titleSize)};--text-base:${rem(1, t.titleSize)};--text-lg:${rem(1.125, t.titleSize)};--text-xl:${rem(1.25, t.titleSize)};--text-2xl:${rem(1.5, t.titleSize)}}`);
  if (t.headingWeight) rules.push(`${s} :is(h1,h2,div.font-display){${weightVars(t.headingWeight)}}`);
  if (t.titleWeight) rules.push(`${s} :is(h3,h4){${weightVars(t.titleWeight)}}`);
  if (t.textSize !== 100) rules.push(`${s} :is(p,time){--text-xs:${rem(0.75, t.textSize)};--text-sm:${rem(0.875, t.textSize)};--text-base:${rem(1, t.textSize)}}`);

  if (t.headingColor) rules.push(`${s} h2{--color-zinc-900:${t.headingColor}}`);
  if (t.titleColor) rules.push(`${s} h3{--color-zinc-900:${t.titleColor}}`);
  if (t.textColor) rules.push(`${s} :is(p,time):not([data-surface=dark] *){--color-zinc-500:${t.textColor};--color-zinc-600:${t.textColor};--color-zinc-700:${t.textColor}}`);
  if (t.accentColor) rules.push(`${accent}{${Object.entries(accentVars(t.accentColor)).map(([k, v]) => `${k}:${v}`).join(";")}}`);

  // a dark section box turns its text light; the white cards inside it keep the page's colours
  rules.push(`${s} [data-tone=dark]{color:#fff}`);
  rules.push(`${s} [data-tone=dark] :is(h2,h3,p,time,button){--color-zinc-900:#fff;--color-zinc-700:#e4e4e7;--color-zinc-600:#d4d4d8;--color-zinc-500:#a1a1aa}`);
  rules.push(`${s} [data-tone=dark] :is(.text-purple-700,.text-purple-800):not(.bg-white *){color:var(--color-purple-300)}`);
  rules.push(`${s} [data-tone=dark] .border-purple-800{border-color:var(--color-purple-300)}`);
  rules.push(`${s} [data-tone=dark] .bg-white{color:${ZINC[900]}}`);
  rules.push(`${s} [data-tone=dark] .bg-white :is(h2,h3,p,time){--color-zinc-900:${t.titleColor || ZINC[900]};--color-zinc-700:${t.textColor || ZINC[700]};--color-zinc-600:${t.textColor || ZINC[600]};--color-zinc-500:${t.textColor || ZINC[500]}}`);
  return rules.join("\n");
}

const GAPS: Record<Exclude<Spacing, "normal">, [string, string]> = { compact: ["1.25rem", "1.75rem"], roomy: ["3rem", "4.5rem"] };

/** The space between homepage sections (phones, then sm and up); nothing for the default. */
export function spacingCss(input: HomeTheme): string {
  const t = sanitizeTheme(input);
  if (t.spacing === "normal") return "";
  const rule = (gap: string) => `.home-theme>:not(:last-child){margin-block-end:${gap}}.home-theme [data-home-block]{row-gap:${gap}}`;
  const [phone, wide] = GAPS[t.spacing];
  return `${rule(phone)}\n@media (min-width:40rem){${rule(wide)}}`;
}
