"use client";

import { FormEvent, useEffect, useMemo, useRef, useState } from "react";

type Tab = "overview" | "articles" | "new" | "authors";
type Author = { id: number; name: string; slug?: string; description?: string; email?: string; roles?: string[] };
type Category = { id: number; name: string; count: number };
type Post = { id: number; date: string; status?: string; link?: string; title: { rendered: string }; excerpt?: { rendered: string }; _embedded?: { author?: Author[]; "wp:term"?: { id: number; name: string }[][] } };
type Summary = { views: number; uniqueReaders: number; averageReadingSeconds: number; completionRate: number; daily: { date: string; views: number; readers: number }[]; topArticles: { articleId: number; title: string; path: string; views: number; readers: number; averageReadingSeconds: number; completionRate: number }[] };

const inputClass = "w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none transition focus:border-violet-500 focus:ring-2 focus:ring-violet-100";
const cardClass = "rounded-2xl border border-slate-200 bg-white p-5 shadow-sm";

function stripHtml(value: string): string { return value.replace(/<[^>]*>/g, "").replace(/&[^;]+;/g, " ").trim(); }
function formatDuration(seconds: number): string { if (seconds < 60) return `${seconds}s`; return `${Math.floor(seconds / 60)}m ${seconds % 60}s`; }

type SelectOption = { value: string; label: string; searchText?: string };

function SearchableSelect({ label, value, options, placeholder, onChange }: { label: string; value: string; options: SelectOption[]; placeholder: string; onChange: (value: string) => void }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const selected = options.find((option) => option.value === value);
  const filtered = options.filter((option) => `${option.label} ${option.searchText || ""}`.toLocaleLowerCase().includes(query.toLocaleLowerCase()));
  return <div className="relative">
    <span className="block text-sm font-semibold">{label}</span>
    <button type="button" aria-haspopup="listbox" aria-expanded={open} onClick={() => setOpen((current) => !current)} className={`${inputClass} mt-1.5 flex items-center justify-between gap-3 text-left`}>
      <span className={selected ? "text-slate-900" : "text-slate-400"}>{selected?.label || placeholder}</span><span aria-hidden className="text-slate-400">⌄</span>
    </button>
    {open && <div className="absolute inset-x-0 top-[calc(100%+0.35rem)] z-30 overflow-hidden rounded-xl border border-slate-200 bg-white p-2 shadow-xl">
      <input autoFocus className={inputClass} placeholder={`Search ${label.toLocaleLowerCase()}…`} value={query} onChange={(event) => setQuery(event.target.value)} />
      <div className="mt-2 max-h-56 overflow-y-auto" role="listbox">
        <button type="button" role="option" aria-selected={!value} onClick={() => { onChange(""); setQuery(""); setOpen(false); }} className="block w-full rounded-lg px-3 py-2 text-left text-sm text-slate-400 hover:bg-slate-50">{placeholder}</button>
        {filtered.map((option) => <button type="button" role="option" aria-selected={option.value === value} key={option.value} onClick={() => { onChange(option.value); setQuery(""); setOpen(false); }} className={`block w-full rounded-lg px-3 py-2 text-left text-sm hover:bg-violet-50 ${option.value === value ? "bg-violet-50 font-semibold text-violet-800" : "text-slate-700"}`}>{option.label}</button>)}
        {!filtered.length && <p className="px-3 py-3 text-sm text-slate-500">No matches found.</p>}
      </div>
    </div>}
  </div>;
}

const toolbarButtons: { label: string; command: string; value?: string }[] = [
  { label: "B", command: "bold" }, { label: "I", command: "italic" }, { label: "U", command: "underline" },
  { label: "H2", command: "formatBlock", value: "h2" }, { label: "H3", command: "formatBlock", value: "h3" },
  { label: "• List", command: "insertUnorderedList" }, { label: "1. List", command: "insertOrderedList" }, { label: "Quote", command: "formatBlock", value: "blockquote" },
  { label: "S", command: "strikeThrough" }, { label: "Center", command: "justifyCenter" }, { label: "Right", command: "justifyRight" }, { label: "HR", command: "insertHorizontalRule" },
];

function HtmlEditor({ label, value, onChange, minHeight = "min-h-72", helpText }: { label: string; value: string; onChange: (value: string) => void; minHeight?: string; helpText?: string }) {
  const editorRef = useRef<HTMLDivElement>(null);
  const lastValue = useRef(value);
  const [mode, setMode] = useState<"visual" | "html">("visual");
  useEffect(() => {
    if (lastValue.current !== value && editorRef.current) editorRef.current.innerHTML = value;
    lastValue.current = value;
  }, [value]);
  function run(command: string, commandValue?: string) {
    editorRef.current?.focus();
    if (command === "createLink") { const url = window.prompt("Link URL"); if (url) document.execCommand(command, false, url); }
    else document.execCommand(command, false, commandValue);
    const html = editorRef.current?.innerHTML || ""; lastValue.current = html; onChange(html);
  }
  return <div>
    <div className="flex flex-wrap items-end justify-between gap-2"><span className="block text-sm font-semibold">{label}</span><div className="flex overflow-hidden rounded-lg border border-slate-200 bg-white text-xs font-semibold"><button type="button" onClick={() => setMode("visual")} className={`px-3 py-1.5 ${mode === "visual" ? "bg-violet-700 text-white" : "text-slate-500"}`}>Visual</button><button type="button" onClick={() => setMode("html")} className={`px-3 py-1.5 ${mode === "html" ? "bg-violet-700 text-white" : "text-slate-500"}`}>HTML</button></div></div>
    {mode === "visual" ? <>
      <div className="mt-1.5 flex flex-wrap gap-1 rounded-t-xl border border-b-0 border-slate-200 bg-slate-50 p-2">{toolbarButtons.map((button) => <button type="button" key={button.label} onMouseDown={(event) => event.preventDefault()} onClick={() => run(button.command, button.value)} className="rounded-lg border border-transparent px-2.5 py-1.5 text-xs font-semibold text-slate-600 hover:border-slate-200 hover:bg-white">{button.label}</button>)}<button type="button" onMouseDown={(event) => event.preventDefault()} onClick={() => run("createLink")} className="rounded-lg border border-transparent px-2.5 py-1.5 text-xs font-semibold text-slate-600 hover:border-slate-200 hover:bg-white">Link</button><button type="button" onMouseDown={(event) => event.preventDefault()} onClick={() => run("removeFormat")} className="rounded-lg border border-transparent px-2.5 py-1.5 text-xs text-slate-500 hover:border-slate-200 hover:bg-white">Clear</button></div>
      <div ref={editorRef} contentEditable suppressContentEditableWarning onInput={(event) => { const html = event.currentTarget.innerHTML; lastValue.current = html; onChange(html); }} className={`${minHeight} rounded-b-xl border border-slate-200 bg-white px-4 py-3 text-sm leading-relaxed outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-100`} />
    </> : <textarea className={`${inputClass} mt-1.5 ${minHeight} font-mono text-xs`} value={value} onChange={(event) => onChange(event.target.value)} />}
    {helpText && <p className="mt-1.5 text-xs text-slate-500">{helpText}</p>}
  </div>;
}

/* eslint-disable @next/next/no-img-element -- blob previews are local browser files, not app images */
function ImageUploadField({ file, altText, onChange, onAltChange }: { file: File | null; altText: string; onChange: (file: File | null) => void; onAltChange: (value: string) => void }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(null);
  useEffect(() => { const url = file ? URL.createObjectURL(file) : null; let active = true; queueMicrotask(() => { if (active) setPreview(url); }); return () => { active = false; if (url) URL.revokeObjectURL(url); }; }, [file]);
  return <div className="rounded-2xl border-2 border-dashed border-slate-300 bg-slate-50 p-4 transition hover:border-violet-400">
    <input ref={inputRef} className="hidden" type="file" accept="image/*" onChange={(event) => onChange(event.target.files?.[0] || null)} />
    {file && preview ? <div className="grid gap-4 sm:grid-cols-[180px_1fr] sm:items-start"><img src={preview} alt="Selected featured image preview" className="h-32 w-full rounded-xl border border-slate-200 bg-white object-cover sm:h-36" /><div><p className="break-all text-sm font-semibold text-slate-800">{file.name}</p><p className="mt-1 text-xs text-slate-500">{Math.ceil(file.size / 1024)} KB · {file.type || "image"}</p><label className="mt-3 block text-sm font-semibold">Image alt text<input className={`${inputClass} mt-1.5`} value={altText} onChange={(event) => onAltChange(event.target.value)} placeholder="Describe the image" /></label><div className="mt-3 flex gap-2"><button type="button" onClick={() => inputRef.current?.click()} className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold">Replace</button><button type="button" onClick={() => { onChange(null); onAltChange(""); }} className="rounded-lg border border-red-200 bg-white px-3 py-2 text-xs font-semibold text-red-700">Remove</button></div></div></div> : <button type="button" onClick={() => inputRef.current?.click()} className="flex min-h-32 w-full flex-col items-center justify-center rounded-xl border border-slate-200 bg-white px-4 py-6 text-center hover:bg-violet-50"><span className="text-2xl">＋</span><span className="mt-2 text-sm font-bold text-slate-700">Choose a detailed image</span><span className="mt-1 text-xs text-slate-500">PNG, JPG or WebP · up to 10 MB</span></button>}
  </div>;
}
/* eslint-enable @next/next/no-img-element */

function Login() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  async function submit(event: FormEvent) {
    event.preventDefault(); setError(""); setLoading(true);
    const response = await fetch("/api/admin/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ username, password }) });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) setError(body.error || "Login failed"); else window.location.reload();
    setLoading(false);
  }
  return <div className="fixed inset-0 z-[100] flex min-h-screen items-center justify-center overflow-auto bg-[#170826] px-4 py-10 text-white">
    <div className="w-full max-w-md rounded-3xl border border-white/10 bg-white p-7 text-slate-900 shadow-2xl sm:p-9">
      <div className="mb-8"><p className="pill text-xs font-bold uppercase tracking-[0.2em] text-violet-700">Islamonlive</p><h1 className="mt-2 text-3xl font-extrabold">Admin workspace</h1><p className="mt-2 text-sm text-slate-500">Sign in with your existing WordPress admin account.</p></div>
      <form onSubmit={submit} className="space-y-4">
        <label className="block text-sm font-semibold">WordPress username<input className={`${inputClass} mt-1.5`} value={username} onChange={(e) => setUsername(e.target.value)} autoComplete="username" required /></label>
        <label className="block text-sm font-semibold">WordPress password<input className={`${inputClass} mt-1.5`} type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" required /></label>
        {error && <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
        <button className="w-full rounded-xl bg-violet-700 px-4 py-3 font-bold text-white transition hover:bg-violet-800 disabled:opacity-50" disabled={loading}>{loading ? "Connecting…" : "Sign in"}</button>
      </form>
      <p className="mt-6 text-xs leading-relaxed text-slate-500">Your credentials are sent only to the WordPress origin through this server. They are not stored in the browser.</p>
    </div>
  </div>;
}

function AdminShell({ user, children, tab, setTab, onLogout }: { user: string; children: React.ReactNode; tab: Tab; setTab: (tab: Tab) => void; onLogout: () => void }) {
  const items: { key: Tab; label: string }[] = [{ key: "overview", label: "Overview" }, { key: "articles", label: "Articles" }, { key: "new", label: "New article" }, { key: "authors", label: "Authors" }];
  return <div className="fixed inset-0 z-[100] overflow-auto bg-slate-50 text-slate-900">
    <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/95 backdrop-blur"><div className="mx-auto flex max-w-[1500px] items-center justify-between gap-4 px-4 py-3 sm:px-8"><div><p className="pill text-[10px] font-bold uppercase tracking-[0.2em] text-violet-700">Islamonlive</p><p className="text-lg font-extrabold">Content admin</p></div><div className="flex items-center gap-3"><span className="hidden text-sm text-slate-500 sm:block">{user}</span><button className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold hover:bg-slate-50" onClick={onLogout}>Log out</button></div></div></header>
    <div className="mx-auto grid max-w-[1500px] gap-6 px-4 py-6 sm:px-8 lg:grid-cols-[220px_1fr]"><nav className="flex gap-2 overflow-auto lg:block lg:space-y-1">{items.map((item) => <button key={item.key} onClick={() => setTab(item.key)} className={`whitespace-nowrap rounded-xl px-4 py-3 text-left text-sm font-semibold transition lg:block lg:w-full ${tab === item.key ? "bg-violet-700 text-white shadow-sm" : "text-slate-600 hover:bg-white hover:text-slate-900"}`}>{item.label}</button>)}</nav><main className="min-w-0">{children}</main></div>
  </div>;
}

function Overview({ summary, refresh }: { summary: Summary | null; refresh: () => void }) {
  if (!summary) return <div className={cardClass}><p className="text-sm text-slate-500">Loading analytics…</p></div>;
  return <div className="space-y-6"><div className="flex flex-wrap items-end justify-between gap-3"><div><p className="pill text-xs font-bold uppercase tracking-[0.18em] text-violet-700">Last 30 days</p><h1 className="mt-1 text-3xl font-extrabold">Reader analytics</h1><p className="mt-1 text-sm text-slate-500">Anonymous readers, article views and reading depth from this Next.js site.</p></div><button onClick={refresh} className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold hover:bg-slate-50">Refresh</button></div>
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{[["Views", summary.views.toLocaleString()], ["Unique readers", summary.uniqueReaders.toLocaleString()], ["Avg. reading time", formatDuration(summary.averageReadingSeconds)], ["Completion", `${summary.completionRate}%`]].map(([label, value]) => <div className={cardClass} key={label}><p className="text-sm text-slate-500">{label}</p><p className="mt-2 text-3xl font-extrabold text-slate-950">{value}</p></div>)}</div>
    <div className="grid gap-6 xl:grid-cols-[1.2fr_1fr]"><section className={cardClass}><h2 className="text-lg font-extrabold">Daily readers</h2>{summary.daily.length ? <div className="mt-5 space-y-3">{summary.daily.slice(-14).map((day) => <div key={day.date} className="grid grid-cols-[72px_1fr_48px] items-center gap-3 text-sm"><span className="text-slate-500">{day.date.slice(5)}</span><div className="h-2 rounded-full bg-slate-100"><div className="h-2 rounded-full bg-violet-600" style={{ width: `${Math.min(100, (day.views / Math.max(...summary.daily.map((d) => d.views), 1)) * 100)}%` }} /></div><span className="text-right font-semibold">{day.views}</span></div>)}</div> : <p className="mt-4 text-sm text-slate-500">No reader events yet. Once readers open articles, this chart will populate.</p>}</section>
      <section className={cardClass}><h2 className="text-lg font-extrabold">Top articles</h2><div className="mt-4 divide-y divide-slate-100">{summary.topArticles.length ? summary.topArticles.map((article) => <div key={article.articleId} className="py-3 first:pt-0"><p className="font-semibold leading-snug">{article.title}</p><p className="mt-1 text-xs text-slate-500">{article.views} views · {article.readers} readers · {formatDuration(article.averageReadingSeconds)} avg · {article.completionRate}% complete</p></div>) : <p className="text-sm text-slate-500">No article data yet.</p>}</div></section></div>
  </div>;
}

function Articles({ onNew }: { onNew: () => void }) {
  const [items, setItems] = useState<Post[]>([]); const [page, setPage] = useState(1); const [totalPages, setTotalPages] = useState(1); const [search, setSearch] = useState(""); const [loading, setLoading] = useState(true);
  async function load(nextPage = page) { setLoading(true); const response = await fetch(`/api/admin/posts?page=${nextPage}&search=${encodeURIComponent(search)}`); const body = await response.json(); if (response.ok) { setItems(body.items || []); setTotalPages(body.totalPages || 1); } setLoading(false); }
  useEffect(() => {
    let cancelled = false;
    void fetch("/api/admin/posts?page=1&search=").then(async (response) => {
      const body = await response.json();
      if (!cancelled && response.ok) { setItems(body.items || []); setTotalPages(body.totalPages || 1); }
      if (!cancelled) setLoading(false);
    });
    return () => { cancelled = true; };
  }, []);
  return <div className="space-y-6"><div className="flex flex-wrap items-end justify-between gap-3"><div><p className="pill text-xs font-bold uppercase tracking-[0.18em] text-violet-700">WordPress posts</p><h1 className="mt-1 text-3xl font-extrabold">Articles</h1></div><button onClick={onNew} className="rounded-xl bg-violet-700 px-4 py-2.5 text-sm font-bold text-white hover:bg-violet-800">+ New article</button></div><div className={cardClass}><form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); setPage(1); void load(1); }}><input className={inputClass} placeholder="Search articles" value={search} onChange={(e) => setSearch(e.target.value)} /><button className="rounded-xl border border-slate-200 px-4 text-sm font-semibold hover:bg-slate-50">Search</button></form><div className="mt-5 overflow-x-auto"><table className="w-full min-w-[650px] text-left text-sm"><thead className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-400"><tr><th className="pb-3 pr-4">Title</th><th className="pb-3 pr-4">Author</th><th className="pb-3 pr-4">Status</th><th className="pb-3">Date</th></tr></thead><tbody className="divide-y divide-slate-100">{loading ? <tr><td colSpan={4} className="py-6 text-slate-500">Loading…</td></tr> : items.map((post) => <tr key={post.id}><td className="max-w-[420px] py-4 pr-4 font-semibold">{stripHtml(post.title.rendered)}</td><td className="py-4 pr-4 text-slate-600">{post._embedded?.author?.[0]?.name || "—"}</td><td className="py-4 pr-4"><span className="rounded-full bg-slate-100 px-2 py-1 text-xs font-semibold">{post.status || "publish"}</span></td><td className="py-4 text-slate-500">{new Date(post.date).toLocaleDateString()}</td></tr>)}</tbody></table></div><div className="mt-4 flex items-center justify-between text-sm text-slate-500"><span>Page {page} of {Math.max(1, totalPages)}</span><div className="flex gap-2"><button disabled={page <= 1} onClick={() => { const next = page - 1; setPage(next); void load(next); }} className="rounded-lg border border-slate-200 px-3 py-1.5 disabled:opacity-40">Previous</button><button disabled={page >= totalPages} onClick={() => { const next = page + 1; setPage(next); void load(next); }} className="rounded-lg border border-slate-200 px-3 py-1.5 disabled:opacity-40">Next</button></div></div></div></div>;
}

function NewArticle({ authors, categories, onCreated, onCategoryCreated }: { authors: Author[]; categories: Category[]; onCreated: () => void; onCategoryCreated: () => Promise<void> }) {
  const [title, setTitle] = useState(""); const [content, setContent] = useState(""); const [excerpt, setExcerpt] = useState(""); const [status, setStatus] = useState("draft"); const [author, setAuthor] = useState(""); const [category, setCategory] = useState(""); const [newCategory, setNewCategory] = useState(""); const [image, setImage] = useState<File | null>(null); const [imageAlt, setImageAlt] = useState(""); const [message, setMessage] = useState(""); const [saving, setSaving] = useState(false); const [creatingCategory, setCreatingCategory] = useState(false);
  const authorOptions = authors.map((item) => ({ value: String(item.id), label: item.name, searchText: item.slug }));
  const categoryOptions = categories.map((item) => ({ value: String(item.id), label: item.name, searchText: String(item.count) }));
  async function createCategory() { if (!newCategory.trim()) return; setCreatingCategory(true); setMessage(""); const response = await fetch("/api/admin/categories", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: newCategory.trim() }) }); const body = await response.json().catch(() => ({})); if (!response.ok) setMessage(body.error || "Could not create category"); else { await onCategoryCreated(); setCategory(String(body.item.id)); setNewCategory(""); setMessage("Category created and selected."); } setCreatingCategory(false); }
  async function submit(event: FormEvent) { event.preventDefault(); setSaving(true); setMessage(""); const form = new FormData(); form.set("title", title); form.set("content", content); form.set("excerpt", excerpt); form.set("status", status); if (author) form.set("author", author); form.set("categories", category ? JSON.stringify([Number(category)]) : "[]"); if (image) { form.set("featuredImage", image); form.set("featuredImageAlt", imageAlt); } const response = await fetch("/api/admin/posts", { method: "POST", body: form }); const body = await response.json().catch(() => ({})); setSaving(false); if (!response.ok) { setMessage(body.error || "Could not create article"); return; } setMessage("Article created successfully."); setTitle(""); setContent(""); setExcerpt(""); setImage(null); setImageAlt(""); onCreated(); }
  return <div className="space-y-6"><div><p className="pill text-xs font-bold uppercase tracking-[0.18em] text-violet-700">WordPress posts</p><h1 className="mt-1 text-3xl font-extrabold">Create article</h1><p className="mt-1 text-sm text-slate-500">Content is created directly in WordPress, so existing permalinks and editorial data stay together.</p></div><form onSubmit={submit} className={`${cardClass} space-y-5`}><label className="block text-sm font-semibold">Title<input className={`${inputClass} mt-1.5`} value={title} onChange={(e) => setTitle(e.target.value)} required /></label><div className="grid gap-4 sm:grid-cols-2"><SearchableSelect label="Author" value={author} options={authorOptions} placeholder="Choose author" onChange={setAuthor} /><div><SearchableSelect label="Category" value={category} options={categoryOptions} placeholder="Choose category" onChange={setCategory} /><div className="mt-2 flex gap-2"><input className={inputClass} placeholder="New category" value={newCategory} onChange={(e) => setNewCategory(e.target.value)} /><button type="button" onClick={() => void createCategory()} disabled={creatingCategory || !newCategory.trim()} className="shrink-0 rounded-xl border border-slate-200 px-3 text-xs font-semibold hover:bg-slate-50 disabled:opacity-40">{creatingCategory ? "…" : "Create"}</button></div></div></div><label className="block text-sm font-semibold">Excerpt<textarea className={`${inputClass} mt-1.5 min-h-20`} value={excerpt} onChange={(e) => setExcerpt(e.target.value)} /></label><HtmlEditor label="Content" value={content} onChange={setContent} helpText="Use Visual for the WordPress-style toolbar or HTML to edit the markup directly." /><div className="grid gap-4 sm:grid-cols-2"><label className="block text-sm font-semibold">Publish status<select className={`${inputClass} mt-1.5`} value={status} onChange={(e) => setStatus(e.target.value)}><option value="draft">Draft</option><option value="pending">Pending review</option><option value="publish">Publish now</option><option value="private">Private</option></select></label><div><span className="block text-sm font-semibold">Featured image</span><div className="mt-1.5"><ImageUploadField file={image} altText={imageAlt} onChange={setImage} onAltChange={setImageAlt} /></div></div></div>{message && <p className="rounded-xl bg-violet-50 px-3 py-2 text-sm text-violet-800">{message}</p>}<button disabled={saving} className="rounded-xl bg-violet-700 px-5 py-3 font-bold text-white hover:bg-violet-800 disabled:opacity-50">{saving ? "Creating…" : "Create article"}</button></form></div>;
}

function Authors({ authors, refresh }: { authors: Author[]; refresh: () => void }) {
  const [form, setForm] = useState({ name: "", username: "", email: "", password: "", description: "" }); const [message, setMessage] = useState(""); const [saving, setSaving] = useState(false);
  async function submit(event: FormEvent) { event.preventDefault(); setSaving(true); setMessage(""); const response = await fetch("/api/admin/authors", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) }); const body = await response.json(); setSaving(false); if (!response.ok) { setMessage(body.error || "Could not create author"); return; } setMessage("Author created successfully."); setForm({ name: "", username: "", email: "", password: "", description: "" }); refresh(); }
  return <div className="space-y-6"><div><p className="pill text-xs font-bold uppercase tracking-[0.18em] text-violet-700">WordPress users</p><h1 className="mt-1 text-3xl font-extrabold">Authors</h1><p className="mt-1 text-sm text-slate-500">Create author profiles without touching existing user records.</p></div><div className="grid gap-6 xl:grid-cols-[1fr_1.3fr]"><form onSubmit={submit} className={`${cardClass} space-y-4`}><h2 className="text-lg font-extrabold">Create author</h2>{([['name','Display name'],['username','Username'],['email','Email'],['password','Temporary password']] as const).map(([key, label]) => <label key={key} className="block text-sm font-semibold">{label}<input className={`${inputClass} mt-1.5`} type={key === "password" ? "password" : key === "email" ? "email" : "text"} value={form[key]} onChange={(e) => setForm({ ...form, [key]: e.target.value })} required /></label>)}<HtmlEditor label="Bio" value={form.description} onChange={(description) => setForm({ ...form, description })} minHeight="min-h-36" helpText="Author bios support the same Visual and HTML modes." />{message && <p className="rounded-xl bg-violet-50 px-3 py-2 text-sm text-violet-800">{message}</p>}<button disabled={saving} className="rounded-xl bg-violet-700 px-5 py-3 font-bold text-white hover:bg-violet-800 disabled:opacity-50">{saving ? "Creating…" : "Create author"}</button></form><section className={cardClass}><h2 className="text-lg font-extrabold">Existing authors</h2><div className="mt-4 divide-y divide-slate-100">{authors.map((item) => <div key={item.id} className="flex items-start justify-between gap-4 py-3 first:pt-0"><div><p className="font-semibold">{item.name}</p><p className="text-xs text-slate-500">@{item.slug || item.id} {item.email ? `· ${item.email}` : ""}</p></div><span className="rounded-full bg-slate-100 px-2 py-1 text-xs text-slate-500">{item.roles?.[0] || "user"}</span></div>)}</div></section></div></div>;
}

export default function AdminClient({ initialUser }: { initialUser: string | null }) {
  const [tab, setTab] = useState<Tab>("overview"); const [summary, setSummary] = useState<Summary | null>(null); const [authors, setAuthors] = useState<Author[]>([]); const [categories, setCategories] = useState<Category[]>([]);
  async function loadSummary() { const response = await fetch("/api/admin/analytics", { cache: "no-store" }); if (response.ok) setSummary(await response.json()); }
  async function loadTaxonomies() { const [authorResponse, categoryResponse] = await Promise.all([fetch("/api/admin/authors"), fetch("/api/admin/categories")]); if (authorResponse.ok) setAuthors((await authorResponse.json()).items || []); if (categoryResponse.ok) setCategories((await categoryResponse.json()).items || []); }
  useEffect(() => {
    if (!initialUser) return;
    let cancelled = false;
    void Promise.all([fetch("/api/admin/analytics", { cache: "no-store" }), fetch("/api/admin/authors"), fetch("/api/admin/categories")]).then(async ([summaryResponse, authorResponse, categoryResponse]) => {
      if (cancelled) return;
      if (summaryResponse.ok) setSummary(await summaryResponse.json());
      if (authorResponse.ok) setAuthors((await authorResponse.json()).items || []);
      if (categoryResponse.ok) setCategories((await categoryResponse.json()).items || []);
    });
    return () => { cancelled = true; };
  }, [initialUser]);
  const content = useMemo(() => { if (tab === "overview") return <Overview summary={summary} refresh={loadSummary} />; if (tab === "articles") return <Articles onNew={() => setTab("new")} />; if (tab === "new") return <NewArticle authors={authors} categories={categories} onCreated={() => setTab("articles")} onCategoryCreated={loadTaxonomies} />; return <Authors authors={authors} refresh={loadTaxonomies} />; }, [tab, summary, authors, categories]);
  if (!initialUser) return <Login />;
  return <AdminShell user={initialUser} tab={tab} setTab={setTab} onLogout={async () => { await fetch("/api/admin/logout", { method: "POST" }); window.location.reload(); }}>{content}</AdminShell>;
}
