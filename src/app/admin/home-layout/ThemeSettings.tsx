"use client";

import { Select } from "../Select";
import { ColorField, Field } from "./parts";
import { DEFAULT_THEME, EN_FONTS, ML_FONTS, SAME_AS_MALAYALAM, WEIGHTS, type FontOption, type HomeTheme, type Spacing, type ThemeScope } from "@/lib/home-layout/theme";

/* The builder's "Fonts & colours" tab: fonts (Malayalam and English, for headings and for
   body text), text colours, sizes and weights, the page background and the
   space between sections, for the homepage or for every page. Like section
   edits, every change goes to the draft and the preview at once; readers see
   it when the page is published. */

const SAMPLE_ML = "ഇസ്‌ലാം ഓൺലൈൻ";
const SAMPLE_EN = "Islamonlive";
// Radix Select reserves "", so "same as Malayalam" travels as this value in the menu
const SAME = "same";

const SIZES = [80, 90, 100, 110, 120, 130, 140, 150].map((n) => ({ value: String(n), label: n === 100 ? "100% (default)" : `${n}%` }));
const WEIGHT_NAMES: Record<number, string> = { 400: "Regular", 500: "Medium", 600: "Semi-bold", 700: "Bold", 800: "Extra bold", 900: "Black" };
const WEIGHT_OPTIONS = [{ value: "0", label: "As designed" }, ...WEIGHTS.map((w) => ({ value: String(w), label: `${WEIGHT_NAMES[w]} (${w})` }))];
const SPACINGS: { value: Spacing; label: string }[] = [{ value: "compact", label: "Compact" }, { value: "normal", label: "Normal (default)" }, { value: "roomy", label: "Roomy" }];

function familyOf(list: FontOption[], key: string): string | undefined {
  const font = list.find((f) => f.key === key);
  return font && `var(${font.cssVar})`;
}

function Group({ title, children }: { title: string; children: React.ReactNode }) {
  return <section className="space-y-4 border-t border-slate-100 py-4 first:border-t-0 first:pt-0">
    <h3 className="text-[11px] font-bold uppercase tracking-[0.14em] text-slate-400">{title}</h3>
    {children}
  </section>;
}

/** The two fonts of one role, rendered together as readers will see them. */
function Sample({ ml, en, heading }: { ml: string; en: string; heading: boolean }) {
  const family = [familyOf(EN_FONTS, en), familyOf(ML_FONTS, ml), "system-ui", "sans-serif"].filter(Boolean).join(", ");
  return <p style={{ fontFamily: family }} className={`rounded-lg bg-slate-50 px-3 py-2 text-slate-900 ${heading ? "text-lg font-bold" : "text-sm"}`}>{SAMPLE_ML} · {SAMPLE_EN}</p>;
}

export default function ThemeSettings({ theme, onChange }: { theme: HomeTheme; onChange: (theme: HomeTheme, key: string) => void }) {
  const set = <K extends keyof HomeTheme>(key: K, value: HomeTheme[K]) => onChange({ ...theme, [key]: value }, `theme:${key}`);
  const ml = ML_FONTS.map((f) => ({ value: f.key, label: f.label }));
  const en = [{ value: SAME, label: "Same as the Malayalam font" }, ...EN_FONTS.map((f) => ({ value: f.key, label: f.label }))];
  const changed = JSON.stringify(theme) !== JSON.stringify(DEFAULT_THEME);

  return <div>
    <Group title="Applies to">
      <Field label="Use this style on" hint={theme.scope === "site" ? "Header, menu, footer, article and category pages too. Article text keeps each reader's own font choice (the Aa button). Other pages update within a couple of minutes of publishing." : "The header, footer and article pages keep the site's normal style."}>
        <Select label="Use this style on" value={theme.scope} onChange={(v) => set("scope", v as ThemeScope)} options={[{ value: "home", label: "The homepage only" }, { value: "site", label: "Every page of the site" }]} />
      </Field>
    </Group>

    <Group title="Headings and headlines">
      <Field label="Malayalam font"><Select label="Malayalam heading font" value={theme.mlHeadingFont} onChange={(v) => set("mlHeadingFont", v)} options={ml} /></Field>
      <Field label="English font" hint="Used for English letters; Malayalam letters always use the Malayalam font."><Select label="English heading font" value={theme.enHeadingFont || SAME} onChange={(v) => set("enHeadingFont", v === SAME ? SAME_AS_MALAYALAM : v)} options={en} /></Field>
      <Sample ml={theme.mlHeadingFont} en={theme.enHeadingFont} heading />
      <div className="space-y-4">
        <Field label="Section heading weight"><Select label="Section heading weight" value={String(theme.headingWeight)} onChange={(v) => set("headingWeight", Number(v))} options={WEIGHT_OPTIONS} /></Field>
        <Field label="Headline weight"><Select label="Headline weight" value={String(theme.titleWeight)} onChange={(v) => set("titleWeight", Number(v))} options={WEIGHT_OPTIONS} /></Field>
      </div>
      <p className="text-xs text-slate-500">Manjari and Gayathri come in regular and bold only, Chilanka in regular: other weights show the nearest one.</p>
    </Group>

    <Group title="Body text">
      <Field label="Malayalam font"><Select label="Malayalam body font" value={theme.mlBodyFont} onChange={(v) => set("mlBodyFont", v)} options={ml} /></Field>
      <Field label="English font"><Select label="English body font" value={theme.enBodyFont || SAME} onChange={(v) => set("enBodyFont", v === SAME ? SAME_AS_MALAYALAM : v)} options={en} /></Field>
      <Sample ml={theme.mlBodyFont} en={theme.enBodyFont} heading={false} />
    </Group>

    <Group title="Text size">
      <Field label="Section headings" hint="“Shari'ah”, “Opinion”…"><Select label="Section heading size" value={String(theme.headingSize)} onChange={(v) => set("headingSize", Number(v))} options={SIZES} /></Field>
      <Field label="Article headlines"><Select label="Article headline size" value={String(theme.titleSize)} onChange={(v) => set("titleSize", Number(v))} options={SIZES} /></Field>
      <Field label="Summaries, names and dates"><Select label="Small text size" value={String(theme.textSize)} onChange={(v) => set("textSize", Number(v))} options={SIZES} /></Field>
    </Group>

    <Group title="Page">
      <ColorField label="Page background" value={theme.pageBackground} fallback="#fafafa" onChange={(v) => set("pageBackground", v)} hint="Behind the sections. Keep it light: cards and text are designed for a light page." />
      <Field label="Space between sections"><Select label="Space between sections" value={theme.spacing} onChange={(v) => set("spacing", v as Spacing)} options={SPACINGS} /></Field>
    </Group>

    <Group title="Colours">
      <ColorField label="Section headings" value={theme.headingColor} fallback="#18181b" onChange={(v) => set("headingColor", v)} />
      <ColorField label="Article headlines" value={theme.titleColor} fallback="#18181b" onChange={(v) => set("titleColor", v)} hint="On light backgrounds. Headlines over pictures stay white." />
      <ColorField label="Summaries, names and dates" value={theme.textColor} fallback="#71717a" onChange={(v) => set("textColor", v)} />
      <ColorField label="Accent" value={theme.accentColor} fallback="#6b21a8" onChange={(v) => set("accentColor", v)} hint={theme.scope === "site" ? "Heading bars, “See all” links, category labels, hover colour. The header, footer and phone menu keep the brand purple." : "Heading bars, “See all” links, category labels, hover colour."} />
    </Group>

    {changed && <button type="button" onClick={() => onChange(DEFAULT_THEME, "theme:reset")} className="mt-2 min-h-11 w-full rounded-xl border border-slate-200 text-sm font-semibold text-slate-700 hover:bg-slate-50">Back to the site&apos;s default style</button>}
  </div>;
}
