"use client";

import { FormEvent, KeyboardEvent, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import FeaturedVideoCard, { noVideo, videoKey, videoPayload, type VideoChoice } from "./ArticleVideo";
import SeoCard, { keywordIdeas, type SeoFields } from "./ArticleSeo";
import { CardTitle, FieldLabel } from "./form-parts";
import HtmlEditor from "./HtmlEditor";
import { Icon, type IconName } from "./icons";
import { cardClass, inputClass, Skeleton, stripHtml, type Author, type Category } from "./ui";

type PostDetail = {
  title?: { raw?: string; rendered?: string };
  content?: { raw?: string; rendered?: string };
  excerpt?: { raw?: string; rendered?: string };
  status?: string;
  date?: string;
  author?: number;
  categories?: number[];
  featured_media?: number;
  meta?: Record<string, unknown>;
  _embedded?: { "wp:featuredmedia"?: { id?: number; source_url: string; alt_text?: string }[] };
};

type FeaturedVideoInfo = { available: boolean; source: "" | "self" | "embed"; embedUrl: string; mediaId: number; url: string; message?: string };

const noSeo: SeoFields = { focusKeyword: "", title: "", description: "" };
const metaText = (meta: Record<string, unknown> | undefined, key: string) => (typeof meta?.[key] === "string" ? meta[key] as string : "");

const EXCERPT_GUIDE = 300;
const MAX_TAGS = 20;

function FormSkeleton() {
  return <div aria-busy="true" aria-label="Loading article editor" className="space-y-5">
    <div className="space-y-2"><Skeleton className="h-4 w-40" /><Skeleton className="h-9 w-56" /><Skeleton className="h-4 w-96 max-w-full" /></div>
    <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_380px]">
      <div className={`${cardClass} space-y-5`}><Skeleton className="h-11 w-full" /><div className="grid gap-4 sm:grid-cols-2"><Skeleton className="h-11 w-full" /><Skeleton className="h-11 w-full" /></div><Skeleton className="h-24 w-full" /><Skeleton className="h-72 w-full" /></div>
      <div className="space-y-5"><div className={`${cardClass} space-y-4`}><Skeleton className="h-8 w-32" /><Skeleton className="h-11 w-full" /><Skeleton className="h-11 w-full" /></div><div className={cardClass}><Skeleton className="h-48 w-full" /></div></div>
    </div>
  </div>;
}

function SearchableSelect({ label, icon, required, value, options, placeholder, onChange, loading = false }: { label: string; icon: IconName; required?: boolean; value: string; options: { value: string; label: string; searchText?: string }[]; placeholder: string; onChange: (value: string) => void; loading?: boolean }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const ref = useRef<HTMLDivElement>(null);
  const selected = options.find((option) => option.value === value);
  const filtered = options.filter((option) => `${option.label} ${option.searchText || ""}`.toLocaleLowerCase().includes(query.toLocaleLowerCase()));
  useEffect(() => {
    if (!open) return;
    const close = (event: MouseEvent | globalThis.KeyboardEvent) => { if (event instanceof globalThis.KeyboardEvent ? event.key === "Escape" : !ref.current?.contains(event.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", close);
    return () => { document.removeEventListener("mousedown", close); document.removeEventListener("keydown", close); };
  }, [open]);
  return <div ref={ref} className="relative">
    <FieldLabel required={required}>{label}</FieldLabel>
    <button type="button" disabled={loading} aria-haspopup="listbox" aria-expanded={open} onClick={() => setOpen((current) => !current)} className={`${inputClass} mt-2 items-center gap-3 text-left disabled:cursor-wait`}>
      <Icon name={icon} className="h-5 w-5 shrink-0 text-slate-500" />
      <span className={`min-w-0 flex-1 truncate ${selected ? "text-slate-900" : "text-slate-400"}`}>{loading ? "Loading options…" : selected?.label || placeholder}</span>
      <Icon name="chevronDown" className="h-4 w-4 shrink-0 text-slate-500" strokeWidth={2} />
    </button>
    {open && <div className="absolute inset-x-0 top-[calc(100%+0.35rem)] z-30 overflow-hidden rounded-xl border border-slate-200 bg-white p-2 shadow-xl">
      <input autoFocus className={inputClass} placeholder={`Search ${label.toLocaleLowerCase()}…`} value={query} onChange={(event) => setQuery(event.target.value)} />
      <div className="mt-2 max-h-[45vh] overflow-y-auto sm:max-h-56" role="listbox">
        <button type="button" role="option" aria-selected={!value} onClick={() => { onChange(""); setQuery(""); setOpen(false); }} className="block min-h-11 w-full rounded-lg px-3 py-2 text-left text-sm text-slate-400 hover:bg-slate-50">{placeholder}</button>
        {filtered.map((option) => <button type="button" role="option" aria-selected={option.value === value} key={option.value} onClick={() => { onChange(option.value); setQuery(""); setOpen(false); }} className={`block min-h-11 w-full rounded-lg px-3 py-2 text-left text-sm hover:bg-violet-50 ${option.value === value ? "bg-violet-50 font-semibold text-violet-800" : "text-slate-700"}`}>{option.label}</button>)}
        {!filtered.length && <p className="px-3 py-3 text-sm text-slate-500">No matches found.</p>}
      </div>
    </div>}
  </div>;
}

function IconSelect({ label, icon, value, onChange, disabled = false, title, children }: { label: string; icon: IconName; value: string; onChange: (value: string) => void; disabled?: boolean; title?: string; children: React.ReactNode }) {
  return <label className="block">
    <span className="block text-sm font-semibold text-slate-900">{label}</span>
    <span className="relative mt-2 block" title={title}>
      <Icon name={icon} className="pointer-events-none absolute left-3.5 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-500" />
      <select disabled={disabled} value={value} onChange={(event) => onChange(event.target.value)} className={`${inputClass} appearance-none pl-11 pr-10`}>{children}</select>
      <Icon name="chevronDown" className="pointer-events-none absolute right-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" strokeWidth={2} />
    </span>
  </label>;
}

function TagInput({ tags, onChange }: { tags: string[]; onChange: (tags: string[]) => void }) {
  const [draft, setDraft] = useState("");
  function add(raw: string) {
    const incoming = raw.split(",").map((tag) => tag.trim()).filter(Boolean);
    if (!incoming.length) return;
    const next = [...tags];
    for (const name of incoming) if (next.length < MAX_TAGS && !next.some((tag) => tag.toLocaleLowerCase() === name.toLocaleLowerCase())) next.push(name.slice(0, 100));
    onChange(next);
    setDraft("");
  }
  function onKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.nativeEvent.isComposing) return; // an IME (Malayalam keyboards) is still composing this character
    if (event.key === "Enter" || event.key === ",") { event.preventDefault(); add(draft); }
    else if (event.key === "Backspace" && !draft && tags.length) onChange(tags.slice(0, -1));
  }
  return <div>
    <FieldLabel>Tags</FieldLabel>
    <div className="mt-2 flex items-start gap-3">
      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-violet-50 text-violet-600"><Icon name="tag" className="h-5 w-5" /></span>
      <div className="flex min-h-11 min-w-0 flex-1 flex-wrap items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-2.5 py-1.5 transition focus-within:border-violet-500 focus-within:ring-4 focus-within:ring-violet-100">
        {tags.map((tag) => <span key={tag} className="inline-flex max-w-full items-center gap-1 rounded-lg bg-violet-50 py-1 pl-2.5 pr-1 text-sm text-violet-800"><span className="truncate">{tag}</span><button type="button" aria-label={`Remove tag ${tag}`} onClick={() => onChange(tags.filter((item) => item !== tag))} className="flex h-6 w-6 items-center justify-center rounded-md hover:bg-violet-100"><Icon name="close" className="h-3.5 w-3.5" strokeWidth={2.2} /></button></span>)}
        <input aria-label="Add a tag" value={draft} onChange={(event) => setDraft(event.target.value)} onKeyDown={onKeyDown} onBlur={() => add(draft)} disabled={tags.length >= MAX_TAGS} placeholder={tags.length ? "" : "Add tags and press Enter…"} className="min-h-8 min-w-32 flex-1 bg-transparent px-1 text-sm outline-none placeholder:text-slate-400" />
      </div>
    </div>
    <p className="mt-1.5 pl-14 text-xs text-slate-500">Separate tags with commas or press Enter.</p>
  </div>;
}

/* eslint-disable @next/next/no-img-element -- blob previews are local browser files, not app images */
function FeaturedImage({ file, altText, existing, onChange, onAltChange, onRemoveExisting }: { file: File | null; altText: string; existing?: { url: string; alt: string } | null; onChange: (file: File | null) => void; onAltChange: (value: string) => void; onRemoveExisting?: () => void }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  useEffect(() => { const url = file ? URL.createObjectURL(file) : null; let active = true; queueMicrotask(() => { if (active) setPreview(url); }); return () => { active = false; if (url) URL.revokeObjectURL(url); }; }, [file]);
  const shown = file ? preview : existing?.url;
  function accept(next?: File) { if (next?.type.startsWith("image/")) onChange(next); }
  return <div>
    <input ref={inputRef} className="hidden" type="file" accept="image/*" onChange={(event) => { accept(event.target.files?.[0]); event.target.value = ""; }} />
    {shown ? <div className="space-y-3">
      <img src={shown} alt={file ? "Selected featured image preview" : existing?.alt || "Current featured image"} className="h-44 w-full rounded-xl border border-slate-200 bg-slate-50 object-cover" />
      {file && <p className="break-all text-xs text-slate-500">{file.name} · {Math.ceil(file.size / 1024)} KB</p>}
      <label className="block text-sm font-semibold">Image alt text<input className={`${inputClass} mt-1.5`} value={altText} onChange={(event) => onAltChange(event.target.value)} placeholder="Describe the image" /></label>
      <div className="flex gap-2">
        <button type="button" onClick={() => inputRef.current?.click()} className="min-h-10 flex-1 rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold hover:bg-slate-50">Replace</button>
        <button type="button" onClick={() => { if (file) { onChange(null); onAltChange(""); } else onRemoveExisting?.(); }} className="min-h-10 flex-1 rounded-xl border border-red-200 bg-white px-3 text-sm font-semibold text-red-700 hover:bg-red-50">Remove</button>
      </div>
    </div> : <div onClick={() => inputRef.current?.click()} onDragOver={(event) => { event.preventDefault(); setDragging(true); }} onDragLeave={() => setDragging(false)} onDrop={(event) => { event.preventDefault(); setDragging(false); accept(event.dataTransfer.files?.[0]); }} className={`flex cursor-pointer flex-col items-center rounded-2xl border-2 border-dashed px-4 py-7 text-center transition ${dragging ? "border-violet-500 bg-violet-50" : "border-slate-300 bg-slate-50/50 hover:border-violet-400"}`}>
      <span className="flex h-14 w-14 items-center justify-center rounded-full bg-slate-100 text-slate-600"><Icon name="image" className="h-7 w-7" /></span>
      <p className="mt-3 text-sm font-semibold text-slate-900">Choose a featured image</p>
      <p className="mt-1 text-xs text-slate-500">Drag &amp; drop an image here, or click to browse</p>
      <p className="mt-0.5 text-[11px] text-slate-400">PNG, JPG or WebP · up to 10 MB</p>
      <button type="button" className="mt-4 flex min-h-10 items-center gap-2 rounded-xl border border-violet-300 bg-white px-4 text-sm font-semibold text-violet-700 hover:bg-violet-50"><Icon name="upload" className="h-4 w-4" />Select image</button>
    </div>}
  </div>;
}
/* eslint-enable @next/next/no-img-element */

/* eslint-disable @next/next/no-img-element -- the preview image may be a local blob */
function PreviewDialog({ title, excerpt, content, imageUrl, onClose }: { title: string; excerpt: string; content: string; imageUrl?: string | null; onClose: () => void }) {
  useEffect(() => {
    const onKey = (event: globalThis.KeyboardEvent) => { if (event.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);
  // The body is the editor's own HTML, so it is rendered in a script-less sandbox, never in the admin page itself.
  // Embedded players cannot run inside the script-less sandbox, so they are shown as a note instead of a blocked frame.
  const body = content.replace(/<iframe\b[^>]*>\s*<\/iframe>/gi, "<p style='padding:28px 16px;background:#f1f5f9;border-radius:8px;color:#475569;text-align:center'>▶ Embedded video — it plays on the published article.</p>");
  const srcDoc = `<!doctype html><meta charset="utf-8"><style>body{font:16px/1.8 system-ui,sans-serif;color:#1e293b;margin:0}img,video,iframe{max-width:100%;height:auto}blockquote{border-left:4px solid #c4b5fd;margin:1em 0;padding:.25em 1em;color:#475569}pre{background:#f1f5f9;padding:12px;overflow:auto;border-radius:8px}a{color:#6d28d9}h2,h3{line-height:1.3}</style>${body || "<p style='color:#94a3b8'>Nothing written yet.</p>"}`;
  return createPortal(<div className="fixed inset-0 z-[200] flex items-center justify-center bg-slate-900/50 p-3 sm:p-6" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
    <div role="dialog" aria-modal="true" aria-label="Article preview" className="flex max-h-[92vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
      <div className="flex items-center justify-between border-b border-slate-200 px-5 py-3"><h2 className="text-base font-bold">Preview</h2><button type="button" aria-label="Close preview" onClick={onClose} className="flex h-10 w-10 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100"><Icon name="close" /></button></div>
      <div className="overflow-y-auto p-5 sm:p-8">
        <h1 className="text-2xl font-extrabold leading-snug text-[#12093a] sm:text-3xl">{title || "Untitled article"}</h1>
        {excerpt && <p className="mt-3 text-base italic text-slate-600">{excerpt}</p>}
        {imageUrl && <img src={imageUrl} alt="" className="mt-5 max-h-96 w-full rounded-xl object-cover" />}
        <iframe title="Article body preview" sandbox="" srcDoc={srcDoc} className="mt-5 h-[50vh] w-full rounded-lg border border-slate-200" />
      </div>
    </div>
  </div>, document.body);
}
/* eslint-enable @next/next/no-img-element */

export default function NewArticle({ authors, categories, taxonomiesLoading, editId, publishOnOpen = false, onCreated, onCancel, onCategoryCreated }: { authors: Author[]; categories: Category[]; taxonomiesLoading: boolean; editId?: number | null; publishOnOpen?: boolean; onCreated: (notice?: string) => void; onCancel: () => void; onCategoryCreated: () => Promise<void> }) {
  const editing = Boolean(editId);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [excerpt, setExcerpt] = useState("");
  const [status, setStatus] = useState("draft");
  const [visibility, setVisibility] = useState("public");
  const [publishDate, setPublishDate] = useState("");
  const [publishTime, setPublishTime] = useState("");
  const [dateTouched, setDateTouched] = useState(false);
  const [author, setAuthor] = useState("");
  const [category, setCategory] = useState("");
  const [initialCategory, setInitialCategory] = useState("");
  const [existingCategoryIds, setExistingCategoryIds] = useState<number[]>([]);
  const [newCategory, setNewCategory] = useState("");
  const [tags, setTags] = useState<string[]>([]);
  const [initialTags, setInitialTags] = useState<string[]>([]);
  const [image, setImage] = useState<File | null>(null);
  const [imageAlt, setImageAlt] = useState("");
  const [existingImage, setExistingImage] = useState<{ url: string; alt: string } | null>(null);
  const [existingMediaId, setExistingMediaId] = useState(0);
  const [removeExistingImage, setRemoveExistingImage] = useState(false);
  const [seo, setSeo] = useState<SeoFields>(noSeo);
  const [initialSeo, setInitialSeo] = useState<SeoFields>(noSeo);
  const [video, setVideo] = useState<VideoChoice>(noVideo);
  const [initialVideoKey, setInitialVideoKey] = useState("none");
  const [videoUnavailable, setVideoUnavailable] = useState("");
  const [videoUploading, setVideoUploading] = useState(false);
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);
  const [loadingPost, setLoadingPost] = useState(editing);
  const [creatingCategory, setCreatingCategory] = useState(false);
  const [previewing, setPreviewing] = useState(false);
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [openedAt] = useState(() => Date.now());

  useEffect(() => {
    if (!editId) return;
    let cancelled = false;
    void fetch("/api/admin/posts/?id=" + editId, { cache: "no-store" }).then(async (response) => {
      const body = await response.json().catch(() => ({}));
      if (cancelled) return;
      if (!response.ok || !body.item) { setMessage(body.error || "Could not load article"); setLoadingPost(false); return; }
      const item = body.item as PostDetail;
      const stored = item.status || "draft";
      setTitle(item.title?.raw || stripHtml(item.title?.rendered || ""));
      setContent(item.content?.raw || item.content?.rendered || "");
      setExcerpt(item.excerpt?.raw || item.excerpt?.rendered || "");
      // Private and scheduled posts are both "publish" here, told apart by visibility and date.
      setStatus(publishOnOpen || stored === "private" || stored === "future" ? "publish" : ["draft", "pending", "publish"].includes(stored) ? stored : "draft");
      setVisibility(stored === "private" ? "private" : "public");
      if (["publish", "future", "private"].includes(stored) && item.date) { setPublishDate(item.date.slice(0, 10)); setPublishTime(item.date.slice(11, 16)); }
      setAuthor(item.author ? String(item.author) : "");
      setCategory(item.categories?.[0] ? String(item.categories[0]) : "");
      setInitialCategory(item.categories?.[0] ? String(item.categories[0]) : "");
      setExistingCategoryIds(item.categories || []);
      const loadedTags = Array.isArray(body.tags) ? body.tags as string[] : [];
      setTags(loadedTags); setInitialTags(loadedTags);
      const media = item._embedded?.["wp:featuredmedia"]?.[0];
      setExistingMediaId(Number(item.featured_media || media?.id || 0));
      setExistingImage(media?.source_url ? { url: media.source_url, alt: media.alt_text || "" } : null);
      setImageAlt(media?.alt_text || "");
      const loadedSeo = { focusKeyword: metaText(item.meta, "_yoast_wpseo_focuskw"), title: metaText(item.meta, "_yoast_wpseo_title"), description: metaText(item.meta, "_yoast_wpseo_metadesc") };
      setSeo(loadedSeo); setInitialSeo(loadedSeo);
      const loadedVideo = body.featuredVideo as FeaturedVideoInfo | undefined;
      if (loadedVideo && !loadedVideo.available) setVideoUnavailable(loadedVideo.message || "The featured video could not be loaded for this article.");
      const choice: VideoChoice = loadedVideo?.source === "embed" ? { mode: "url", url: loadedVideo.embedUrl, media: null }
        : loadedVideo?.source === "self" ? { mode: "upload", url: "", media: { id: loadedVideo.mediaId, url: loadedVideo.url, name: decodeURIComponent(loadedVideo.url.split("/").pop() || "Uploaded video") } }
        : noVideo;
      setVideo(choice); setInitialVideoKey(videoKey(choice));
      setLoadingPost(false);
    }).catch(() => { if (!cancelled) { setMessage("Could not reach the article service"); setLoadingPost(false); } });
    return () => { cancelled = true; };
  }, [editId, publishOnOpen]);

  const authorOptions = authors.map((item) => ({ value: String(item.id), label: item.name, searchText: item.slug }));
  const categoryOptions = categories.map((item) => ({ value: String(item.id), label: stripHtml(item.name), searchText: String(item.count) }));

  async function createCategory() {
    if (!newCategory.trim()) return;
    setCreatingCategory(true); setMessage("");
    const response = await fetch("/api/admin/categories/", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: newCategory.trim() }) });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) setMessage(body.error || "Could not create category");
    else { await onCategoryCreated(); setCategory(String(body.item.id)); setNewCategory(""); setMessage("Category created and selected."); }
    setCreatingCategory(false);
  }

  function openPreview() {
    setPreviewImage(image ? URL.createObjectURL(image) : removeExistingImage ? null : existingImage?.url ?? null);
    setPreviewing(true);
  }
  function closePreview() {
    setPreviewing(false);
    setPreviewImage((current) => { if (current?.startsWith("blob:")) URL.revokeObjectURL(current); return null; });
  }

  async function submit(event: FormEvent) {
    event.preventDefault(); setMessage("");
    if (dateTouched && !publishDate) { setMessage("Choose a date to schedule this article, or clear the schedule."); return; }
    const currentVideoKey = videoKey(video);
    if (currentVideoKey === "invalid") { setMessage("The featured video link must be a YouTube, Vimeo or Dailymotion address. Fix it or clear it."); return; }
    setSaving(true);
    const form = new FormData();
    form.set("title", title); form.set("content", content); form.set("excerpt", excerpt);
    // “Private” only means something once the article is published.
    form.set("status", status === "publish" && visibility === "private" ? "private" : status);
    if (dateTouched) form.set("date", `${publishDate}T${publishTime || "00:00"}:00`);
    if (author) form.set("author", author);
    const selectedCategory = category ? Number(category) : 0;
    const preservedCategories = existingCategoryIds.filter((id) => String(id) !== initialCategory && id !== selectedCategory);
    form.set("categories", JSON.stringify(selectedCategory ? [selectedCategory, ...preservedCategories] : preservedCategories));
    if (editing ? tags.join("\n") !== initialTags.join("\n") : tags.length) form.set("tags", JSON.stringify(tags));
    if (image) form.set("featuredImage", image);
    form.set("featuredImageAlt", imageAlt);
    if (existingMediaId) form.set("existingFeaturedMedia", String(existingMediaId));
    if (removeExistingImage) form.set("removeFeaturedImage", "true");
    // Only what changed is sent, so saving never rewrites SEO or video settings the editor did not touch.
    const changedSeo = Object.fromEntries((Object.keys(seo) as (keyof SeoFields)[]).filter((field) => seo[field] !== initialSeo[field]).map((field) => [field, seo[field]]));
    if (Object.keys(changedSeo).length) form.set("seo", JSON.stringify(changedSeo));
    const videoChange = currentVideoKey !== initialVideoKey ? videoPayload(video) : null;
    if (videoChange) form.set("featuredVideo", videoChange);
    const response = await fetch(editing ? "/api/admin/posts/?id=" + editId : "/api/admin/posts/", { method: editing ? "PUT" : "POST", body: form });
    const body = await response.json().catch(() => ({}));
    setSaving(false);
    if (!response.ok) { setMessage(body.error || (editing ? "Could not update article" : "Could not create article")); return; }
    const warnings = Array.isArray(body.warnings) ? (body.warnings as string[]).join(" ") : "";
    setMessage(editing ? "Article updated successfully." : "Article created successfully.");
    onCreated(warnings || undefined);
  }

  if (loadingPost) return <FormSkeleton />;

  const scheduled = status === "publish" && visibility === "public" && Boolean(publishDate) && new Date(`${publishDate}T${publishTime || "00:00"}`).getTime() > openedAt;
  const actionLabel = saving
    ? (scheduled ? "Scheduling…" : editing ? "Saving…" : status === "publish" ? "Publishing…" : "Creating…")
    : scheduled
      ? (editing ? "Update schedule" : "Schedule article")
      : editing
        ? status === "publish" ? "Update & publish" : "Save article"
        : status === "publish" ? "Publish article" : "Create draft";

  return <div className="space-y-5 sm:space-y-6">
    <div>
      <nav aria-label="Breadcrumb" className="flex items-center gap-1.5 text-sm text-slate-500">
        <button type="button" onClick={onCancel} className="flex items-center gap-1 rounded-md hover:text-violet-700"><Icon name="chevronLeft" className="h-4 w-4" strokeWidth={2} />Articles</button>
        <Icon name="chevronRight" className="h-3.5 w-3.5" strokeWidth={2} /><span className="font-medium text-slate-900">{editing ? "Edit article" : "New article"}</span>
      </nav>
      <p className="pill mt-4 text-xs font-bold uppercase tracking-[0.18em] text-violet-700">WordPress posts</p>
      <h1 className="mt-2 text-2xl font-extrabold text-[#12093a] sm:text-3xl">{editing ? "Edit article" : "Create article"}</h1>
      <p className="mt-1.5 text-sm text-slate-500">{editing ? "Update the existing WordPress article while keeping its permalink and history." : "Create and publish a new article with SEO details, tags, a featured image and video."}</p>
    </div>

    <form onSubmit={submit}>
      <div className="grid grid-cols-[minmax(0,1fr)] items-start gap-5 xl:grid-cols-[minmax(0,1fr)_380px]">
        <div className="min-w-0 space-y-5">
        <div className={`${cardClass} space-y-5`}>
          <label className="block"><FieldLabel required>Title</FieldLabel><input className={`${inputClass} mt-2`} value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Enter a clear and descriptive title for your article…" required /></label>
          <div className="grid gap-4 sm:grid-cols-2">
            <SearchableSelect label="Author" icon="user" value={author} options={authorOptions} placeholder="Choose author" onChange={setAuthor} loading={taxonomiesLoading} />
            <div>
              <SearchableSelect label="Category" icon="folder" value={category} options={categoryOptions} placeholder="Choose category" onChange={setCategory} loading={taxonomiesLoading} />
              <div className="mt-2 flex gap-2">
                <input className={inputClass} aria-label="New category name" placeholder="Or create new category" value={newCategory} onChange={(event) => setNewCategory(event.target.value)} />
                <button type="button" onClick={() => void createCategory()} disabled={creatingCategory || taxonomiesLoading || !newCategory.trim()} className="min-h-11 shrink-0 rounded-xl border border-violet-300 bg-white px-4 text-sm font-semibold text-violet-700 transition hover:bg-violet-50 disabled:border-slate-200 disabled:text-slate-400 disabled:hover:bg-white">{creatingCategory ? "…" : "Create"}</button>
              </div>
            </div>
          </div>
          <label className="block"><FieldLabel>Excerpt</FieldLabel>
            <span className="relative mt-2 block">
              <Icon name="doc" className="pointer-events-none absolute left-3.5 top-3.5 h-5 w-5 text-slate-500" />
              <textarea className={`${inputClass} min-h-28 pb-8 pl-11`} value={excerpt} onChange={(event) => setExcerpt(event.target.value)} placeholder="Write a short summary of your article (optional)…" />
              <span className={`pointer-events-none absolute bottom-2.5 right-3.5 text-xs ${excerpt.length > EXCERPT_GUIDE ? "text-amber-600" : "text-slate-500"}`}>{excerpt.length}/{EXCERPT_GUIDE}</span>
            </span>
          </label>
          <HtmlEditor label="Content" required value={content} onChange={setContent} minHeight="min-h-56 sm:min-h-72" />
          <TagInput tags={tags} onChange={setTags} />
        </div>
        <SeoCard values={seo} ideas={keywordIdeas(title, tags, stripHtml(categories.find((item) => String(item.id) === category)?.name ?? ""))} onChange={(patch) => setSeo((current) => ({ ...current, ...patch }))} />
        </div>

        <div className="space-y-5">
          <section className={`${cardClass} space-y-4`}>
            <CardTitle icon="calendar">Publish</CardTitle>
            <IconSelect label="Status" icon="doc" value={status} onChange={setStatus}>
              <option value="draft">Save as draft</option><option value="pending">Submit for review</option><option value="publish">Publish</option>
            </IconSelect>
            <IconSelect label="Visibility" icon="globe" value={visibility} onChange={setVisibility} disabled={status !== "publish"} title={status !== "publish" ? "Visibility applies once the article is published" : undefined}>
              <option value="public">Public</option><option value="private">Private</option>
            </IconSelect>
            <div>
              <div className="flex items-center justify-between"><span className="block text-sm font-semibold text-slate-900">{publishDate ? "Publish on" : "Publish immediately"}</span>{dateTouched && <button type="button" onClick={() => { setDateTouched(false); setPublishDate(""); setPublishTime(""); }} className="text-xs font-semibold text-violet-700 hover:underline">Clear</button>}</div>
              <div className="mt-2 flex min-h-11 items-center gap-2 rounded-xl border border-slate-200 bg-white px-3.5 transition focus-within:border-violet-500 focus-within:ring-4 focus-within:ring-violet-100">
                <Icon name="calendar" className="h-5 w-5 shrink-0 text-slate-500" />
                <input type="date" aria-label="Publish date" value={publishDate} onChange={(event) => { setPublishDate(event.target.value); setDateTouched(true); }} className="min-w-0 flex-1 bg-transparent py-2 text-sm outline-none" />
                <input type="time" aria-label="Publish time" value={publishTime} onChange={(event) => { setPublishTime(event.target.value); setDateTouched(true); }} className="w-24 bg-transparent py-2 text-sm outline-none" />
              </div>
              <p className="mt-1.5 text-xs text-slate-500">Leave empty to publish right away. Times use the WordPress site time zone.</p>
              {status === "draft" && editing && <p className="mt-1.5 text-xs text-slate-500">This article stays hidden until you choose “Publish”.</p>}
            </div>
          </section>

          <section className={`${cardClass} space-y-4`}>
            <CardTitle icon="image">Featured image</CardTitle>
            <FeaturedImage file={image} existing={removeExistingImage ? null : existingImage} altText={imageAlt} onChange={(file) => { setImage(file); if (file) setRemoveExistingImage(false); }} onAltChange={setImageAlt} onRemoveExisting={() => { setExistingImage(null); setRemoveExistingImage(true); setImageAlt(""); }} />
          </section>

          <FeaturedVideoCard value={video} onChange={setVideo} onBusyChange={setVideoUploading} unavailable={videoUnavailable} />
        </div>
      </div>

      <div className="sticky bottom-0 z-10 -mx-4 mt-6 border-t border-slate-200/70 bg-white/95 px-4 py-3 backdrop-blur max-lg:bottom-[calc(4rem+env(safe-area-inset-bottom))] sm:-mx-6 sm:px-6 lg:-mx-7 lg:px-7">
        {publishOnOpen && status === "publish" && <p className="mb-2 rounded-xl bg-violet-50 px-3 py-2 text-sm text-violet-800">Review this draft, then use “Update &amp; publish” to make it visible on the site.</p>}
        {message && <p role="status" className="mb-2 rounded-xl bg-violet-50 px-3 py-2 text-sm text-violet-800">{message}</p>}
        <div className="flex items-center justify-between gap-3">
          <button type="button" onClick={onCancel} className="min-h-11 rounded-xl bg-slate-100 px-5 text-sm font-semibold text-slate-800 transition hover:bg-slate-200">Cancel</button>
          <div className="flex items-center gap-3">
            <button type="button" onClick={openPreview} className="flex min-h-11 items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-800 transition hover:bg-slate-50"><Icon name="eye" className="h-[18px] w-[18px]" /><span className="max-sm:sr-only">Preview</span></button>
            <button disabled={saving || videoUploading} className="flex min-h-11 items-center gap-2 rounded-xl bg-[linear-gradient(90deg,#7c3aed,#6d28d9)] px-5 text-sm font-bold text-white shadow-[0_10px_22px_-10px_rgba(109,40,217,0.8)] transition hover:brightness-110 disabled:opacity-60"><Icon name="send" className="h-[18px] w-[18px]" />{actionLabel}</button>
          </div>
        </div>
      </div>
    </form>
    {previewing && <PreviewDialog title={title} excerpt={excerpt} content={content} imageUrl={previewImage} onClose={closePreview} />}
  </div>;
}
