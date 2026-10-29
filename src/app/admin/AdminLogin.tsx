"use client";

import { FormEvent, KeyboardEvent, useRef, useState } from "react";
import Image from "next/image";

/* The admin's sign-in. One quiet card: the account is checked by this server
   against the site's own user database, and the session is an encrypted,
   HTTP-only cookie — nothing about the login lives in the browser. */

const iconProps = { "aria-hidden": true, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.8, strokeLinecap: "round", strokeLinejoin: "round" } as const;

function UserIcon({ className }: { className?: string }) {
  return <svg {...iconProps} className={className}><circle cx="12" cy="8" r="4" /><path d="M4 20c0-3.5 3.6-6 8-6s8 2.5 8 6" /></svg>;
}

function LockIcon({ className }: { className?: string }) {
  return <svg {...iconProps} className={className}><rect x="5" y="11" width="14" height="9" rx="2.5" /><path d="M8 11V8a4 4 0 018 0v3" /></svg>;
}

function EyeIcon({ off, className }: { off: boolean; className?: string }) {
  return off
    ? <svg {...iconProps} className={className}><path d="M3 3l18 18M10.6 10.6a2 2 0 002.8 2.8M9.9 4.2A10.7 10.7 0 0112 4c6.5 0 10 8 10 8a15 15 0 01-3 4.1M6.2 6.2C3.7 7.9 2 12 2 12s3.5 7 10 7c1.2 0 2.3-.2 3.3-.6" /></svg>
    : <svg {...iconProps} className={className}><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z" /><circle cx="12" cy="12" r="2.5" /></svg>;
}

function ShieldIcon({ className }: { className?: string }) {
  return <svg {...iconProps} className={className}><path d="M12 3l7.5 3v5.5c0 4.5-3.2 8.3-7.5 9.5-4.3-1.2-7.5-5-7.5-9.5V6z" /><path d="M9 12l2.2 2.2L15.5 10" /></svg>;
}

function Spinner() {
  return <svg aria-hidden viewBox="0 0 24 24" className="h-5 w-5 animate-spin"><circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" strokeOpacity=".3" strokeWidth="3" /><path d="M21 12a9 9 0 00-9-9" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" /></svg>;
}

const highlights = [
  { title: "Write and publish", body: "Drafts, scheduling, SEO and featured video in one editor." },
  { title: "Shape the homepage", body: "Arrange every section without a deploy." },
  { title: "Know who did what", body: "Every save, publish and upload is signed." },
];

export default function AdminLogin({ lostPasswordUrl }: { lostPasswordUrl: string }) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [remember, setRemember] = useState(true);
  const [capsLock, setCapsLock] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [signedIn, setSignedIn] = useState(false);
  const passwordRef = useRef<HTMLInputElement>(null);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (loading) return;
    setError(""); setLoading(true);
    try {
      const response = await fetch("/api/admin/login/", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ username, password, remember }) });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) {
        setError(response.status === 401 ? "That username or password is not right. Check them and try again." : body.error || "Sign-in failed. Try again.");
        setPassword(""); passwordRef.current?.focus();
        setLoading(false);
        return;
      }
      setSignedIn(true);
      // the page re-renders on the server with the session, straight into the workspace
      window.location.replace("/admin/");
    } catch {
      setError("Could not reach the server. Check your connection and try again.");
      setLoading(false);
    }
  }

  const caps = (event: KeyboardEvent<HTMLInputElement>) => setCapsLock(event.getModifierState?.("CapsLock") ?? false);
  const field = "block min-h-12 w-full rounded-xl border border-slate-200 bg-white pl-11 pr-4 text-[15px] text-slate-900 shadow-sm outline-none transition placeholder:text-slate-400 hover:border-slate-300 focus-visible:border-violet-500 focus-visible:ring-4 focus-visible:ring-violet-100 aria-[invalid=true]:border-red-300";
  const fieldIcon = "pointer-events-none absolute left-3.5 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400";

  return <div className="fixed inset-0 z-[100] overflow-auto bg-white text-slate-900">
    <div className="grid min-h-full lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)]">
      <aside className="relative hidden overflow-hidden bg-[#160a35] lg:flex lg:flex-col lg:justify-between lg:p-12 xl:p-16">
        <div aria-hidden className="absolute inset-0 bg-[radial-gradient(80%_60%_at_100%_0%,rgba(139,92,246,0.45),transparent_60%),radial-gradient(70%_60%_at_0%_100%,rgba(79,70,229,0.35),transparent_60%)]" />
        <div aria-hidden className="absolute inset-0 opacity-[0.07] [background-image:linear-gradient(rgba(255,255,255,.8)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,.8)_1px,transparent_1px)] [background-size:44px_44px]" />
        <Image src="/logo-white.png" alt="Islamonlive" width={350} height={95} priority className="relative h-10 w-auto self-start object-contain" />
        <div className="relative max-w-md">
          <p className="pill text-xs font-bold uppercase tracking-[0.28em] text-violet-300">Islamonlive Studio</p>
          <h2 className="mt-4 text-4xl font-extrabold leading-tight tracking-tight text-white xl:text-5xl">The newsroom, in one place.</h2>
          <ul className="mt-10 space-y-5">
            {highlights.map((item) => <li key={item.title} className="flex gap-4">
              <span className="mt-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-violet-500/20 text-violet-200 ring-1 ring-violet-400/30"><svg {...iconProps} strokeWidth={2.4} className="h-3.5 w-3.5"><path d="M5 12.5l4.5 4.5L19 7.5" /></svg></span>
              <span><span className="block text-[15px] font-semibold text-white">{item.title}</span><span className="text-sm text-violet-100/70">{item.body}</span></span>
            </li>)}
          </ul>
        </div>
        <p className="relative text-xs text-violet-100/50">© {new Date().getFullYear()} Islamonlive · Knowledge · Community · Impact</p>
      </aside>

      <main className="flex items-center justify-center px-5 py-10 sm:px-10">
        <div className="w-full max-w-[400px]">
          <Image src="/logo.png" alt="Islamonlive" width={132} height={36} priority className="h-9 w-auto object-contain lg:hidden" />
          <h1 className="mt-8 text-[28px] font-extrabold tracking-tight text-[#12093a] lg:mt-0">Sign in</h1>
          <p className="mt-2 text-[15px] text-slate-500">Welcome back. Use your team account to open the workspace.</p>

          <form onSubmit={submit} noValidate className="mt-8 space-y-5">
            <div>
              <label htmlFor="login-user" className="text-sm font-semibold text-slate-800">Username or email</label>
              <span className="relative mt-2 block">
                <UserIcon className={fieldIcon} />
                <input id="login-user" className={field} value={username} onChange={(event) => setUsername(event.target.value)} autoComplete="username" autoCapitalize="none" spellCheck={false} autoFocus required aria-invalid={Boolean(error)} placeholder="you@islamonlive.in" />
              </span>
            </div>
            <div>
              <label htmlFor="login-password" className="text-sm font-semibold text-slate-800">Password</label>
              <span className="relative mt-2 block">
                <LockIcon className={fieldIcon} />
                <input id="login-password" ref={passwordRef} className={`${field} pr-12`} type={showPassword ? "text" : "password"} value={password} onChange={(event) => setPassword(event.target.value)} onKeyUp={caps} onKeyDown={caps} autoComplete="current-password" required aria-invalid={Boolean(error)} aria-describedby={capsLock ? "login-caps" : undefined} placeholder="Your password" />
                <button type="button" aria-label={showPassword ? "Hide password" : "Show password"} aria-pressed={showPassword} onClick={() => setShowPassword((current) => !current)} className="absolute inset-y-0 right-0 flex w-12 items-center justify-center rounded-r-xl text-slate-400 transition hover:text-violet-700 focus-visible:text-violet-700 focus-visible:outline-none">
                  <EyeIcon off={showPassword} className="h-5 w-5" />
                </button>
              </span>
              {capsLock && <p id="login-caps" className="mt-2 text-xs font-medium text-amber-700">Caps Lock is on.</p>}
            </div>

            <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
              <label className="flex min-h-11 cursor-pointer items-center gap-2.5 text-sm text-slate-700"><input type="checkbox" checked={remember} onChange={(event) => setRemember(event.target.checked)} className="h-[18px] w-[18px] rounded border-slate-300 accent-violet-700" />Keep me signed in for 14 days</label>
              {lostPasswordUrl === "mongodb"
                ? <span className="text-sm text-slate-500">Forgot it? Ask an administrator.</span>
                : <a href={lostPasswordUrl} target="_blank" rel="noopener noreferrer" className="text-sm font-medium text-violet-700 underline-offset-4 hover:underline">Forgot password?</a>}
            </div>

            {error && <p role="alert" className="flex items-start gap-2 rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>}

            <button type="submit" disabled={loading || !username.trim() || !password} className="flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#5b21b6] px-4 text-[15px] font-bold text-white shadow-[0_10px_24px_-12px_rgba(91,33,182,0.9)] transition hover:bg-[#4c1d95] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-violet-200 disabled:cursor-not-allowed disabled:opacity-60">
              {loading ? <><Spinner />{signedIn ? "Opening workspace…" : "Signing in…"}</> : "Sign in"}
            </button>
          </form>

          <p className="mt-8 flex items-center gap-2 text-xs text-slate-500"><ShieldIcon className="h-4 w-4 shrink-0 text-violet-500" />Protected sign-in: repeated failed attempts are paused for 10 minutes.</p>
        </div>
      </main>
    </div>
  </div>;
}
