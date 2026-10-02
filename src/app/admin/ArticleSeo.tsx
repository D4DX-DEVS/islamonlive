"use client";

import { useState } from "react";
import { CardTitle, FieldLabel } from "./form-parts";
import { Icon } from "./icons";
import { cardClass, inputClass } from "./ui";

export const META_DESCRIPTION_GUIDE = 160;

export type SeoFields = { focusKeyword: string; title: string; description: string };

/** English filler that makes a poor keyword; Malayalam titles have none of these. */
const FILLER = new Set(["a", "an", "the", "of", "in", "on", "at", "to", "for", "and", "or", "is", "are", "was", "were", "with", "by", "from", "as"]);

/**
 * Keyword ideas drawn from what the editor has already written: the tags, the
 * category and the opening words of the title. They are starting points, not a
 * keyword-research tool.
 */
export function keywordIdeas(title: string, tags: string[], category: string): string[] {
  const ideas: string[] = [];
  const add = (value: string) => {
    const idea = value.trim();
    if (idea && idea.length <= 80 && !ideas.some((existing) => existing.toLocaleLowerCase() === idea.toLocaleLowerCase())) ideas.push(idea);
  };
  tags.slice(0, 4).forEach(add);
  add(category);
  const words = title.split(/[\s\-–—:;,.!?|"“”'’()]+/).filter((word) => word && !FILLER.has(word.toLocaleLowerCase()));
  if (words.length === 1) add(words[0]);
  if (words.length >= 2) add(words.slice(0, 2).join(" "));
  if (words.length >= 3) add(words.slice(0, 3).join(" "));
  return ideas.slice(0, 6);
}

export default function SeoCard({ values, ideas, onChange }: { values: SeoFields; ideas: string[]; onChange: (patch: Partial<SeoFields>) => void }) {
  const [showIdeas, setShowIdeas] = useState(false);
  return <section className={`${cardClass} space-y-4`}>
    <CardTitle icon="search">SEO settings (Yoast)</CardTitle>
    <div>
      <label className="block"><FieldLabel>Focus keyword</FieldLabel>
        <span className="mt-2 flex flex-col gap-2 sm:flex-row">
          <input className={inputClass} value={values.focusKeyword} onChange={(event) => onChange({ focusKeyword: event.target.value })} placeholder="Enter focus keyword…" />
          <button type="button" aria-expanded={showIdeas} onClick={() => setShowIdeas((current) => !current)} className="flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-xl border border-violet-300 bg-white px-4 text-sm font-semibold text-violet-700 transition hover:bg-violet-50"><Icon name="sparkles" className="h-[18px] w-[18px]" />Get suggestions</button>
        </span>
      </label>
      <p className="mt-1.5 text-xs text-slate-500">Enter the main keyword for this article.</p>
      {showIdeas && <div className="mt-2 rounded-xl bg-violet-50/70 p-3">
        {ideas.length
          ? <><p className="text-xs font-semibold text-violet-800">Ideas from your title, tags and category — pick one:</p><div className="mt-2 flex flex-wrap gap-1.5">{ideas.map((idea) => <button type="button" key={idea} onClick={() => { onChange({ focusKeyword: idea }); setShowIdeas(false); }} className="rounded-lg border border-violet-200 bg-white px-2.5 py-1 text-sm text-violet-800 transition hover:bg-violet-100">{idea}</button>)}</div></>
          : <p className="text-xs text-violet-800">Write a title, add tags or choose a category first, and ideas will appear here.</p>}
      </div>}
    </div>
    <div className="grid gap-4 md:grid-cols-2">
      <label className="block"><FieldLabel>SEO title</FieldLabel>
        <input className={`${inputClass} mt-2`} value={values.title} onChange={(event) => onChange({ title: event.target.value })} placeholder="Enter SEO title (optional)…" />
        <span className="mt-1.5 block text-xs text-slate-500">Leave empty to use the post title.</span>
      </label>
      <label className="block"><FieldLabel>Meta description</FieldLabel>
        <span className="relative mt-2 block">
          <textarea className={`${inputClass} min-h-24 pb-8`} value={values.description} onChange={(event) => onChange({ description: event.target.value })} placeholder="Enter meta description (optional)…" />
          <span className={`pointer-events-none absolute bottom-2.5 right-3.5 text-xs ${values.description.length > META_DESCRIPTION_GUIDE ? "text-amber-600" : "text-slate-500"}`}>{values.description.length}/{META_DESCRIPTION_GUIDE}</span>
        </span>
        <span className="mt-1.5 block text-xs text-slate-500">Write a short meta description for search engines.</span>
      </label>
    </div>
  </section>;
}
