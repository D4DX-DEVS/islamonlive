"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import ConfirmDialog from "../ConfirmDialog";
import { Select } from "../Select";
import { Icon } from "../icons";
import { cardClass, initials, inputClass, Skeleton } from "../ui";
import { Dialog, Field, Switch, iconButton, primaryButton, secondaryButton } from "../home-layout/parts";

/* The Team screen: the administrators and editors who can sign in. An
   administrator adds as many editor accounts as the desk needs, and can rename,
   promote, reset the password of, switch off or delete any of them. */

type Role = "editor" | "administrator";
type Member = { id: number; name: string; username: string; email: string | null; role: Role; active: boolean; registered: string | null; posts: number; lastActive: string | null };
const ROLE_OPTIONS = [{ value: "editor", label: "Editor — writes and publishes articles" }, { value: "administrator", label: "Administrator — everything, incl. homepage and team" }];
const day = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric" });
const fmt = (iso: string | null) => (iso ? day.format(new Date(iso)) : "—");

function RoleChip({ role }: { role: Role }) {
  return <span className={`pill inline-flex rounded-md px-2 py-0.5 text-[11px] font-semibold ${role === "administrator" ? "bg-violet-100 text-violet-800" : "bg-teal-50 text-teal-800"}`}>{role === "administrator" ? "Administrator" : "Editor"}</span>;
}

function PasswordInput({ value, onChange, label }: { value: string; onChange: (value: string) => void; label: string }) {
  const [show, setShow] = useState(false);
  return <span className="relative block">
    <input type={show ? "text" : "password"} value={value} onChange={(event) => onChange(event.target.value)} autoComplete="new-password" aria-label={label} className={`${inputClass} pr-12`} />
    <button type="button" aria-label={show ? "Hide password" : "Show password"} onClick={() => setShow((v) => !v)} className="absolute inset-y-0 right-0 flex w-11 items-center justify-center text-slate-500 hover:text-violet-700"><Icon name={show ? "eyeOff" : "eye"} className="h-[18px] w-[18px]" /></button>
  </span>;
}

/** A readable 14-character password, for the "Suggest" button. */
function suggestPassword(): string {
  const alphabet = "abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const bytes = crypto.getRandomValues(new Uint8Array(14));
  return Array.from(bytes, (b) => alphabet[b % alphabet.length]).join("");
}

function MemberDialog({ member, me, onClose, onSaved }: { member: Member | null; me: number; onClose: () => void; onSaved: (message: string) => void }) {
  const creating = member === null;
  const [form, setForm] = useState({ name: member?.name ?? "", username: member?.username ?? "", email: member?.email ?? "", role: member?.role ?? ("editor" as Role), active: member?.active ?? true, password: "" });
  const [problem, setProblem] = useState("");
  const [saving, setSaving] = useState(false);
  const self = member?.id === me;
  const set = (patch: Partial<typeof form>) => setForm((current) => ({ ...current, ...patch }));

  async function submit(event?: FormEvent) {
    event?.preventDefault(); setProblem("");
    if (creating && form.password.length < 8) { setProblem("The password must be at least 8 characters."); return; }
    if (!creating && form.password && form.password.length < 8) { setProblem("The new password must be at least 8 characters."); return; }
    setSaving(true);
    try {
      const payload = creating ? form : { id: member.id, name: form.name, username: form.username.trim(), email: form.email, role: form.role, active: form.active, ...(form.password ? { password: form.password } : {}) };
      const response = await fetch("/api/admin/team/", { method: creating ? "POST" : "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.error || "The account could not be saved.");
      onSaved(creating ? `${form.name} can now sign in as ${form.role === "administrator" ? "an administrator" : "an editor"}. Share the password with them privately.` : body.changed?.length ? `Saved: ${body.changed.join(", ")}.` : "Nothing changed.");
    } catch (error) { setProblem(error instanceof Error ? error.message : "Could not reach the team service."); } finally { setSaving(false); }
  }

  return <Dialog title={creating ? "Add a team member" : `Edit ${member.name}`} onClose={onClose} footer={<>
    <button type="button" onClick={onClose} className={secondaryButton}>Cancel</button>
    <button type="button" disabled={saving} onClick={() => void submit()} className={primaryButton}>{saving ? "Saving…" : creating ? "Create account" : "Save changes"}</button>
  </>}>
    <form onSubmit={(event) => void submit(event)} className="space-y-4">
      <Field label="Full name"><input value={form.name} onChange={(event) => set({ name: event.target.value })} required className={inputClass} /></Field>
      <Field label="Username" hint={creating ? "Used to sign in. Letters, numbers, dots, dashes." : member.username ? "Signs in with this or the email address. A change applies from their next sign-in." : "No username yet, so this account signs in with its email. Add one to allow both."}><input value={form.username} onChange={(event) => set({ username: event.target.value })} autoCapitalize="none" spellCheck={false} required={creating || Boolean(member.username)} className={inputClass} /></Field>
      <Field label="Email"><input type="email" value={form.email} onChange={(event) => set({ email: event.target.value })} required className={inputClass} /></Field>
      <Field label="Role" hint={self ? "You cannot change your own role." : undefined}>{self ? <RoleChip role={form.role} /> : <Select label="Role" value={form.role} onChange={(role) => set({ role: role as Role })} options={ROLE_OPTIONS} />}</Field>
      <Field label={creating ? "Password" : "New password"} hint={creating ? "At least 8 characters. They can sign in with it straight away." : "Leave empty to keep the current password."}>
        <PasswordInput value={form.password} onChange={(password) => set({ password })} label={creating ? "Password" : "New password"} />
        <button type="button" onClick={() => set({ password: suggestPassword() })} className="mt-2 text-xs font-semibold text-violet-700 hover:underline">Suggest a strong password</button>
      </Field>
      {!creating && !self && <div className="flex items-center justify-between gap-3 rounded-xl bg-slate-50 p-3"><span className="text-sm"><span className="block font-semibold text-slate-900">Can sign in</span><span className="text-xs text-slate-500">Switch off to block the account without deleting its history.</span></span><Switch checked={form.active} onChange={(active) => set({ active })} label="Can sign in" /></div>}
      {problem && <p role="alert" className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">{problem}</p>}
      <button type="submit" hidden />
    </form>
  </Dialog>;
}

export default function TeamPage() {
  const [items, setItems] = useState<Member[] | null>(null);
  const [me, setMe] = useState(0);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [editing, setEditing] = useState<Member | null | "new">(null);
  const [deleting, setDeleting] = useState<Member | null>(null);
  const [busyId, setBusyId] = useState(0);
  const [actionError, setActionError] = useState("");
  const [reload, setReload] = useState(0);

  const refresh = useCallback(() => setReload((n) => n + 1), []);
  const cancelDelete = useCallback(() => setDeleting(null), []);

  async function confirmDelete() {
    const member = deleting;
    if (!member) return;
    setDeleting(null); setBusyId(member.id); setNotice(""); setActionError("");
    try {
      const response = await fetch("/api/admin/team/", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: member.id }) });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.error || "The account could not be deleted.");
      setNotice(body.outcome === "removed" ? `${member.name} was removed from the team and can no longer sign in. Their articles and author profile stay on the site.` : `${member.name}'s account was deleted.`);
      refresh();
    } catch (error) { setActionError(error instanceof Error ? error.message : "Could not reach the team service."); } finally { setBusyId(0); }
  }
  useEffect(() => {
    let cancelled = false;
    void fetch("/api/admin/team/", { cache: "no-store" }).then(async (response) => {
      const body = await response.json().catch(() => ({}));
      if (cancelled) return;
      if (!response.ok) { setError(body.error || "The team service returned an error."); return; }
      setError(""); setItems(body.items); setMe(body.me);
    }).catch(() => { if (!cancelled) setError("Could not reach the team service."); });
    return () => { cancelled = true; };
  }, [reload]);

  const admins = items?.filter((m) => m.role === "administrator" && m.active).length ?? 0;
  const editors = items?.filter((m) => m.role === "editor" && m.active).length ?? 0;

  return <div className="space-y-5 sm:space-y-6">
    <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <p className="pill text-xs font-bold uppercase tracking-[0.18em] text-violet-700">Team</p>
        <h1 className="mt-2 text-2xl font-extrabold text-[#12093a] sm:text-3xl">Team accounts</h1>
        <p className="mt-1.5 text-sm text-slate-500">People who can sign in to this workspace. Editors write and publish; administrators also manage the homepage, the team and the activity log.</p>
      </div>
      <button type="button" onClick={() => { setNotice(""); setEditing("new"); }} className={`${primaryButton} shrink-0 whitespace-nowrap`}><Icon name="plus" className="h-[18px] w-[18px]" />Add member</button>
    </div>

    {notice && <p role="status" className="rounded-xl bg-emerald-50 px-4 py-3 text-sm text-emerald-800">{notice}</p>}
    {actionError && <p role="alert" className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{actionError}</p>}

    <section className={cardClass} aria-label="Team members">
      <div className="mb-4 flex flex-wrap items-center gap-2 text-sm text-slate-600"><span className="font-bold text-[#12093a]">{items ? `${items.length} accounts` : "Accounts"}</span>{items && <span>· {admins} active administrators · {editors} active editors</span>}</div>
      {error ? <div role="alert" className="rounded-xl bg-red-50 px-4 py-6 text-center text-sm text-red-700">{error}<button type="button" onClick={refresh} className="ml-3 font-semibold text-violet-700 hover:underline">Retry</button></div>
        : !items ? <div className="space-y-3">{Array.from({ length: 5 }, (_, i) => <div key={i} className="flex items-center gap-3"><Skeleton className="h-10 w-10 rounded-full" /><div className="flex-1 space-y-2"><Skeleton className="h-4 w-1/3" /><Skeleton className="h-3 w-1/2" /></div><Skeleton className="h-8 w-20" /></div>)}</div>
          : items.length === 0 ? <div className="rounded-xl border border-dashed border-slate-200 px-4 py-10 text-center text-sm text-slate-500">No team accounts yet. <button type="button" onClick={() => setEditing("new")} className="font-semibold text-violet-700 hover:underline">Add the first editor</button></div>
            : <ul className="divide-y divide-slate-100">{items.map((m) => <li key={m.id} className={`flex flex-wrap items-center gap-3 py-3 sm:flex-nowrap ${m.active ? "" : "opacity-60"}`}>
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-violet-100 text-sm font-bold text-violet-700">{initials(m.name || m.username)}</span>
              <div className="min-w-0 flex-1 basis-40">
                <p className="flex flex-wrap items-center gap-2 text-sm font-semibold text-[#12093a]"><span className="break-words">{m.name}</span>{m.id === me && <span className="text-xs font-normal text-slate-400">(you)</span>}<RoleChip role={m.role} />{!m.active && <span className="pill rounded-md bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-600">Switched off</span>}</p>
                <p className="mt-0.5 truncate text-xs text-slate-500">{[m.username && `@${m.username}`, m.email].filter(Boolean).join(" · ") || "No sign-in details yet"}</p>
              </div>
              <dl className="grid grid-cols-3 gap-4 text-xs sm:w-72">
                <div><dt className="text-slate-400">Articles</dt><dd className="font-semibold text-slate-800">{m.posts.toLocaleString()}</dd></div>
                <div><dt className="text-slate-400">Last active</dt><dd className="font-semibold text-slate-800">{fmt(m.lastActive)}</dd></div>
                <div><dt className="text-slate-400">Joined</dt><dd className="font-semibold text-slate-800">{fmt(m.registered)}</dd></div>
              </dl>
              <div className="ml-auto flex items-center gap-1">
                <button type="button" onClick={() => { setNotice(""); setActionError(""); setEditing(m); }} className={secondaryButton}><Icon name="pencil" className="h-4 w-4" />Edit</button>
                {/* your own row has no delete; the empty slot keeps every row's columns in line */}
                {m.id === me ? <span aria-hidden className="h-11 w-11 shrink-0" /> : <button type="button" aria-label={`Delete ${m.name}`} title="Delete account" disabled={busyId === m.id} onClick={() => { setNotice(""); setActionError(""); setDeleting(m); }} className={`${iconButton} h-11 w-11 hover:bg-red-50 hover:text-red-600`}><Icon name="trash" className="h-[18px] w-[18px]" /></button>}
              </div>
            </li>)}</ul>}
    </section>

    <ConfirmDialog open={Boolean(deleting)} destructive onConfirm={() => void confirmDelete()} onCancel={cancelDelete}
      title={deleting && deleting.posts > 0 ? `Remove ${deleting.name} from the team?` : `Delete ${deleting?.name ?? "this account"}?`}
      body={deleting && deleting.posts > 0 ? `Their ${deleting.posts.toLocaleString()} articles keep ${deleting.name} as the author, and the author profile stays on the site. They are signed out and can no longer sign in.` : "The account is deleted for good and they are signed out. This cannot be undone."}
      confirmLabel={deleting && deleting.posts > 0 ? "Remove from team" : "Delete account"} />

    {editing !== null && <MemberDialog member={editing === "new" ? null : editing} me={me} onClose={() => setEditing(null)} onSaved={(message) => { setEditing(null); setNotice(message); refresh(); }} />}
  </div>;
}
