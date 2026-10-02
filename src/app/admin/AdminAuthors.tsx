"use client";

import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { PHOTO_LIMIT_BYTES } from "@/lib/admin-upload";
import { FilterSelect, pageNumbers, RowMenu, type MenuEntry } from "./AdminArticles";
import Avatar from "./avatar";
import { CardTitle, FieldLabel } from "./form-parts";
import HtmlEditor from "./HtmlEditor";
import { Icon, type IconName } from "./icons";
import { useObjectUrl } from "./media-client";
import { cardClass, inputClass, Skeleton, type Author } from "./ui";

/* eslint-disable @next/next/no-img-element -- the chosen photo is a local blob, not an app image */

const PER_PAGE = 10;
const PHOTO_TYPES = ["image/jpeg", "image/png", "image/webp"];

const roleOptions = [["", "All roles"], ["administrator", "Administrator"], ["editor", "Editor"], ["author", "Author"]];
const statusOptions = [["", "All status"], ["active", "Active"], ["inactive", "Inactive"]];
const sortOptions = [["name", "Sort: Name (A–Z)"], ["name-desc", "Sort: Name (Z–A)"], ["newest", "Sort: Newest first"], ["oldest", "Sort: Oldest first"], ["role", "Sort: Role"]];

const roleRank = ["administrator", "editor", "author"];
const roleStyle: Record<string, string> = { administrator: "bg-violet-100 text-violet-700", editor: "bg-sky-100 text-sky-700", author: "bg-slate-100 text-slate-600" };

/** The most senior of a user's roles. */
const roleOf = (author: Author) => roleRank.find((role) => author.roles?.includes(role)) ?? author.roles?.[0] ?? "author";
const roleLabel = (role: string) => `${role[0].toUpperCase()}${role.slice(1)}`;

type Activity = { days: number; active: Set<number> };
const emptyForm = { name: "", username: "", email: "", password: "", description: "" };
type Filters = { search: string; role: string; status: string; sort: string; page: number };
const emptyFilters: Filters = { search: "", role: "", status: "", sort: "name", page: 1 };

const collator = new Intl.Collator(undefined, { sensitivity: "base", numeric: true });

function AuthorsSkeleton() {
  return <div aria-busy="true" aria-label="Loading authors" className="space-y-5 sm:space-y-6"><div className="space-y-2"><Skeleton className="h-3 w-24" /><Skeleton className="h-9 w-64 max-w-full" /><Skeleton className="h-4 w-96 max-w-full" /></div><div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)]"><div className={`${cardClass} space-y-4`}><Skeleton className="h-8 w-40" /><div className="grid gap-4 sm:grid-cols-[10rem_1fr]"><Skeleton className="h-44 w-full" /><div className="space-y-4">{Array.from({ length: 3 }, (_, index) => <Skeleton className="h-11 w-full" key={index} />)}</div></div><Skeleton className="h-11 w-full" /><Skeleton className="h-36 w-full" /></div><div className={cardClass}><Skeleton className="h-8 w-56" /><div className="mt-4 grid gap-3 sm:grid-cols-3"><Skeleton className="h-11 w-full sm:col-span-3" />{Array.from({ length: 3 }, (_, index) => <Skeleton className="h-11 w-full" key={index} />)}</div><div className="mt-5 space-y-4">{Array.from({ length: 6 }, (_, index) => <div className="flex items-center gap-3" key={index}><Skeleton className="h-10 w-10 rounded-full" /><div className="flex-1 space-y-2"><Skeleton className="h-4 w-2/5" /><Skeleton className="h-3 w-3/5" /></div><Skeleton className="h-6 w-20" /></div>)}</div></div></div></div>;
}

function PhotoPicker({ file, problem, onChange }: { file: File | null; problem: string; onChange: (file: File | null) => void }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const preview = useObjectUrl(file);
  const [dragging, setDragging] = useState(false);
  return <div>
    <FieldLabel>Profile photo</FieldLabel>
    <input ref={inputRef} className="hidden" type="file" accept={PHOTO_TYPES.join(",")} onChange={(event) => { onChange(event.target.files?.[0] ?? null); event.target.value = ""; }} />
    {file ? <div className="mt-2 flex flex-col items-center rounded-2xl border border-slate-200 bg-slate-50/50 px-3 py-4 text-center">
      {preview ? <img src={preview} alt="Selected profile photo" className="h-24 w-24 rounded-full object-cover ring-2 ring-white shadow" /> : <span className="h-24 w-24 rounded-full bg-slate-200" />}
      <p className="mt-2 max-w-full break-all text-xs text-slate-500">{file.name} · {Math.ceil(file.size / 1024).toLocaleString()} KB</p>
      <div className="mt-3 flex gap-2"><button type="button" onClick={() => inputRef.current?.click()} className="min-h-9 rounded-lg border border-slate-200 bg-white px-3 text-xs font-semibold hover:bg-slate-50">Change</button><button type="button" onClick={() => onChange(null)} className="min-h-9 rounded-lg border border-red-200 bg-white px-3 text-xs font-semibold text-red-700 hover:bg-red-50">Remove</button></div>
    </div> : <div role="button" tabIndex={0} aria-label="Upload a profile photo" onClick={() => inputRef.current?.click()} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); inputRef.current?.click(); } }} onDragOver={(event) => { event.preventDefault(); setDragging(true); }} onDragLeave={() => setDragging(false)} onDrop={(event) => { event.preventDefault(); setDragging(false); onChange(event.dataTransfer.files?.[0] ?? null); }} className={`mt-2 flex min-h-44 cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed px-3 py-5 text-center transition ${dragging ? "border-violet-500 bg-violet-100/60" : "border-violet-300 bg-violet-50/40 hover:bg-violet-50"}`}>
      <span className="relative flex h-16 w-16 items-center justify-center rounded-full bg-violet-100 text-violet-500"><Icon name="user" className="h-8 w-8" /><span className="absolute -bottom-0.5 -right-0.5 flex h-6 w-6 items-center justify-center rounded-full bg-violet-700 text-white ring-2 ring-white"><Icon name="plus" className="h-3.5 w-3.5" strokeWidth={2.4} /></span></span>
      <p className="mt-3 text-sm font-semibold text-slate-900">Upload photo</p>
      <p className="mt-0.5 text-[11px] leading-snug text-slate-500">PNG, JPG or WebP<br />(Max 2 MB)</p>
    </div>}
    {problem && <p role="alert" className="mt-2 text-xs text-red-700">{problem}</p>}
  </div>;
}

function IconField({ label, icon, children }: { label: string; icon: IconName; children: React.ReactNode }) {
  return <label className="block"><FieldLabel required>{label}</FieldLabel><span className="relative mt-2 block"><Icon name={icon} className="pointer-events-none absolute left-3.5 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-slate-500" />{children}</span></label>;
}

function RolePill({ author }: { author: Author }) {
  const role = roleOf(author);
  return <span className={`inline-flex rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${roleStyle[role] ?? roleStyle.author}`}>{roleLabel(role)}</span>;
}

/** Nothing until the activity has loaded, so a pill never claims more than is known. */
function StatusPill({ author, activity }: { author: Author; activity: Activity | null }) {
  if (!activity) return null;
  const active = activity.active.has(author.id);
  return <span title={`${active ? "Published" : "Has not published"} an article in the last ${activity.days} days`} className={`inline-flex rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${active ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"}`}>{active ? "Active" : "Inactive"}</span>;
}

function download(name: string, text: string) {
  const link = document.createElement("a");
  link.href = URL.createObjectURL(new Blob([`﻿${text}`], { type: "text/csv;charset=utf-8" }));
  link.download = name;
  link.click();
  URL.revokeObjectURL(link.href);
}

export default function Authors({ authors, refresh, loading, error, onViewArticles }: { authors: Author[]; refresh: () => void; loading: boolean; error?: string; onViewArticles: (authorId: number) => void }) {
  const [form, setForm] = useState(emptyForm);
  const [photo, setPhoto] = useState<File | null>(null);
  const [photoProblem, setPhotoProblem] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [message, setMessage] = useState<{ kind: "ok" | "warn" | "error"; text: string } | null>(null);
  const [saving, setSaving] = useState(false);
  const [filters, setFilters] = useState<Filters>(emptyFilters);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [notice, setNotice] = useState("");
  const [activity, setActivity] = useState<Activity | null>(null);

  // Whether each author is active comes from recent articles; it loads after the list so the list is never held up.
  useEffect(() => {
    let cancelled = false;
    void fetch("/api/admin/authors/activity/", { cache: "no-store" }).then(async (response) => {
      const body = await response.json().catch(() => null);
      if (!cancelled && response.ok && Array.isArray(body?.activeIds)) setActivity({ days: Number(body.days) || 90, active: new Set<number>(body.activeIds) });
    }).catch(() => undefined);
    return () => { cancelled = true; };
  }, [authors]);

  function choosePhoto(file: File | null) {
    setPhotoProblem("");
    if (file && !PHOTO_TYPES.includes(file.type)) { setPhotoProblem("Use a PNG, JPG or WebP image."); return; }
    if (file && file.size > PHOTO_LIMIT_BYTES) { setPhotoProblem(`That photo is ${(file.size / 1_048_576).toFixed(1)} MB; the limit is 2 MB.`); return; }
    setPhoto(file);
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    setSaving(true); setMessage(null);
    const data = new FormData();
    for (const [key, value] of Object.entries(form)) data.set(key, value);
    if (photo) data.set("photo", photo);
    try {
      const response = await fetch("/api/admin/authors/", { method: "POST", body: data });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) { setMessage({ kind: "error", text: body.error || "Could not create author" }); return; }
      setMessage(body.warning ? { kind: "warn", text: body.warning } : { kind: "ok", text: "Author created successfully." });
      setForm(emptyForm); setPhoto(null); setShowPassword(false);
      refresh();
    } catch { setMessage({ kind: "error", text: "Could not reach the author service." }); }
    finally { setSaving(false); }
  }

  const filtered = useMemo(() => {
    const needle = filters.search.trim().toLocaleLowerCase();
    const rows = authors.filter((item) => (!needle || `${item.name} ${item.slug || ""} ${item.email || ""}`.toLocaleLowerCase().includes(needle))
      && (!filters.role || roleOf(item) === filters.role)
      && (!filters.status || (activity ? activity.active.has(item.id) === (filters.status === "active") : true)));
    const byName = (a: Author, b: Author) => collator.compare(a.name, b.name);
    const order: Record<string, (a: Author, b: Author) => number> = {
      name: byName,
      "name-desc": (a, b) => byName(b, a),
      newest: (a, b) => (b.registered_date || "").localeCompare(a.registered_date || "") || byName(a, b),
      oldest: (a, b) => (a.registered_date || "").localeCompare(b.registered_date || "") || byName(a, b),
      role: (a, b) => roleRank.indexOf(roleOf(a)) - roleRank.indexOf(roleOf(b)) || byName(a, b),
    };
    return [...rows].sort(order[filters.sort] ?? byName);
  }, [authors, filters, activity]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PER_PAGE));
  const page = Math.min(filters.page, totalPages);
  const shown = filtered.slice((page - 1) * PER_PAGE, page * PER_PAGE);
  const isFiltered = Boolean(filters.search || filters.role || filters.status);
  const allShownSelected = shown.length > 0 && shown.every((item) => selected.has(item.id));
  const chosen = authors.filter((item) => selected.has(item.id));

  function apply(patch: Partial<Filters>) { setFilters((current) => ({ ...current, page: 1, ...patch })); }
  function toggle(id: number) { setSelected((current) => { const next = new Set(current); if (!next.delete(id)) next.add(id); return next; }); }
  function toggleShown() { setSelected((current) => { const next = new Set(current); for (const item of shown) { if (allShownSelected) next.delete(item.id); else next.add(item.id); } return next; }); }

  async function copyEmails(list: Author[]) {
    const emails = list.flatMap((item) => (item.email ? [item.email] : []));
    try { await navigator.clipboard.writeText(emails.join(", ")); setNotice(emails.length === 1 ? "Copied 1 email address." : `Copied ${emails.length.toLocaleString()} email addresses.`); }
    catch { setNotice("Your browser did not allow copying. Select the address and copy it by hand."); }
  }
  function exportCsv(list: Author[]) {
    const cell = (value: string) => `"${value.replace(/"/g, '""')}"`;
    const lines = [["Name", "Username", "Email", "Role", "Status", "Registered"].map(cell).join(",")];
    for (const item of list) lines.push([item.name, item.slug || "", item.email || "", roleLabel(roleOf(item)), activity ? (activity.active.has(item.id) ? "Active" : "Inactive") : "", item.registered_date ? item.registered_date.slice(0, 10) : ""].map(cell).join(","));
    download("authors.csv", lines.join("\r\n"));
    setNotice(`Exported ${list.length.toLocaleString()} ${list.length === 1 ? "author" : "authors"}.`);
  }
  function menuFor(item: Author): MenuEntry[] {
    const entries: MenuEntry[] = [{ label: "View articles", icon: "doc", onSelect: () => onViewArticles(item.id) }];
    if (item.email) entries.push({ label: "Copy email", icon: "copy", onSelect: () => void copyEmails([item]) });
    entries.push({ label: "Open in WordPress", icon: "external", href: `/wp-admin/user-edit.php?user_id=${item.id}` });
    return entries;
  }

  if (loading) return <AuthorsSkeleton />;
  const numbers = pageNumbers(page, totalPages);
  const messageStyle = { ok: "bg-violet-50 text-violet-800", warn: "bg-amber-50 text-amber-800", error: "bg-red-50 text-red-700" };
  const checkbox = "h-4 w-4 shrink-0 rounded border-slate-300 accent-violet-700";

  return <div className="space-y-5 sm:space-y-6">
    <div>
      <nav aria-label="Breadcrumb" className="flex items-center gap-1.5 text-sm text-slate-500"><span>Authors</span><Icon name="chevronRight" className="h-3.5 w-3.5" strokeWidth={2} /><span className="font-medium text-slate-900">Create author</span></nav>
      <p className="pill mt-4 text-xs font-bold uppercase tracking-[0.18em] text-violet-700">WordPress users</p>
      <h1 className="mt-2 text-2xl font-extrabold text-[#12093a] sm:text-3xl">Authors and editors</h1>
      <p className="mt-1.5 text-sm text-slate-500">Create author profiles without touching existing user records. Administrators and editors who can publish are included.</p>
    </div>

    <div className="grid grid-cols-[minmax(0,1fr)] items-start gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)]">
      <form onSubmit={(event) => void submit(event)} className={`${cardClass} space-y-5`}>
        <CardTitle icon="users">Create author</CardTitle>
        <div className="grid gap-5 sm:grid-cols-[10.5rem_minmax(0,1fr)]">
          <PhotoPicker file={photo} problem={photoProblem} onChange={choosePhoto} />
          <div className="space-y-4">
            <label className="block"><FieldLabel required>Display name</FieldLabel><input className={`${inputClass} mt-2`} value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} placeholder="Enter display name" required /></label>
            <label className="block"><FieldLabel required>Username</FieldLabel><input className={`${inputClass} mt-2`} value={form.username} onChange={(event) => setForm({ ...form, username: event.target.value })} placeholder="Enter username" autoComplete="off" required /><span className="mt-1.5 block text-xs text-slate-500">This will be used to login to WordPress.</span></label>
            <IconField label="Email" icon="mail"><input className={`${inputClass} pl-10`} type="email" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} placeholder="example@mail.com" autoComplete="off" required /></IconField>
          </div>
        </div>
        <IconField label="Temporary password" icon="lock">
          <input className={`${inputClass} pl-10 pr-11`} type={showPassword ? "text" : "password"} value={form.password} onChange={(event) => setForm({ ...form, password: event.target.value })} placeholder="Enter temporary password" autoComplete="new-password" required />
          <button type="button" aria-label={showPassword ? "Hide password" : "Show password"} title={showPassword ? "Hide password" : "Show password"} onClick={() => setShowPassword((current) => !current)} className="absolute inset-y-0 right-0 flex w-11 items-center justify-center text-slate-500 transition hover:text-violet-700"><Icon name={showPassword ? "eyeOff" : "eye"} className="h-5 w-5" /></button>
        </IconField>
        <HtmlEditor compact label="Bio" placeholder="Write a short bio about the author…" value={form.description} onChange={(description) => setForm({ ...form, description })} minHeight="min-h-28 sm:min-h-32" />
        {message && <p role={message.kind === "error" ? "alert" : "status"} className={`rounded-xl px-3 py-2 text-sm ${messageStyle[message.kind]}`}>{message.text}</p>}
        <div className="flex flex-col gap-3 rounded-xl bg-violet-50/70 p-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
          <div className="flex items-start gap-3 text-xs leading-snug text-slate-600"><Icon name="info" className="mt-0.5 h-[18px] w-[18px] shrink-0 text-violet-600" /><p><span className="block font-medium text-slate-800">A WordPress user account will be created with the role Author.</span>The author can log in and manage their own articles.</p></div>
          <button disabled={saving} className="flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-xl bg-[linear-gradient(90deg,#7c3aed,#6d28d9)] px-5 text-sm font-bold text-white shadow-[0_10px_22px_-10px_rgba(109,40,217,0.8)] transition hover:brightness-110 disabled:opacity-60"><Icon name="users" className="h-[18px] w-[18px]" />{saving ? "Creating…" : "Create author"}</button>
        </div>
      </form>

      <section className={`${cardClass} @container`}>
        <div className="flex items-center justify-between gap-3"><CardTitle icon="users">Existing authors and editors</CardTitle><span className="shrink-0 text-sm text-slate-500">{authors.length.toLocaleString()} users</span></div>
        {error && <p role="alert" className="mt-3 rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
        <div className="mt-4 grid gap-3 @md:grid-cols-3">
          <label className="relative block @md:col-span-3"><span className="sr-only">Search authors</span><Icon name="search" className="pointer-events-none absolute left-3.5 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-slate-500" /><input type="search" className={`${inputClass} pl-10 [&::-webkit-search-cancel-button]:hidden`} value={filters.search} onChange={(event) => apply({ search: event.target.value })} placeholder="Search authors by name or email…" /></label>
          <FilterSelect label="Filter by role" value={filters.role} onChange={(role) => apply({ role })} options={roleOptions} />
          <FilterSelect label={activity ? "Filter by status" : "Filter by status (loading)"} value={filters.status} onChange={(status) => apply({ status })} options={statusOptions} />
          <FilterSelect label="Sort authors" value={filters.sort} onChange={(sort) => apply({ sort })} options={sortOptions} />
        </div>

        <div className="mt-4 flex min-h-9 flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-2 text-xs text-slate-500">
          <label className="flex items-center gap-3"><input type="checkbox" className={checkbox} checked={allShownSelected} disabled={!shown.length} onChange={toggleShown} /><span>{selected.size ? `${selected.size.toLocaleString()} selected` : "Select all on this page"}</span></label>
          {selected.size > 0 && <div className="flex flex-wrap items-center gap-2">
            <button type="button" onClick={() => void copyEmails(chosen)} className="flex min-h-8 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 font-semibold text-slate-700 hover:bg-slate-50"><Icon name="copy" className="h-4 w-4" />Copy emails</button>
            <button type="button" onClick={() => exportCsv(chosen)} className="flex min-h-8 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 font-semibold text-slate-700 hover:bg-slate-50"><Icon name="download" className="h-4 w-4" />Export CSV</button>
            <button type="button" onClick={() => setSelected(new Set())} className="min-h-8 px-1.5 font-semibold text-violet-700 hover:underline">Clear</button>
          </div>}
        </div>
        {notice && <p role="status" className="mt-3 rounded-xl bg-violet-50 px-3 py-2 text-sm text-violet-800">{notice}</p>}

        {shown.length
          ? <ul className="divide-y divide-slate-100">{shown.map((item) => <li key={item.id} className="grid grid-cols-[auto_auto_minmax(0,1fr)_auto] items-center gap-x-3 py-3 @[34rem]:grid-cols-[auto_auto_minmax(0,1fr)_7rem_4.5rem_auto]">
            <input type="checkbox" className={checkbox} aria-label={`Select ${item.name}`} checked={selected.has(item.id)} onChange={() => toggle(item.id)} />
            <Avatar src={item.avatar} className="h-10 w-10" />
            <div className="min-w-0">
              <p className="break-words text-sm font-semibold leading-snug text-[#12093a]">{item.name}</p>
              <p className="break-all text-xs text-slate-500">{item.slug || item.id}{item.email ? ` · ${item.email}` : ""}</p>
              <div className="mt-1.5 flex flex-wrap items-center gap-2 @[34rem]:hidden"><RolePill author={item} /><StatusPill author={item} activity={activity} /></div>
            </div>
            <span className="hidden @[34rem]:block"><RolePill author={item} /></span>
            <span className="hidden @[34rem]:block"><StatusPill author={item} activity={activity} /></span>
            <RowMenu title={item.name} entries={menuFor(item)} />
          </li>)}</ul>
          : <div className="mt-4 rounded-xl border border-dashed border-slate-200 px-4 py-10 text-center text-sm text-slate-500">{isFiltered ? "No authors match these filters." : "No authors found."}{isFiltered && <button type="button" onClick={() => setFilters(emptyFilters)} className="ml-2 font-semibold text-violet-700 hover:underline">Reset filters</button>}</div>}

        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-4 text-xs text-slate-500">
          <span>{filtered.length ? `Showing ${((page - 1) * PER_PAGE + 1).toLocaleString()}–${Math.min(page * PER_PAGE, filtered.length).toLocaleString()} of ${filtered.length.toLocaleString()} authors` : "Showing 0 authors"}</span>
          <nav aria-label="Pagination" className="flex items-center gap-1.5">
            <button type="button" aria-label="Previous page" disabled={page <= 1} onClick={() => setFilters((current) => ({ ...current, page: page - 1 }))} className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-700 transition hover:bg-slate-50 disabled:opacity-40"><Icon name="chevronLeft" className="h-4 w-4" strokeWidth={2} /></button>
            {numbers.map((entry, index) => entry === "…"
              ? <span key={`gap-${index}`} aria-hidden className="px-1 text-slate-400">…</span>
              : <button type="button" key={entry} aria-current={entry === page ? "page" : undefined} onClick={() => setFilters((current) => ({ ...current, page: entry }))} className={`hidden h-9 min-w-9 items-center justify-center rounded-lg px-2 text-xs font-semibold transition sm:flex ${entry === page ? "bg-violet-700 text-white shadow-[0_8px_16px_-8px_rgba(109,40,217,0.8)]" : "text-slate-700 hover:bg-slate-100"}`}>{entry.toLocaleString()}</button>)}
            <button type="button" aria-label="Next page" disabled={page >= totalPages} onClick={() => setFilters((current) => ({ ...current, page: page + 1 }))} className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-700 transition hover:bg-slate-50 disabled:opacity-40"><Icon name="chevronRight" className="h-4 w-4" strokeWidth={2} /></button>
          </nav>
        </div>
        {activity && <p className="mt-3 text-[11px] text-slate-400">Active means the author published an article in the last {activity.days} days.</p>}
      </section>
    </div>
  </div>;
}
/* eslint-enable @next/next/no-img-element */
