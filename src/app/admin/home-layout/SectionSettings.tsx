"use client";

/* eslint-disable @next/next/no-img-element -- previews an address the admin typed, on any host */

import { useState } from "react";
import { Select } from "../Select";
import { Icon } from "../icons";
import type { Category } from "../ui";
import { ARRANGEABLE, MAX_COLUMNS, SHAPEABLE, SHAPE_LABELS, STYLE_LABELS, safeHref, type CustomSection, type HomeSection, type ImageShape, type PhoneLayout, type Placement, type PostStyle, type PostsSection, type SectionTab, type Visibility } from "@/lib/home-layout/schema";
import { BACKGROUND_LABELS, type SectionBackground, type SectionLook } from "@/lib/home-layout/theme";
import { CategoryPicker, ColorField, Field, NumberInput, TagPicker, TextInput, iconButton } from "./parts";
import { BannersEditor, CardDetails, CustomFields, ImageUpload, ScheduleFields } from "./SectionExtras";

/* The builder's right-hand panel for the selected section. Every change goes
   straight to the draft (and from there to the preview); there is no "Apply". */

const PLACEMENTS: { value: Placement; label: string }[] = [
  { value: "full", label: "Full width" },
  { value: "main", label: "Main column (wide, left)" },
  { value: "side", label: "Sidebar (narrow, right)" },
];
const VISIBILITIES: { value: Visibility; label: string }[] = [
  { value: "all", label: "Phones and computers" },
  { value: "desktop", label: "Computers only" },
  { value: "mobile", label: "Phones and tablets only" },
];

// Radix Select reserves "", so the built-in background and the style's own shape travel as these values in the menus
const BUILT_IN = "builtin";
const OWN_SHAPE = "own";

function LookFields({ section, pageAccent, set }: { section: HomeSection; pageAccent: string; set: (look: SectionLook) => void }) {
  const look = section.look;
  // the video panel's text is white, so it only offers dark boxes; sections without a box of their own have no "None"
  const allowed: SectionBackground[] = section.kind === "watch" ? ["", "dark", "custom"] : section.kind === "reels" ? ["", "plain", "soft", "tint", "dark", "custom"] : ["", "soft", "tint", "dark", "custom"];
  const label = (b: SectionBackground) => (b === "" ? (section.kind === "reels" ? "Built-in (light grey box)" : section.kind === "watch" ? "Built-in (dark panel)" : "None") : BACKGROUND_LABELS[b]);
  return <Group title="Look">
    <Field label="Background">
      <Select label="Background" value={look.background || BUILT_IN} onChange={(v) => { const background = (v === BUILT_IN ? "" : v) as SectionBackground; set({ ...look, background, bgColor: background === "custom" ? look.bgColor || (section.kind === "watch" ? "#1e1b4b" : "#f5f3ff") : "" }); }} options={allowed.map((b) => ({ value: b || BUILT_IN, label: label(b) }))} />
    </Field>
    {look.background === "custom" && <ColorField label="Box colour" value={look.bgColor} fallback="#f5f3ff" onChange={(bgColor) => set({ ...look, bgColor: bgColor || look.bgColor })} hint={section.kind === "watch" ? "Pick a dark colour: the video titles stay white." : "Text turns white by itself on a dark colour."} />}
    <ColorField label="Accent colour" value={look.accent} fallback={pageAccent || "#6b21a8"} onChange={(accent) => set({ ...look, accent })} hint="Heading bar, “See all” and labels in this section only. Empty = the page accent (Fonts & colours tab)." />
    {(section.kind === "posts" || section.kind === "hero") && <CardDetails hide={look.hide} onChange={(hide) => set({ ...look, hide })} />}
  </Group>;
}

function Group({ title, children }: { title: string; children: React.ReactNode }) {
  return <section className="space-y-4 border-t border-slate-100 px-4 py-4 first:border-t-0">
    <h3 className="text-[11px] font-bold uppercase tracking-[0.14em] text-slate-400">{title}</h3>
    {children}
  </section>;
}

function TabsEditor({ tabs, categories, onChange }: { tabs: SectionTab[]; categories: Category[]; onChange: (tabs: SectionTab[]) => void }) {
  const [picking, setPicking] = useState<number[]>([]);
  const nameOf = (id: number) => categories.find((c) => c.id === id)?.name ?? `#${id}`;
  const move = (from: number, to: number) => { const next = [...tabs]; const [item] = next.splice(from, 1); next.splice(to, 0, item); onChange(next); };
  return <div className="space-y-2">
    {tabs.length === 0 && <p className="text-xs text-slate-500">No extra tabs: readers see the &ldquo;All&rdquo; list only.</p>}
    {tabs.map((tab, index) => <div key={`${tab.categoryId}-${index}`} className="rounded-xl border border-slate-200 p-2">
      <div className="flex items-center gap-1">
        <input aria-label={`Tab ${index + 1} label`} value={tab.label} onChange={(event) => onChange(tabs.map((t, i) => (i === index ? { ...t, label: event.target.value } : t)))} className="min-h-10 min-w-0 flex-1 rounded-lg border border-slate-200 px-3 text-sm focus-visible:border-violet-500 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-violet-100" />
        <button type="button" aria-label="Move tab up" disabled={index === 0} onClick={() => move(index, index - 1)} className={iconButton}><Icon name="arrowUp" className="h-4 w-4" /></button>
        <button type="button" aria-label="Move tab down" disabled={index === tabs.length - 1} onClick={() => move(index, index + 1)} className={iconButton}><Icon name="arrowUp" className="h-4 w-4 rotate-180" /></button>
        <button type="button" aria-label={`Remove tab ${tab.label}`} onClick={() => onChange(tabs.filter((_, i) => i !== index))} className={`${iconButton} hover:text-red-600`}><Icon name="trash" className="h-4 w-4" /></button>
      </div>
      <p className="mt-1 truncate px-1 text-[11px] text-slate-400">Category: {nameOf(tab.categoryId)}</p>
    </div>)}
    {tabs.length < 8 && <div className="rounded-xl border border-dashed border-slate-300 p-3">
      <p className="mb-2 text-xs font-semibold text-slate-600">Add a tab</p>
      <CategoryPicker categories={categories} value={picking} single onChange={(ids) => { if (ids[0]) onChange([...tabs, { label: nameOf(ids[0]), categoryId: ids[0] }]); setPicking([]); }} />
    </div>}
  </div>;
}

function PostsFields({ section, categories, set }: { section: PostsSection; categories: Category[]; set: (patch: Partial<PostsSection>) => void }) {
  const source = section.tagId ? "tag" : section.categoryIds.length ? "categories" : "latest";
  const withTabs = section.style === "tabbed" || section.style === "compact_tabs";
  return <>
    <Group title="Design">
      <Field label="Layout style"><Select label="Layout style" value={section.style} onChange={(style) => set({ style: style as PostStyle, phoneLayout: style === "portrait_grid" || style === "slider" ? "row" : "stack" })} options={Object.entries(STYLE_LABELS).map(([value, label]) => ({ value, label }))} /></Field>
      <Field label={section.style === "compact_tabs" ? "Rows per tab" : "Number of articles"} hint="1–24"><NumberInput value={section.count} min={1} max={24} onChange={(count) => set({ count })} /></Field>
      {ARRANGEABLE.includes(section.style) && section.placement !== "side" && <Field label="Per row on computers" hint={section.style === "list" ? "1 = a single list, one under another." : "Automatic fits the width: 4 full width, 3 in the main column, 5 portrait tiles."}>
        <Select label="Per row on computers" value={String(section.columns)} onChange={(v) => set({ columns: Number(v) })} options={[{ value: "0", label: section.style === "list" ? "1 (one under another)" : "Automatic" }, ...Array.from({ length: MAX_COLUMNS }, (_, i) => ({ value: String(i + 1), label: String(i + 1) })).filter((o) => section.style !== "list" || o.value !== "1")]} />
      </Field>}
      {SHAPEABLE.includes(section.style) && <Field label="Picture shape">
        <Select label="Picture shape" value={section.imageShape || OWN_SHAPE} onChange={(v) => set({ imageShape: (v === OWN_SHAPE ? "" : v) as ImageShape })} options={Object.entries(SHAPE_LABELS).map(([value, label]) => ({ value: value || OWN_SHAPE, label }))} />
      </Field>}
      {(section.style === "grid" || section.style === "portrait_grid") && <Field label="On phones">
        <Select label="On phones" value={section.phoneLayout} onChange={(v) => set({ phoneLayout: v as PhoneLayout })} options={[{ value: "stack", label: section.style === "grid" ? "One under another" : "Two per row, stacked" }, { value: "row", label: "One row, swipes sideways" }]} />
      </Field>}
    </Group>
    <Group title="Content">
      <Field label="Articles from">
        <Select label="Articles from" value={source} onChange={(next) => set(next === "latest" ? { tagId: null, categoryIds: [] } : next === "tag" ? { categoryIds: [] } : { tagId: null })} options={[{ value: "categories", label: "Categories (incl. sub-categories)" }, { value: "tag", label: "A tag (e.g. Editor's Picks)" }, { value: "latest", label: "Latest articles, any category" }]} />
      </Field>
      {source === "categories" && <Field label="Categories"><CategoryPicker categories={categories} value={section.categoryIds} onChange={(categoryIds) => set({ categoryIds })} /></Field>}
      {source === "tag" && <Field label="Tag"><TagPicker value={section.tagId} onChange={(tagId) => set({ tagId })} /></Field>}
      {source === "categories" && section.categoryIds.length === 0 && <p className="text-xs text-amber-700">Pick at least one category, or switch to latest articles.</p>}
    </Group>
    {withTabs && <Group title="Tabs after “All”"><TabsEditor tabs={section.tabs} categories={categories} onChange={(tabs) => set({ tabs })} /></Group>}
  </>;
}

export default function SectionSettings({ section, categories, pageAccent, onChange }: { section: HomeSection; categories: Category[]; /** The page style's accent, shown while the section has none of its own. */ pageAccent: string; onChange: (section: HomeSection) => void }) {
  const set = (patch: Partial<HomeSection>) => onChange({ ...section, ...patch } as HomeSection);
  const titled = "title" in section;
  // the sections with a "See all" link (an image banner's link is its click target, set below)
  const linked = section.kind === "reels" || section.kind === "watch" || section.kind === "listen" || section.kind === "posts" ? section : null;
  const badLink = "href" in section && section.href !== "" && safeHref(section.href) === "";

  return <div>
    {(titled || linked) && <Group title="Heading">
      {titled && <Field label="Heading" hint="Empty = no heading."><TextInput value={section.title} onChange={(title) => set({ title })} /></Field>}
      {linked && <Field label="“See all” link" hint={linked.kind === "posts" ? "A path like /category/opinion, or https://… Empty = the first category's page." : "A path like /reels, or https://… Empty = no link."}><TextInput value={linked.href} onChange={(href) => set({ href })} placeholder="/category/…" /></Field>}
      {linked && <Field label="Link text" hint="Empty = “See all”. An arrow is added after it."><TextInput value={linked.linkLabel} onChange={(linkLabel) => set({ linkLabel })} placeholder="See all" /></Field>}
      {badLink && <p role="alert" className="text-xs font-medium text-red-700">Links must start with / or https:// — this one will be dropped.</p>}
    </Group>}

    {section.kind === "hero" && <>
      <Group title="Content">
        <Field label="Stories from" hint="Newest articles of these categories. Empty = newest site-wide."><CategoryPicker categories={categories} value={section.categoryIds} onChange={(categoryIds) => set({ categoryIds })} /></Field>
      </Group>
      <Group title="Design">
        <Field label="Slides in the big slider" hint="1–8"><NumberInput value={section.mainCount} min={1} max={8} onChange={(mainCount) => set({ mainCount })} /></Field>
        <Field label="Stories per side card" hint="0 hides the two side cards"><NumberInput value={section.sideCount} min={0} max={4} onChange={(sideCount) => set({ sideCount })} /></Field>
      </Group>
    </>}
    {(section.kind === "reels" || section.kind === "watch") && <Group title="Content"><Field label="How many to show" hint={section.kind === "reels" ? "1–12" : "1–10"}><NumberInput value={section.count} min={1} max={section.kind === "reels" ? 12 : 10} onChange={(count) => set({ count })} /></Field></Group>}
    {section.kind === "listen" && <Group title="Content"><Field label="Episodes per page" hint="1–20"><NumberInput value={section.perPage} min={1} max={20} onChange={(perPage) => set({ perPage })} /></Field></Group>}
    {section.kind === "banners" && <Group title="Banners"><BannersEditor items={section.items} onChange={(items) => set({ items })} /></Group>}
    {section.kind === "custom" && <Group title="Content">
      <CustomFields section={section} set={(patch) => set(patch)} />
      <Field label="Alignment"><Select label="Alignment" value={section.align} onChange={(align) => set({ align: align as CustomSection["align"] })} options={[{ value: "left", label: "Left, with the heading bar" }, { value: "center", label: "Centred" }]} /></Field>
    </Group>}
    {section.kind === "image" && <Group title="Image">
      <ImageUpload alt={section.alt} onUploaded={(media) => set({ img: media.url, width: media.width ?? section.width, height: media.height ?? section.height })} />
      <Field label="Image address" hint="Filled in by the upload, or paste an https:// link."><TextInput value={section.img} onChange={(img) => set({ img })} placeholder="https://…" /></Field>
      {section.img && safeHref(section.img) ? <div className="overflow-hidden rounded-xl border border-slate-200"><img src={section.img} alt="" className="h-auto w-full" /></div> : <p className="text-xs text-amber-700">Add an image address that starts with https://.</p>}
      <Field label="Opens when clicked" hint="Optional."><TextInput value={section.href} onChange={(href) => set({ href })} placeholder="/support-us" /></Field>
      {badLink && <p role="alert" className="text-xs font-medium text-red-700">Links must start with / or https://.</p>}
      <Field label="Description for screen readers"><TextInput value={section.alt} onChange={(alt) => set({ alt })} /></Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Width (px)"><NumberInput value={section.width} min={50} max={4000} onChange={(width) => set({ width })} /></Field>
        <Field label="Height (px)"><NumberInput value={section.height} min={20} max={4000} onChange={(height) => set({ height })} /></Field>
      </div>
    </Group>}
    {section.kind === "posts" && <PostsFields section={section} categories={categories} set={(patch) => set(patch)} />}

    <LookFields section={section} pageAccent={pageAccent} set={(look) => set({ look })} />

    <Group title="Schedule"><ScheduleFields section={section} set={set} /></Group>

    <Group title="Placement">
      <Field label="Position">{section.kind === "hero" ? <p className="text-sm text-slate-500">Always full width</p> : <Select label="Position" value={section.placement} onChange={(placement) => set({ placement: placement as Placement })} options={PLACEMENTS} />}</Field>
      <Field label="Show on"><Select label="Show on" value={section.visibility} onChange={(visibility) => set({ visibility: visibility as Visibility })} options={VISIBILITIES} /></Field>
      <p className="text-xs leading-relaxed text-slate-500">Full width puts the section on its own row, one after another down the page. Main column and sidebar put two sections side by side.</p>
      {section.placement !== "full" && <p className="text-xs leading-relaxed text-slate-500">Main-column and sidebar sections sit side by side on computers. A new row starts when a main-column section follows a sidebar one. On phones the main column comes first.</p>}
      <p className="text-xs leading-relaxed text-slate-500">To put a section somewhere else on phones, duplicate it, set this one to “Computers only” and the copy to “Phones and tablets only”, then drag the copy where phones should see it.</p>
    </Group>
  </div>;
}
