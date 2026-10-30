"use client";

import { blankSection, type HomeSection, type PostStyle } from "@/lib/home-layout/schema";
import { Dialog, secondaryButton } from "./parts";

/* The "Add section" gallery: a picture of each kind of block, the way page
   builders offer them, so the choice is made by looking rather than reading. */

type Thumb = "grid" | "tabbed" | "featured" | "topics" | "slider" | "tiles" | "image" | "hero" | "reels" | "watch" | "listen" | "banners" | "custom";

interface Preset {
  key: string;
  label: string;
  hint: string;
  thumb: Thumb;
  make: () => HomeSection;
}

function posts(style: PostStyle, placement: HomeSection["placement"], title: string, count: number): () => HomeSection {
  return () => ({ ...blankSection("posts"), style, placement, title, count } as HomeSection);
}

const GROUPS: { title: string; presets: Preset[] }[] = [
  {
    title: "Article lists",
    presets: [
      { key: "grid", label: "Card grid", hint: "Image cards in rows", thumb: "grid", make: posts("grid", "full", "New section", 8) },
      { key: "tabbed", label: "Tabbed list", hint: "Big card, list and topic tabs", thumb: "tabbed", make: posts("tabbed", "main", "New section", 5) },
      { key: "featured", label: "Featured list", hint: "One big card over a list — sidebar", thumb: "featured", make: posts("featured_list", "side", "New section", 5) },
      { key: "topics", label: "Topic list", hint: "Compact list with a topic menu — sidebar", thumb: "topics", make: posts("compact_tabs", "side", "New section", 4) },
      { key: "slider", label: "Card slider", hint: "Swipeable row of cards", thumb: "slider", make: posts("slider", "full", "New section", 6) },
      { key: "tiles", label: "Portrait tiles", hint: "Tall tiles, like Infographics", thumb: "tiles", make: posts("portrait_grid", "full", "New section", 6) },
    ],
  },
  {
    title: "Media and promotion",
    presets: [
      { key: "hero", label: "Hero slider", hint: "Rotating top stories", thumb: "hero", make: () => blankSection("hero") },
      { key: "image", label: "Image banner", hint: "One linked picture", thumb: "image", make: () => blankSection("image") },
      { key: "banners", label: "Promo banners", hint: "Linked pictures, one under another", thumb: "banners", make: () => blankSection("banners") },
      { key: "custom", label: "Text & embed", hint: "Words, a button, a video, form or map", thumb: "custom", make: () => blankSection("custom") },
      { key: "reels", label: "Reels", hint: "Instagram reels", thumb: "reels", make: () => blankSection("reels") },
      { key: "watch", label: "Watch", hint: "YouTube player + list", thumb: "watch", make: () => blankSection("watch") },
      { key: "listen", label: "Listen", hint: "Podcast player", thumb: "listen", make: () => blankSection("listen") },
    ],
  },
];

/** A schematic of the block: violet = images, grey = text. */
export function SectionThumb({ kind, className = "" }: { kind: Thumb; className?: string }) {
  const img = "#c4b5fd";
  const dark = "#7c3aed";
  const line = "#cbd5e1";
  const shapes: Record<Thumb, React.ReactNode> = {
    grid: <>{[0, 1, 2, 3].map((i) => <g key={i}><rect x={6 + i * 28} y="12" width="24" height="18" rx="3" fill={img} /><rect x={6 + i * 28} y="34" width="20" height="3" rx="1.5" fill={line} /></g>)}{[0, 1, 2, 3].map((i) => <rect key={`b${i}`} x={6 + i * 28} y="44" width="24" height="18" rx="3" fill={img} opacity=".6" />)}</>,
    tabbed: <><rect x="6" y="8" width="16" height="5" rx="2.5" fill={dark} />{[0, 1, 2].map((i) => <rect key={i} x={26 + i * 18} y="8" width="14" height="5" rx="2.5" fill={line} />)}<rect x="6" y="18" width="52" height="44" rx="4" fill={img} /><rect x="64" y="18" width="52" height="20" rx="3" fill="#ede9fe" /><rect x="64" y="42" width="52" height="3" rx="1.5" fill={line} /><rect x="64" y="49" width="40" height="3" rx="1.5" fill={line} /><rect x="64" y="56" width="46" height="3" rx="1.5" fill={line} /></>,
    featured: <><rect x="34" y="6" width="54" height="26" rx="4" fill={img} />{[0, 1, 2].map((i) => <g key={i}><rect x="34" y={36 + i * 10} width="12" height="7" rx="2" fill={img} opacity=".7" /><rect x="50" y={38 + i * 10} width="38" height="3" rx="1.5" fill={line} /></g>)}</>,
    topics: <><rect x="34" y="6" width="40" height="5" rx="2.5" fill={line} /><circle cx="84" cy="8.5" r="2.5" fill={dark} /><rect x="34" y="16" width="54" height="20" rx="4" fill={img} />{[0, 1, 2].map((i) => <g key={i}><rect x="34" y={40 + i * 9} width="10" height="6" rx="2" fill={img} opacity=".7" /><rect x="48" y={41.5 + i * 9} width="40" height="3" rx="1.5" fill={line} /></g>)}</>,
    slider: <>{[0, 1, 2, 3].map((i) => <rect key={i} x={6 + i * 34} y="14" width="30" height="40" rx="4" fill={img} opacity={i === 3 ? 0.4 : 1} />)}<circle cx="114" cy="34" r="5" fill="#fff" stroke={dark} /></>,
    tiles: <>{[0, 1, 2, 3, 4].map((i) => <g key={i}><rect x={6 + i * 22} y="8" width="18" height="40" rx="3" fill={img} /><rect x={6 + i * 22} y="52" width="16" height="3" rx="1.5" fill={line} /></g>)}</>,
    image: <><rect x="6" y="22" width="110" height="26" rx="5" fill={img} /><path d="M18 42l12-10 10 8 8-5 14 7" stroke="#fff" strokeWidth="2.5" fill="none" strokeLinecap="round" /></>,
    hero: <><rect x="6" y="8" width="70" height="54" rx="4" fill={img} /><rect x="14" y="44" width="54" height="12" rx="3" fill="#fff" /><rect x="80" y="8" width="36" height="25" rx="4" fill={img} opacity=".8" /><rect x="80" y="37" width="36" height="25" rx="4" fill={img} opacity=".6" /></>,
    reels: <>{[0, 1, 2, 3, 4].map((i) => <g key={i}><rect x={6 + i * 22} y="10" width="18" height="50" rx="3" fill={img} /><path d={`M${13 + i * 22} 31l6 4-6 4z`} fill="#fff" /></g>)}</>,
    watch: <><rect x="4" y="6" width="114" height="58" rx="5" fill="#27272a" /><rect x="10" y="12" width="66" height="40" rx="3" fill={dark} /><path d="M39 27l10 6-10 6z" fill="#fff" />{[0, 1, 2].map((i) => <rect key={i} x="82" y={14 + i * 13} width="30" height="9" rx="2" fill="#52525b" />)}</>,
    listen: <><rect x="6" y="8" width="110" height="54" rx="5" fill="#4c1d95" /><rect x="14" y="16" width="20" height="20" rx="3" fill={img} /><rect x="40" y="20" width="50" height="4" rx="2" fill="#ddd6fe" /><rect x="14" y="44" width="94" height="3" rx="1.5" fill="#7c3aed" /><circle cx="61" cy="54" r="4" fill="#22c55e" /></>,
    banners: <><rect x="6" y="26" width="110" height="18" rx="4" fill={img} /><rect x="14" y="32" width="40" height="6" rx="3" fill="#fff" /></>,
    custom: <><rect x="6" y="8" width="3" height="10" rx="1.5" fill={dark} /><rect x="13" y="10" width="40" height="5" rx="2.5" fill={line} />{[0, 1].map((i) => <rect key={i} x="6" y={24 + i * 7} width={i ? 80 : 110} height="3" rx="1.5" fill={line} />)}<rect x="6" y="42" width="30" height="10" rx="5" fill={dark} /><rect x="44" y="40" width="72" height="24" rx="4" fill={img} /><path d="M76 47l8 5-8 5z" fill="#fff" /></>,
  };
  return <svg viewBox="0 0 122 70" aria-hidden className={className}>{shapes[kind]}</svg>;
}

export default function AddSectionDialog({ onAdd, onClose, after }: { onAdd: (section: HomeSection) => void; onClose: () => void; /** Name of the section the new one goes after, if any. */ after: string | null }) {
  return <Dialog wide title="Add a section" onClose={onClose} footer={<button type="button" onClick={onClose} className={secondaryButton}>Cancel</button>}>
    <p className="text-sm text-slate-500">{after ? <>It goes after <span className="font-semibold text-slate-800">{after}</span>. You can drag it anywhere afterwards.</> : "It goes at the end of the page. You can drag it anywhere afterwards."}</p>
    {GROUPS.map((group) => <section key={group.title}>
      <h3 className="mb-2 text-[11px] font-bold uppercase tracking-[0.14em] text-slate-400">{group.title}</h3>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {group.presets.map((preset) => <button key={preset.key} type="button" onClick={() => onAdd(preset.make())} className="group rounded-xl border border-slate-200 bg-white p-2 text-left transition hover:-translate-y-0.5 hover:border-violet-400 hover:shadow-[0_10px_24px_-14px_rgba(76,29,149,0.5)] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-violet-100">
          <span className="block rounded-lg bg-slate-50 p-2 transition group-hover:bg-violet-50/60"><SectionThumb kind={preset.thumb} className="h-auto w-full" /></span>
          <span className="mt-2 block px-1 text-sm font-semibold text-[#12093a]">{preset.label}</span>
          <span className="block px-1 pb-1 text-xs leading-snug text-slate-500">{preset.hint}</span>
        </button>)}
      </div>
    </section>)}
  </Dialog>;
}
