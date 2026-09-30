"use client";

import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";

type Tab = "overview" | "articles" | "new" | "edit" | "authors";
type Author = { id: number; name: string; slug?: string; description?: string; email?: string; roles?: string[] };
type Category = { id: number; name: string; count: number };
type Post = { id: number; date: string; date_gmt?: string; modified?: string; status?: string; link?: string; title: { rendered: string; raw?: string }; content?: { rendered: string; raw?: string }; excerpt?: { rendered: string; raw?: string }; author?: number; categories?: number[]; featured_media?: number; _embedded?: { author?: Author[]; "wp:featuredmedia"?: { id?: number; source_url: string; alt_text?: string }[]; "wp:term"?: { id: number; name: string }[][] } };
type Summary = { views: number; uniqueReaders: number; averageReadingSeconds: number; completionRate: number; daily: { date: string; views: number; readers: number }[]; topArticles: { articleId: number; title: string; path: string; views: number; readers: number; averageReadingSeconds: number; completionRate: number; publishedAt?: string | null }[] };

const inputClass = "flex min-h-11 w-full rounded-md border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus-visible:border-violet-500 focus-visible:ring-2 focus-visible:ring-violet-100";
const cardClass = "rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6";
const skeletonClass = "animate-pulse rounded-md bg-slate-200/80";

function Skeleton({ className = "" }: { className?: string }) {
  return <span aria-hidden className={`${skeletonClass} block ${className}`} />;
}

function OverviewSkeleton() {
  return <div aria-busy="true" aria-label="Loading analytics" className="space-y-5 sm:space-y-6">
    <div className="flex flex-wrap items-end justify-between gap-3"><div className="space-y-2"><Skeleton className="h-3 w-24" /><Skeleton className="h-9 w-56" /><Skeleton className="h-4 w-72 max-w-full" /></div><Skeleton className="h-11 w-24" /></div>
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{Array.from({ length: 4 }, (_, index) => <div className={cardClass} key={index}><Skeleton className="h-4 w-24" /><Skeleton className="mt-3 h-9 w-20" /></div>)}</div>
    <div className="grid gap-5 xl:grid-cols-[1.2fr_1fr]"><section className={cardClass}><Skeleton className="h-6 w-32" /><div className="mt-5 space-y-4">{Array.from({ length: 7 }, (_, index) => <div className="grid grid-cols-[56px_1fr_40px] items-center gap-2 sm:grid-cols-[72px_1fr_48px] sm:gap-3" key={index}><Skeleton className="h-4 w-12" /><Skeleton className="h-2 w-full" /><Skeleton className="ml-auto h-4 w-6" /></div>)}</div></section><section className={cardClass}><Skeleton className="h-6 w-32" /><div className="mt-5 space-y-4">{Array.from({ length: 4 }, (_, index) => <div className="space-y-2" key={index}><Skeleton className="h-5 w-4/5" /><Skeleton className="h-3 w-3/5" /></div>)}</div></section></div>
  </div>;
}

function ArticleListSkeleton() {
  return <div aria-busy="true" aria-label="Loading articles">
    <div className="mt-4 space-y-3 md:hidden">{Array.from({ length: 5 }, (_, index) => <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-4" key={index}><div className="flex items-start justify-between gap-3"><Skeleton className="h-5 w-3/4" /><Skeleton className="h-10 w-14 shrink-0" /></div><div className="mt-4 grid grid-cols-2 gap-3"><Skeleton className="h-4 w-24" /><Skeleton className="h-4 w-20" /><Skeleton className="h-4 w-28" /><Skeleton className="h-4 w-24" /></div></div>)}</div>
    <div className="mt-5 hidden overflow-hidden md:block"><div className="space-y-4"><Skeleton className="h-4 w-full" />{Array.from({ length: 5 }, (_, index) => <div className="grid grid-cols-[2fr_1fr_1fr_1fr_72px] items-center gap-4" key={index}><Skeleton className="h-5 w-4/5" /><Skeleton className="h-4 w-3/5" /><Skeleton className="h-5 w-16" /><Skeleton className="h-4 w-24" /><Skeleton className="h-10 w-14" /></div>)}</div></div>
  </div>;
}

function ArticleFormSkeleton() {
  return <div aria-busy="true" aria-label="Loading article editor" className="space-y-5"><div className="space-y-2"><Skeleton className="h-3 w-24" /><Skeleton className="h-9 w-56" /><Skeleton className="h-4 w-96 max-w-full" /></div><div className={`${cardClass} space-y-5`}><Skeleton className="h-11 w-full" /><div className="grid gap-4 sm:grid-cols-2"><Skeleton className="h-11 w-full" /><Skeleton className="h-11 w-full" /></div><Skeleton className="h-20 w-full" /><Skeleton className="h-10 w-32" /><Skeleton className="h-56 w-full" /><div className="grid gap-4 sm:grid-cols-2"><Skeleton className="h-11 w-full" /><Skeleton className="h-40 w-full" /></div><Skeleton className="h-11 w-36" /></div></div>;
}

function AuthorsSkeleton() {
  return <div aria-busy="true" aria-label="Loading authors" className="space-y-5 sm:space-y-6"><div className="space-y-2"><Skeleton className="h-3 w-24" /><Skeleton className="h-9 w-64 max-w-full" /><Skeleton className="h-4 w-96 max-w-full" /></div><div className="grid gap-5 xl:grid-cols-[1fr_1.3fr]"><div className={`${cardClass} space-y-4`}><Skeleton className="h-6 w-32" />{Array.from({ length: 4 }, (_, index) => <Skeleton className="h-11 w-full" key={index} />)}<Skeleton className="h-36 w-full" /><Skeleton className="h-11 w-36" /></div><div className={cardClass}><div className="flex items-center justify-between gap-3"><div className="space-y-2"><Skeleton className="h-6 w-48" /><Skeleton className="h-3 w-32" /></div><Skeleton className="h-11 w-40 max-w-[40%]" /></div><div className="mt-5 space-y-4">{Array.from({ length: 6 }, (_, index) => <div className="flex justify-between gap-4" key={index}><div className="min-w-0 flex-1 space-y-2"><Skeleton className="h-5 w-2/5" /><Skeleton className="h-3 w-3/5" /></div><Skeleton className="h-6 w-16" /></div>)}</div></div></div></div>;
}

function stripHtml(value: string): string { return value.replace(/<[^>]*>/g, "").replace(/&[^;]+;/g, " ").trim(); }
function formatDuration(seconds: number): string { if (seconds < 60) return `${seconds}s`; return `${Math.floor(seconds / 60)}m ${seconds % 60}s`; }
function formatDate(value?: string | null): string { const match = value?.match(/^(\d{4})-(\d{2})-(\d{2})/); if (!match) return "—"; return new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeZone: "UTC" }).format(new Date(`${match[1]}-${match[2]}-${match[3]}T12:00:00Z`)); }

function AdminNavIcon({ tab }: { tab: Tab }) {
  const common = { "aria-hidden": true, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.8, className: "h-5 w-5" };
  if (tab === "overview") return <svg {...common}><rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" /><rect x="3" y="14" width="7" height="7" rx="1" /><rect x="14" y="14" width="7" height="7" rx="1" /></svg>;
  if (tab === "articles") return <svg {...common}><path strokeLinecap="round" strokeLinejoin="round" d="M6 3.75h8.25L19 8.5v11.75A1.75 1.75 0 0117.25 22h-11.5A1.75 1.75 0 014 20.25V5.5a1.75 1.75 0 011.75-1.75z" /><path strokeLinecap="round" strokeLinejoin="round" d="M14 3.75V9h5.25M8 13h8M8 16.5h8" /></svg>;
  if (tab === "new") return <svg {...common}><rect x="4" y="4" width="16" height="16" rx="3" /><path strokeLinecap="round" d="M12 8v8M8 12h8" /></svg>;
  return <svg {...common}><circle cx="9" cy="8" r="3" /><path strokeLinecap="round" strokeLinejoin="round" d="M3.5 19.5a5.5 5.5 0 0111 0M16 11a3 3 0 100-6M17 14.5a5.5 5.5 0 014 5" /></svg>;
}

type SelectOption = { value: string; label: string; searchText?: string };

function SearchableSelect({ label, value, options, placeholder, onChange, loading = false }: { label: string; value: string; options: SelectOption[]; placeholder: string; onChange: (value: string) => void; loading?: boolean }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const selected = options.find((option) => option.value === value);
  const filtered = options.filter((option) => `${option.label} ${option.searchText || ""}`.toLocaleLowerCase().includes(query.toLocaleLowerCase()));
  return <div className="relative">
    <span className="block text-sm font-semibold">{label}</span>
    <button type="button" disabled={loading} aria-haspopup="listbox" aria-expanded={open} onClick={() => setOpen((current) => !current)} className={`${inputClass} mt-1.5 flex items-center justify-between gap-3 text-left disabled:cursor-wait disabled:bg-slate-50`}>
      <span className={selected ? "text-slate-900" : "text-slate-400"}>{loading ? "Loading options…" : selected?.label || placeholder}</span><span aria-hidden className="text-slate-400">⌄</span>
    </button>
    {open && <div className="absolute inset-x-0 top-[calc(100%+0.35rem)] z-30 overflow-hidden rounded-xl border border-slate-200 bg-white p-2 shadow-xl">
      <input autoFocus className={inputClass} placeholder={`Search ${label.toLocaleLowerCase()}…`} value={query} onChange={(event) => setQuery(event.target.value)} />
      <div className="mt-2 max-h-[45vh] overflow-y-auto sm:max-h-56" role="listbox">
        <button type="button" role="option" aria-selected={!value} onClick={() => { onChange(""); setQuery(""); setOpen(false); }} className="min-h-11 block w-full rounded-lg px-3 py-2 text-left text-sm text-slate-400 hover:bg-slate-50">{placeholder}</button>
        {filtered.map((option) => <button type="button" role="option" aria-selected={option.value === value} key={option.value} onClick={() => { onChange(option.value); setQuery(""); setOpen(false); }} className={`min-h-11 block w-full rounded-lg px-3 py-2 text-left text-sm hover:bg-violet-50 ${option.value === value ? "bg-violet-50 font-semibold text-violet-800" : "text-slate-700"}`}>{option.label}</button>)}
        {!filtered.length && <p className="px-3 py-3 text-sm text-slate-500">No matches found.</p>}
      </div>
    </div>}
  </div>;
}

const toolbarButtons: { label: string; command: string; value?: string }[] = [
  { label: "Paragraph", command: "formatBlock", value: "p" },
  { label: "B", command: "bold" }, { label: "I", command: "italic" }, { label: "U", command: "underline" },
  { label: "H2", command: "formatBlock", value: "h2" }, { label: "H3", command: "formatBlock", value: "h3" },
  { label: "• List", command: "insertUnorderedList" }, { label: "1. List", command: "insertOrderedList" }, { label: "Quote", command: "formatBlock", value: "blockquote" }, { label: "Pre", command: "formatBlock", value: "pre" },
  { label: "S", command: "strikeThrough" }, { label: "Center", command: "justifyCenter" }, { label: "Right", command: "justifyRight" }, { label: "HR", command: "insertHorizontalRule" },
];

const blockTags = new Set(["ADDRESS", "ARTICLE", "ASIDE", "BLOCKQUOTE", "DIV", "FIGCAPTION", "FIGURE", "FOOTER", "H1", "H2", "H3", "H4", "H5", "H6", "HEADER", "HR", "LI", "MAIN", "NAV", "OL", "P", "PRE", "SECTION", "TABLE", "UL"]);

function rewriteEditorMediaUrl(value: string): string {
  if (!value || value.trim().toLowerCase().startsWith("data:")) return value;
  if (/^\/?wp-content\//i.test(value)) return value.startsWith("/") ? value : `/${value}`;
  try {
    const url = new URL(value, window.location.origin);
    if ((url.hostname === "islamonlive.in" || url.hostname === "www.islamonlive.in" || url.hostname === "admin.islamonlive.in") && url.pathname.startsWith("/wp-content/")) return `${url.pathname}${url.search}`;
  } catch { /* Leave malformed or non-URL values untouched. */ }
  return value;
}

function normalizeEditorMedia(root: HTMLElement) {
  root.querySelectorAll<HTMLElement>("img, source, video").forEach((element) => {
    for (const attribute of ["src", "data-src", "poster"]) {
      const value = element.getAttribute(attribute);
      if (value) element.setAttribute(attribute, rewriteEditorMediaUrl(value));
    }
    for (const attribute of ["srcset", "data-srcset"]) {
      const value = element.getAttribute(attribute);
      if (!value) continue;
      if (value.toLowerCase().includes("data:")) continue;
      element.setAttribute(attribute, value.split(",").map((candidate) => {
        const match = candidate.trim().match(/^(\S+)(\s+.*)?$/);
        return match ? `${rewriteEditorMediaUrl(match[1])}${match[2] || ""}` : candidate;
      }).join(", "));
    }
  });
}

/**
 * Classic WordPress content often stores each paragraph as a span separated
 * by blank lines. The public REST renderer wraps that same content in p tags,
 * but a contentEditable element does not: whitespace collapses into one run.
 * Add the missing block wrappers for visual editing while preserving all
 * inline markup, images and existing block markup.
 */
function normalizeEditorHtml(value: string): string {
  if (!value || typeof window === "undefined") return value;
  const document = new DOMParser().parseFromString(value, "text/html");
  const root = document.body;
  normalizeEditorMedia(root);
  if (Array.from(root.childNodes).some((node) => node.nodeType === Node.COMMENT_NODE)) return root.innerHTML;
  if (Array.from(root.children).some((element) => blockTags.has(element.tagName))) return root.innerHTML;

  const groups: ChildNode[][] = [];
  let group: ChildNode[] = [];
  const flush = () => { if (group.some((node) => node.nodeType !== Node.TEXT_NODE || node.textContent?.trim())) groups.push(group); group = []; };
  root.childNodes.forEach((node) => {
    if (node.nodeType === Node.TEXT_NODE && !node.textContent?.trim() && /\n/.test(node.textContent || "")) flush();
    else group.push(node);
  });
  flush();
  if (!groups.length) return root.innerHTML;
  const fragment = document.createDocumentFragment();
  groups.forEach((nodes) => { const paragraph = document.createElement("p"); nodes.forEach((node) => paragraph.appendChild(node.cloneNode(true))); fragment.appendChild(paragraph); });
  root.replaceChildren(fragment);
  return root.innerHTML;
}

function HtmlEditor({ label, value, onChange, minHeight = "min-h-72", helpText }: { label: string; value: string; onChange: (value: string) => void; minHeight?: string; helpText?: string }) {
  const editorRef = useRef<HTMLDivElement>(null);
  const lastValue = useRef(value);
  const [mode, setMode] = useState<"visual" | "html">("visual");
  const displayValue = normalizeEditorHtml(value);
  useEffect(() => {
    if (editorRef.current && editorRef.current.innerHTML !== displayValue) editorRef.current.innerHTML = displayValue;
    lastValue.current = displayValue;
  }, [displayValue, mode]);
  function run(command: string, commandValue?: string) {
    editorRef.current?.focus();
    if (command === "createLink") { const url = window.prompt("Link URL"); if (url) document.execCommand(command, false, url); }
    else document.execCommand(command, false, commandValue);
    const html = editorRef.current?.innerHTML || ""; lastValue.current = html; onChange(html);
  }
  return <div>
    <div className="flex flex-wrap items-end justify-between gap-2"><span className="block text-sm font-semibold">{label}</span><div className="flex overflow-hidden rounded-lg border border-slate-200 bg-white text-xs font-semibold"><button type="button" onClick={() => setMode("visual")} className={`min-h-11 px-3 py-1.5 ${mode === "visual" ? "bg-violet-700 text-white" : "text-slate-500"}`}>Visual</button><button type="button" onClick={() => setMode("html")} className={`min-h-11 px-3 py-1.5 ${mode === "html" ? "bg-violet-700 text-white" : "text-slate-500"}`}>HTML</button></div></div>
    {mode === "visual" ? <>
      <div className="mt-1.5 flex flex-nowrap gap-1 overflow-x-auto rounded-t-xl border border-b-0 border-slate-200 bg-slate-50 p-2">{toolbarButtons.map((button) => <button type="button" key={button.label} onMouseDown={(event) => event.preventDefault()} onClick={() => run(button.command, button.value)} className="min-h-11 shrink-0 rounded-lg border border-transparent px-2.5 py-1.5 text-xs font-semibold text-slate-600 hover:border-slate-200 hover:bg-white">{button.label}</button>)}<button type="button" onMouseDown={(event) => event.preventDefault()} onClick={() => run("createLink")} className="min-h-11 shrink-0 rounded-lg border border-transparent px-2.5 py-1.5 text-xs font-semibold text-slate-600 hover:border-slate-200 hover:bg-white">Link</button><button type="button" onMouseDown={(event) => event.preventDefault()} onClick={() => run("removeFormat")} className="min-h-11 shrink-0 rounded-lg border border-transparent px-2.5 py-1.5 text-xs text-slate-500 hover:border-slate-200 hover:bg-white">Clear</button></div>
      <div ref={editorRef} contentEditable suppressContentEditableWarning onInput={(event) => { const html = event.currentTarget.innerHTML; lastValue.current = html; onChange(html); }} className={`${minHeight} prose prose-slate prose-sm max-w-none overflow-x-auto rounded-b-xl border border-slate-200 bg-white px-4 py-3 leading-relaxed outline-none prose-headings:font-display prose-a:text-violet-700 prose-img:mx-auto prose-img:max-w-full [&_img]:h-auto [&_img]:max-w-full focus:border-violet-500 focus:ring-2 focus:ring-violet-100 sm:prose-base`} />
    </> : <textarea className={`${inputClass} mt-1.5 ${minHeight} font-mono text-xs`} value={displayValue} onChange={(event) => onChange(event.target.value)} />}
    {helpText && <p className="mt-1.5 text-xs text-slate-500">{helpText}</p>}
  </div>;
}

/* eslint-disable @next/next/no-img-element -- blob previews are local browser files, not app images */
function ImageUploadField({ file, altText, existing, onChange, onAltChange, onRemoveExisting }: { file: File | null; altText: string; existing?: { url: string; alt: string } | null; onChange: (file: File | null) => void; onAltChange: (value: string) => void; onRemoveExisting?: () => void }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(null);
  useEffect(() => { const url = file ? URL.createObjectURL(file) : null; let active = true; queueMicrotask(() => { if (active) setPreview(url); }); return () => { active = false; if (url) URL.revokeObjectURL(url); }; }, [file]);
  return <div className="rounded-2xl border-2 border-dashed border-slate-300 bg-slate-50 p-3 transition hover:border-violet-400 sm:p-4">
    <input ref={inputRef} className="hidden" type="file" accept="image/*" onChange={(event) => onChange(event.target.files?.[0] || null)} />
    {file && preview ? <div className="grid gap-4 sm:grid-cols-[180px_1fr] sm:items-start"><img src={preview} alt="Selected featured image preview" className="h-40 w-full rounded-xl border border-slate-200 bg-white object-cover sm:h-36" /><div><p className="break-all text-sm font-semibold text-slate-800">{file.name}</p><p className="mt-1 text-xs text-slate-500">{Math.ceil(file.size / 1024)} KB · {file.type || "image"}</p><label className="mt-3 block text-sm font-semibold">Image alt text<input className={`${inputClass} mt-1.5`} value={altText} onChange={(event) => onAltChange(event.target.value)} placeholder="Describe the image" /></label><div className="mt-3 flex flex-wrap gap-2"><button type="button" onClick={() => inputRef.current?.click()} className="min-h-10 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold">Replace</button><button type="button" onClick={() => { onChange(null); onAltChange(""); }} className="min-h-10 rounded-lg border border-red-200 bg-white px-3 py-2 text-xs font-semibold text-red-700">Remove</button></div></div></div> : existing ? <div className="grid gap-4 sm:grid-cols-[180px_1fr] sm:items-start"><img src={existing.url} alt={existing.alt || "Current featured image"} className="h-40 w-full rounded-xl border border-slate-200 bg-white object-cover sm:h-36" /><div><p className="text-sm font-semibold text-slate-800">Current featured image</p><label className="mt-3 block text-sm font-semibold">Image alt text<input className={`${inputClass} mt-1.5`} value={altText} onChange={(event) => onAltChange(event.target.value)} placeholder="Describe the image" /></label><div className="mt-3 flex flex-wrap gap-2"><button type="button" onClick={() => inputRef.current?.click()} className="min-h-10 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold">Replace</button>{onRemoveExisting && <button type="button" onClick={onRemoveExisting} className="min-h-10 rounded-lg border border-red-200 bg-white px-3 py-2 text-xs font-semibold text-red-700">Remove</button>}</div></div></div> : <button type="button" onClick={() => inputRef.current?.click()} className="flex min-h-32 w-full flex-col items-center justify-center rounded-xl border border-slate-200 bg-white px-4 py-6 text-center hover:bg-violet-50"><span className="text-2xl">＋</span><span className="mt-2 text-sm font-bold text-slate-700">Choose a detailed image</span><span className="mt-1 text-xs text-slate-500">PNG, JPG or WebP · up to 10 MB</span></button>}
  </div>;
}
/* eslint-enable @next/next/no-img-element */

function PasswordInput({ value, onChange, autoComplete, placeholder }: { value: string; onChange: (value: string) => void; autoComplete?: string; placeholder?: string }) {
  const [visible, setVisible] = useState(false);
  return <div className="relative mt-1.5">
    <input className={`${inputClass} pr-11`} type={visible ? "text" : "password"} value={value} onChange={(event) => onChange(event.target.value)} autoComplete={autoComplete} placeholder={placeholder} required />
    <button type="button" aria-label={visible ? "Hide password" : "Show password"} title={visible ? "Hide password" : "Show password"} onClick={() => setVisible((current) => !current)} className="absolute inset-y-0 right-0 flex w-11 items-center justify-center text-slate-400 transition hover:text-violet-700">
      {visible ? <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-5 w-5"><path strokeLinecap="round" strokeLinejoin="round" d="M3 3l18 18M10.58 10.58a2 2 0 102.83 2.83M9.88 4.24A10.7 10.7 0 0112 4c5.25 0 8.94 4.36 10 8a11.8 11.8 0 01-3.05 5.28M6.23 6.23C4.56 7.46 3.34 9.24 2 12c1.06 3.64 4.75 8 10 8 1.18 0 2.28-.2 3.28-.56" /></svg> : <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-5 w-5"><path strokeLinecap="round" strokeLinejoin="round" d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z" /><circle cx="12" cy="12" r="2.5" /></svg>}
    </button>
  </div>;
}

function Login() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  async function submit(event: FormEvent) {
    event.preventDefault(); setError(""); setLoading(true);
    const response = await fetch("/api/admin/login/", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ username, password }) });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) setError(body.error || "Login failed"); else window.location.reload();
    setLoading(false);
  }
  return <div className="fixed inset-0 z-[100] flex min-h-screen items-center justify-center overflow-auto bg-[#170826] px-3 py-6 text-white sm:px-4 sm:py-10">
    <div className="w-full max-w-md rounded-3xl border border-white/10 bg-white p-5 text-slate-900 shadow-2xl sm:p-9">
      <div className="mb-7 sm:mb-8"><p className="pill text-xs font-bold uppercase tracking-[0.2em] text-violet-700">Islamonlive</p><h1 className="mt-2 text-2xl font-extrabold sm:text-3xl">Admin workspace</h1><p className="mt-2 text-sm text-slate-500">Sign in with your existing WordPress admin account.</p></div>
      <form onSubmit={submit} className="space-y-4">
        <label className="block text-sm font-semibold">WordPress username<input className={`${inputClass} mt-1.5`} value={username} onChange={(e) => setUsername(e.target.value)} autoComplete="username" required /></label>
        <label className="block text-sm font-semibold">WordPress password<PasswordInput value={password} onChange={setPassword} autoComplete="current-password" /></label>
        {error && <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
        <button className="min-h-11 w-full rounded-xl bg-violet-700 px-4 py-3 font-bold text-white transition hover:bg-violet-800 disabled:opacity-50" disabled={loading}>{loading ? "Connecting…" : "Sign in"}</button>
      </form>
      <p className="mt-6 text-xs leading-relaxed text-slate-500">Your credentials are sent only to the WordPress origin through this server. They are not stored in the browser.</p>
    </div>
  </div>;
}

function AdminShell({ children, tab, setTab, onLogout }: { children: React.ReactNode; tab: Tab; setTab: (tab: Tab) => void; onLogout: () => void }) {
  const items: { key: Tab; label: string }[] = [{ key: "overview", label: "Overview" }, { key: "articles", label: "Articles" }, { key: "new", label: "New article" }, { key: "authors", label: "Authors" }];
  const activeTab = tab === "edit" ? "articles" : tab;
  return <div className="fixed inset-0 z-[100] overflow-auto bg-slate-50 text-slate-900">
    <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/95 backdrop-blur"><div className="mx-auto flex max-w-[1500px] items-center justify-between gap-3 px-3 py-2.5 sm:px-8 sm:py-3"><Image src="/logo.png" alt="Islamonlive" width={132} height={36} priority className="h-8 w-auto object-contain sm:h-9" /><button type="button" className="min-h-11 rounded-md border border-slate-200 px-3 text-sm font-semibold hover:bg-slate-50" onClick={onLogout}>Log out</button></div></header>
    <div className="mx-auto grid max-w-[1500px] gap-4 px-3 py-4 pb-[calc(5.5rem+env(safe-area-inset-bottom))] sm:gap-6 sm:px-8 sm:py-6 sm:pb-[calc(5.5rem+env(safe-area-inset-bottom))] lg:grid-cols-[220px_1fr] lg:pb-6"><nav className="hidden lg:block lg:space-y-1">{items.map((item) => <button key={item.key} aria-current={activeTab === item.key ? "page" : undefined} onClick={() => setTab(item.key)} className={`min-h-11 rounded-xl px-4 py-3 text-left text-sm font-semibold transition lg:block lg:w-full ${activeTab === item.key ? "bg-violet-700 text-white shadow-sm" : "text-slate-600 hover:bg-white hover:text-slate-900"}`}>{item.label}</button>)}</nav><main className="min-w-0">{children}</main></div>
    <nav aria-label="Admin navigation" className="fixed inset-x-0 bottom-0 z-50 grid grid-cols-4 border-t border-slate-200 bg-white/95 pb-[env(safe-area-inset-bottom)] shadow-[0_-4px_16px_rgba(15,23,42,0.08)] backdrop-blur lg:hidden">{items.map((item) => <button key={item.key} type="button" aria-current={activeTab === item.key ? "page" : undefined} onClick={() => setTab(item.key)} className={`flex min-h-16 flex-col items-center justify-center gap-0.5 px-1 text-[11px] font-semibold transition ${activeTab === item.key ? "text-violet-700" : "text-slate-500"}`}><span className="flex h-5 items-center justify-center"><AdminNavIcon tab={item.key} /></span><span>{item.key === "new" ? "New" : item.label}</span><span className={`mt-0.5 block h-1 w-8 rounded-full ${activeTab === item.key ? "bg-violet-700" : "bg-transparent"}`} /></button>)}</nav>
  </div>;
}

function Overview({ summary, refresh, error }: { summary: Summary | null; refresh: () => void; error?: string }) {
  if (!summary && error) return <div className={`${cardClass} space-y-3`} role="alert"><p className="text-sm font-semibold text-slate-900">Analytics could not be loaded.</p><p className="text-sm text-slate-500">{error}</p><button type="button" onClick={refresh} className="min-h-11 rounded-md border border-slate-200 px-4 text-sm font-semibold hover:bg-slate-50">Try again</button></div>;
  if (!summary) return <OverviewSkeleton />;
  return <div className="space-y-5 sm:space-y-6"><div className="flex flex-wrap items-end justify-between gap-3"><div><p className="pill text-xs font-bold uppercase tracking-[0.18em] text-violet-700">Last 30 days</p><h1 className="mt-1 text-2xl font-extrabold sm:text-3xl">Reader analytics</h1><p className="mt-1 text-sm text-slate-500">Anonymous readers, article views and reading depth from this Next.js site.</p></div><button onClick={refresh} className="min-h-11 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold hover:bg-slate-50">Refresh</button></div>
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{[["Views", summary.views.toLocaleString()], ["Unique readers", summary.uniqueReaders.toLocaleString()], ["Avg. reading time", formatDuration(summary.averageReadingSeconds)], ["Completion", `${summary.completionRate}%`]].map(([label, value]) => <div className={cardClass} key={label}><p className="text-sm text-slate-500">{label}</p><p className="mt-2 text-3xl font-extrabold text-slate-950">{value}</p></div>)}</div>
    <div className="grid gap-5 xl:grid-cols-[1.2fr_1fr]"><section className={cardClass}><h2 className="text-lg font-extrabold">Daily readers</h2>{summary.daily.length ? <div className="mt-5 space-y-3">{summary.daily.slice(-14).map((day) => <div key={day.date} className="grid grid-cols-[56px_1fr_40px] items-center gap-2 text-sm sm:grid-cols-[72px_1fr_48px] sm:gap-3"><span className="text-slate-500">{day.date.slice(5)}</span><div className="h-2 rounded-full bg-slate-100"><div className="h-2 rounded-full bg-violet-600" style={{ width: `${Math.min(100, (day.views / Math.max(...summary.daily.map((d) => d.views), 1)) * 100)}%` }} /></div><span className="text-right font-semibold">{day.views}</span></div>)}</div> : <p className="mt-4 text-sm text-slate-500">No reader events yet. Once readers open articles, this chart will populate.</p>}</section>
      <section className={cardClass}><h2 className="text-lg font-extrabold">Top articles</h2><div className="mt-4 divide-y divide-slate-100">{summary.topArticles.length ? summary.topArticles.map((article) => <div key={article.articleId} className="py-3 first:pt-0"><p className="font-semibold leading-snug">{article.title}</p><p className="mt-1 text-xs text-slate-500">Published {formatDate(article.publishedAt)} · {article.views.toLocaleString()} views · {article.readers.toLocaleString()} readers</p><p className="mt-1 text-xs text-slate-400">{formatDuration(article.averageReadingSeconds)} average reading · {article.completionRate}% complete</p></div>) : <p className="text-sm text-slate-500">No article data yet.</p>}</div></section></div>
  </div>;
}

function Articles({ authors, authorsLoading, onNew, onEdit }: { authors: Author[]; authorsLoading: boolean; onNew: () => void; onEdit: (id: number) => void }) {
  const [items, setItems] = useState<Post[]>([]);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  async function load(nextPage = page, query = search) {
    setLoading(true);
    setError("");
    try {
      const response = await fetch(`/api/admin/posts/?page=${nextPage}&search=${encodeURIComponent(query)}`, { cache: "no-store" });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) { setError(body.error || "Could not load articles"); return; }
      setItems(body.items || []);
      setTotal(Number(body.total || 0));
      setTotalPages(Math.max(1, Number(body.totalPages || 1)));
    } catch { setError("Could not reach the article service"); }
    finally { setLoading(false); }
  }

  useEffect(() => {
    let cancelled = false;
    void fetch("/api/admin/posts/?page=1&search=", { cache: "no-store" }).then(async (response) => {
      const body = await response.json().catch(() => ({}));
      if (cancelled) return;
      if (response.ok) { setItems(body.items || []); setTotal(Number(body.total || 0)); setTotalPages(Math.max(1, Number(body.totalPages || 1))); }
      else setError(body.error || "Could not load articles");
      setLoading(false);
    }).catch(() => { if (!cancelled) { setError("Could not reach the article service"); setLoading(false); } });
    return () => { cancelled = true; };
  }, []);

  function submitSearch(event: FormEvent) {
    event.preventDefault();
    setPage(1);
    void load(1, search.trim());
  }

  return <div className="space-y-5 sm:space-y-6">
    <div className="flex flex-wrap items-end justify-between gap-3"><div><p className="pill text-xs font-bold uppercase tracking-[0.18em] text-violet-700">WordPress posts</p><h1 className="mt-1 text-2xl font-extrabold sm:text-3xl">Articles</h1><p className="mt-1 text-sm text-slate-500">Search, edit and publish existing articles without leaving this dashboard.</p></div><button type="button" onClick={onNew} className="min-h-11 rounded-xl bg-violet-700 px-4 py-2.5 text-sm font-bold text-white hover:bg-violet-800">+ New article</button></div>
    <div className={cardClass}>
      <form className="flex flex-col gap-2 sm:flex-row" onSubmit={submitSearch}><input className={inputClass} placeholder="Search by article title or content" value={search} onChange={(e) => setSearch(e.target.value)} /><div className="flex gap-2"><button className="min-h-11 flex-1 rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold hover:bg-slate-50 sm:flex-none">Search</button>{search && <button type="button" onClick={() => { setSearch(""); setPage(1); void load(1, ""); }} className="min-h-11 flex-1 rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-50 sm:flex-none">Clear</button>}</div></form>
      {error && <p role="alert" className="mt-3 rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
      {loading ? <ArticleListSkeleton /> : <>
        <div className="mt-4 space-y-3 md:hidden">{items.length ? items.map((post) => <article key={post.id} className="rounded-xl border border-slate-200 bg-slate-50/60 p-4"><div className="flex items-start justify-between gap-3"><h2 className="min-w-0 flex-1 break-words font-semibold leading-snug">{stripHtml(post.title.rendered)}</h2><button type="button" onClick={() => onEdit(post.id)} className="min-h-10 shrink-0 rounded-lg border border-violet-200 bg-white px-3 text-xs font-semibold text-violet-700 hover:bg-violet-50">Edit</button></div><dl className="mt-3 grid grid-cols-2 gap-3 text-xs"><div><dt className="text-slate-400">Author</dt><dd className="mt-1 break-words font-medium text-slate-700">{authorsLoading ? "Loading…" : authors.find((item) => item.id === post.author)?.name || "—"}</dd></div><div><dt className="text-slate-400">Status</dt><dd className="mt-1"><span className="rounded-full bg-white px-2 py-1 font-semibold text-slate-600">{post.status || "publish"}</span></dd></div><div><dt className="text-slate-400">Published</dt><dd className="mt-1 text-slate-600">{formatDate(post.date)}</dd></div>{post.modified && post.modified !== post.date && <div><dt className="text-slate-400">Edited</dt><dd className="mt-1 text-slate-600">{formatDate(post.modified)}</dd></div>}</dl></article>) : <div className="rounded-xl border border-slate-200 px-4 py-8 text-center text-sm text-slate-500">No articles found.</div>}</div>
        <div className="mt-5 hidden overflow-x-auto md:block"><table className="w-full min-w-[820px] text-left text-sm"><thead className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-400"><tr><th className="pb-3 pr-4">Title</th><th className="pb-3 pr-4">Author</th><th className="pb-3 pr-4">Status</th><th className="pb-3 pr-4">Published</th><th className="pb-3">Actions</th></tr></thead><tbody className="divide-y divide-slate-100">{items.length ? items.map((post) => <tr key={post.id}><td className="max-w-[420px] break-words py-4 pr-4 font-semibold">{stripHtml(post.title.rendered)}</td><td className="py-4 pr-4 text-slate-600">{authorsLoading ? "Loading…" : authors.find((item) => item.id === post.author)?.name || "—"}</td><td className="py-4 pr-4"><span className="rounded-full bg-slate-100 px-2 py-1 text-xs font-semibold">{post.status || "publish"}</span></td><td className="py-4 pr-4 text-slate-500"><span className="block">{formatDate(post.date)}</span>{post.modified && post.modified !== post.date && <span className="mt-1 block text-xs text-slate-400">Edited {formatDate(post.modified)}</span>}</td><td className="py-4"><button type="button" onClick={() => onEdit(post.id)} className="min-h-10 rounded-lg border border-violet-200 px-3 text-xs font-semibold text-violet-700 hover:bg-violet-50">Edit</button></td></tr>) : <tr><td colSpan={5} className="py-8 text-center text-slate-500">No articles found.</td></tr>}</tbody></table></div>
      </>}
      <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-sm text-slate-500"><span>{total.toLocaleString()} {total === 1 ? "article" : "articles"} · Page {page} of {Math.max(1, totalPages)}</span><div className="flex w-full gap-2 sm:w-auto"><button type="button" disabled={page <= 1 || loading} onClick={() => { const next = page - 1; setPage(next); void load(next); }} className="min-h-10 flex-1 rounded-lg border border-slate-200 px-3 py-1.5 disabled:opacity-40 sm:flex-none">Previous</button><button type="button" disabled={page >= totalPages || loading} onClick={() => { const next = page + 1; setPage(next); void load(next); }} className="min-h-10 flex-1 rounded-lg border border-slate-200 px-3 py-1.5 disabled:opacity-40 sm:flex-none">Next</button></div></div>
    </div>
  </div>;
}

function NewArticle({ authors, categories, taxonomiesLoading, editId, onCreated, onCategoryCreated }: { authors: Author[]; categories: Category[]; taxonomiesLoading: boolean; editId?: number | null; onCreated: () => void; onCategoryCreated: () => Promise<void> }) {
  const editing = Boolean(editId);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [excerpt, setExcerpt] = useState("");
  const [status, setStatus] = useState("draft");
  const [author, setAuthor] = useState("");
  const [category, setCategory] = useState("");
  const [initialCategory, setInitialCategory] = useState("");
  const [existingCategoryIds, setExistingCategoryIds] = useState<number[]>([]);
  const [newCategory, setNewCategory] = useState("");
  const [image, setImage] = useState<File | null>(null);
  const [imageAlt, setImageAlt] = useState("");
  const [existingImage, setExistingImage] = useState<{ url: string; alt: string } | null>(null);
  const [existingMediaId, setExistingMediaId] = useState(0);
  const [removeExistingImage, setRemoveExistingImage] = useState(false);
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);
  const [loadingPost, setLoadingPost] = useState(editing);
  const [creatingCategory, setCreatingCategory] = useState(false);

  useEffect(() => {
    if (!editId) return;
    let cancelled = false;
    void fetch("/api/admin/posts/?id=" + editId, { cache: "no-store" }).then(async (response) => {
      const body = await response.json().catch(() => ({}));
      if (cancelled) return;
      if (!response.ok || !body.item) { setMessage(body.error || "Could not load article"); setLoadingPost(false); return; }
      const item = body.item as Post;
      setTitle(item.title?.raw || stripHtml(item.title?.rendered || ""));
      setContent(item.content?.raw || item.content?.rendered || "");
      setExcerpt(item.excerpt?.raw || item.excerpt?.rendered || "");
      setStatus(item.status || "draft");
      setAuthor(item.author ? String(item.author) : "");
      setCategory(item.categories?.[0] ? String(item.categories[0]) : "");
      setInitialCategory(item.categories?.[0] ? String(item.categories[0]) : "");
      setExistingCategoryIds(item.categories || []);
      const media = item._embedded?.["wp:featuredmedia"]?.[0];
      setExistingMediaId(Number(item.featured_media || media?.id || 0));
      setExistingImage(media?.source_url ? { url: media.source_url, alt: media.alt_text || "" } : null);
      setImageAlt(media?.alt_text || "");
      setLoadingPost(false);
    }).catch(() => { if (!cancelled) { setMessage("Could not reach the article service"); setLoadingPost(false); } });
    return () => { cancelled = true; };
  }, [editId]);

  const authorOptions = authors.map((item) => ({ value: String(item.id), label: item.name, searchText: item.slug }));
  const categoryOptions = categories.map((item) => ({ value: String(item.id), label: item.name, searchText: String(item.count) }));

  async function createCategory() {
    if (!newCategory.trim()) return;
    setCreatingCategory(true); setMessage("");
    const response = await fetch("/api/admin/categories/", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: newCategory.trim() }) });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) setMessage(body.error || "Could not create category");
    else { await onCategoryCreated(); setCategory(String(body.item.id)); setNewCategory(""); setMessage("Category created and selected."); }
    setCreatingCategory(false);
  }

  async function submit(event: FormEvent) {
    event.preventDefault(); setSaving(true); setMessage("");
    const form = new FormData();
    form.set("title", title); form.set("content", content); form.set("excerpt", excerpt); form.set("status", status);
    if (author) form.set("author", author);
    const selectedCategory = category ? Number(category) : 0;
    const preservedCategories = existingCategoryIds.filter((id) => String(id) !== initialCategory && id !== selectedCategory);
    form.set("categories", JSON.stringify(selectedCategory ? [selectedCategory, ...preservedCategories] : preservedCategories));
    if (image) form.set("featuredImage", image);
    form.set("featuredImageAlt", imageAlt);
    if (existingMediaId) form.set("existingFeaturedMedia", String(existingMediaId));
    if (removeExistingImage) form.set("removeFeaturedImage", "true");
    const response = await fetch(editing ? "/api/admin/posts/?id=" + editId : "/api/admin/posts/", { method: editing ? "PUT" : "POST", body: form });
    const body = await response.json().catch(() => ({}));
    setSaving(false);
    if (!response.ok) { setMessage(body.error || (editing ? "Could not update article" : "Could not create article")); return; }
    setMessage(editing ? "Article updated successfully." : "Article created successfully.");
    onCreated();
  }

  if (loadingPost) return <ArticleFormSkeleton />;

  return <div className="space-y-6">
    <div><p className="pill text-xs font-bold uppercase tracking-[0.18em] text-violet-700">WordPress posts</p><h1 className="mt-1 text-2xl font-extrabold sm:text-3xl">{editing ? "Edit article" : "Create article"}</h1><p className="mt-1 text-sm text-slate-500">{editing ? "Update the existing WordPress article while keeping its permalink and history." : "Content is created directly in WordPress, so existing permalinks and editorial data stay together."}</p></div>
    <form onSubmit={submit} className={cardClass + " space-y-5"}>
      <label className="block text-sm font-semibold">Title<input className={inputClass + " mt-1.5"} value={title} onChange={(e) => setTitle(e.target.value)} required /></label>
      <div className="grid gap-4 sm:grid-cols-2"><SearchableSelect label="Author" value={author} options={authorOptions} placeholder="Choose author" onChange={setAuthor} loading={taxonomiesLoading} /><div><SearchableSelect label="Category" value={category} options={categoryOptions} placeholder="Choose category" onChange={setCategory} loading={taxonomiesLoading} /><div className="mt-2 flex gap-2"><input className={inputClass} placeholder="New category" value={newCategory} onChange={(e) => setNewCategory(e.target.value)} /><button type="button" onClick={() => void createCategory()} disabled={creatingCategory || taxonomiesLoading || !newCategory.trim()} className="shrink-0 rounded-xl border border-slate-200 px-3 text-xs font-semibold hover:bg-slate-50 disabled:opacity-40">{creatingCategory ? "…" : "Create"}</button></div></div></div>
      <label className="block text-sm font-semibold">Excerpt<textarea className={inputClass + " mt-1.5 min-h-20"} value={excerpt} onChange={(e) => setExcerpt(e.target.value)} /></label>
      <HtmlEditor label="Content" value={content} onChange={setContent} minHeight="min-h-56 sm:min-h-72" helpText="Use Visual for the WordPress-style toolbar or HTML to edit the markup directly." />
      <div className="grid gap-4 sm:grid-cols-2"><label className="block text-sm font-semibold">Publish status<select className={inputClass + " mt-1.5"} value={status} onChange={(e) => setStatus(e.target.value)}><option value="draft">Draft</option><option value="pending">Pending review</option><option value="publish">Publish now</option><option value="private">Private</option></select></label><div><span className="block text-sm font-semibold">Featured image</span><div className="mt-1.5"><ImageUploadField file={image} existing={removeExistingImage ? null : existingImage} altText={imageAlt} onChange={(file) => { setImage(file); if (file) setRemoveExistingImage(false); }} onAltChange={setImageAlt} onRemoveExisting={() => { setExistingImage(null); setRemoveExistingImage(true); setImageAlt(""); }} /></div></div></div>
      {message && <p className="rounded-xl bg-violet-50 px-3 py-2 text-sm text-violet-800">{message}</p>}
      <button disabled={saving} className="min-h-11 w-full rounded-xl bg-violet-700 px-5 py-3 font-bold text-white hover:bg-violet-800 disabled:opacity-50 sm:w-auto">{saving ? (editing ? "Saving…" : "Creating…") : (editing ? "Save article" : "Create article")}</button>
    </form>
  </div>;
}

function Authors({ authors, refresh, loading, error }: { authors: Author[]; refresh: () => void; loading: boolean; error?: string }) {
  const [form, setForm] = useState({ name: "", username: "", email: "", password: "", description: "" }); const [message, setMessage] = useState(""); const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState("");
  const visibleAuthors = authors.filter((item) => `${item.name} ${item.slug || ""} ${item.email || ""}`.toLocaleLowerCase().includes(search.toLocaleLowerCase()));
  async function submit(event: FormEvent) { event.preventDefault(); setSaving(true); setMessage(""); const response = await fetch("/api/admin/authors/", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) }); const body = await response.json(); setSaving(false); if (!response.ok) { setMessage(body.error || "Could not create author"); return; } setMessage("Author created successfully."); setForm({ name: "", username: "", email: "", password: "", description: "" }); refresh(); }
  if (loading) return <AuthorsSkeleton />;
  return <div className="space-y-5 sm:space-y-6"><div><p className="pill text-xs font-bold uppercase tracking-[0.18em] text-violet-700">WordPress users</p><h1 className="mt-1 text-2xl font-extrabold sm:text-3xl">Authors and editors</h1><p className="mt-1 text-sm text-slate-500">Create author profiles without touching existing user records. Administrators and editors who can publish are included.</p></div><div className="grid gap-5 xl:grid-cols-[1fr_1.3fr]"><form onSubmit={submit} className={`${cardClass} space-y-4`}><h2 className="text-lg font-extrabold">Create author</h2>{([['name','Display name'],['username','Username'],['email','Email'],['password','Temporary password']] as const).map(([key, label]) => <label key={key} className="block text-sm font-semibold">{label}{key === "password" ? <PasswordInput value={form[key]} onChange={(value) => setForm({ ...form, [key]: value })} autoComplete="new-password" /> : <input className={`${inputClass} mt-1.5`} type={key === "email" ? "email" : "text"} value={form[key]} onChange={(e) => setForm({ ...form, [key]: e.target.value })} required />}</label>)}<HtmlEditor label="Bio" value={form.description} onChange={(description) => setForm({ ...form, description })} minHeight="min-h-28 sm:min-h-36" helpText="Author bios support the same Visual and HTML modes." />{message && <p className="rounded-xl bg-violet-50 px-3 py-2 text-sm text-violet-800">{message}</p>}<button disabled={saving} className="min-h-11 w-full rounded-xl bg-violet-700 px-5 py-3 font-bold text-white hover:bg-violet-800 disabled:opacity-50 sm:w-auto">{saving ? "Creating…" : "Create author"}</button></form><section className={cardClass}><div className="flex flex-wrap items-end justify-between gap-3"><div><h2 className="text-lg font-extrabold">Existing authors and editors</h2><p className="mt-1 text-xs text-slate-500">{visibleAuthors.length.toLocaleString()} of {authors.length.toLocaleString()} publish-capable users</p></div><input className={`${inputClass} max-w-xs`} placeholder="Search authors" value={search} onChange={(event) => setSearch(event.target.value)} /></div>{error && <p role="alert" className="mt-3 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}<div className="mt-4 max-h-[52rem] divide-y divide-slate-100 overflow-y-auto">{visibleAuthors.map((item) => <div key={item.id} className="flex items-start justify-between gap-3 py-3 first:pt-0"><div className="min-w-0"><p className="break-words font-semibold">{item.name}</p><p className="break-all text-xs text-slate-500">@{item.slug || item.id} {item.email ? `· ${item.email}` : ""}</p></div><span className="shrink-0 rounded-full bg-slate-100 px-2 py-1 text-xs text-slate-500">{item.roles?.[0] || "user"}</span></div>)}{!visibleAuthors.length && <p className="py-6 text-sm text-slate-500">No authors match this search.</p>}</div></section></div></div>;
}

export default function AdminClient({ initialUser }: { initialUser: string | null }) {
  const [tab, setTab] = useState<Tab>("overview"); const [summary, setSummary] = useState<Summary | null>(null); const [summaryError, setSummaryError] = useState(""); const [authors, setAuthors] = useState<Author[]>([]); const [categories, setCategories] = useState<Category[]>([]); const [taxonomyError, setTaxonomyError] = useState(""); const [editingPostId, setEditingPostId] = useState<number | null>(null); const [taxonomiesLoading, setTaxonomiesLoading] = useState(Boolean(initialUser));
  async function loadSummary() { setSummaryError(""); try { const response = await fetch("/api/admin/analytics/", { cache: "no-store" }); if (!response.ok) throw new Error("The analytics service returned an error."); setSummary(await response.json()); } catch (error) { setSummaryError(error instanceof Error ? error.message : "Could not reach the analytics service."); } }
  async function loadTaxonomies() { setTaxonomiesLoading(true); setTaxonomyError(""); try { const [authorResponse, categoryResponse] = await Promise.all([fetch("/api/admin/authors/"), fetch("/api/admin/categories/")]); if (!authorResponse.ok || !categoryResponse.ok) throw new Error("The author or category service returned an error."); setAuthors((await authorResponse.json()).items || []); setCategories((await categoryResponse.json()).items || []); } catch (error) { setTaxonomyError(error instanceof Error ? error.message : "Could not reach the author and category service."); } finally { setTaxonomiesLoading(false); } }
  useEffect(() => {
    if (!initialUser) return;
    let cancelled = false;
    void Promise.all([fetch("/api/admin/analytics/", { cache: "no-store" }), fetch("/api/admin/authors/"), fetch("/api/admin/categories/")]).then(async ([summaryResponse, authorResponse, categoryResponse]) => {
      if (cancelled) return;
      if (summaryResponse.ok) setSummary(await summaryResponse.json()); else setSummaryError("The analytics service returned an error.");
      if (authorResponse.ok) setAuthors((await authorResponse.json()).items || []); else setTaxonomyError("The author service returned an error.");
      if (categoryResponse.ok) setCategories((await categoryResponse.json()).items || []); else setTaxonomyError("The category service returned an error.");
    }).catch(() => { if (!cancelled) { setSummaryError("Could not reach the analytics service."); setTaxonomyError("Could not reach the author and category service."); } }).finally(() => { if (!cancelled) setTaxonomiesLoading(false); });
    return () => { cancelled = true; };
  }, [initialUser]);
  const content = useMemo(() => { if (tab === "overview") return <Overview summary={summary} refresh={loadSummary} error={summaryError} />; if (tab === "articles") return <Articles authors={authors} authorsLoading={taxonomiesLoading} onNew={() => { setEditingPostId(null); setTab("new"); }} onEdit={(id) => { setEditingPostId(id); setTab("edit"); }} />; if (tab === "new" || tab === "edit") return <NewArticle editId={tab === "edit" ? editingPostId : null} authors={authors} categories={categories} taxonomiesLoading={taxonomiesLoading} onCreated={() => { setEditingPostId(null); setTab("articles"); }} onCategoryCreated={loadTaxonomies} />; return <Authors authors={authors} refresh={loadTaxonomies} loading={taxonomiesLoading} error={taxonomyError} />; }, [tab, summary, summaryError, authors, categories, editingPostId, taxonomiesLoading, taxonomyError]);
  if (!initialUser) return <Login />;
  return <AdminShell tab={tab} setTab={setTab} onLogout={async () => { await fetch("/api/admin/logout/", { method: "POST", cache: "no-store", credentials: "same-origin" }); window.location.replace("/admin/"); }}>{content}</AdminShell>;
}
