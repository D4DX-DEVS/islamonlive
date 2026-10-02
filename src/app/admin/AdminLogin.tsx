"use client";

import { FormEvent, useState } from "react";
import Image from "next/image";

const iconProps = { "aria-hidden": true, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.8, strokeLinecap: "round", strokeLinejoin: "round" } as const;

function UserIcon({ className }: { className?: string }) {
  return <svg {...iconProps} className={className}><circle cx="12" cy="8" r="4" /><path d="M4 20c0-3.5 3.6-6 8-6s8 2.5 8 6" /></svg>;
}

function LockIcon({ className }: { className?: string }) {
  return <svg {...iconProps} className={className}><rect x="5" y="11" width="14" height="9" rx="2.5" /><path d="M8 11V8a4 4 0 018 0v3" /><circle cx="12" cy="15.5" r="1" fill="currentColor" stroke="none" /></svg>;
}

function EyeIcon({ off, className }: { off: boolean; className?: string }) {
  return off
    ? <svg {...iconProps} className={className}><path d="M3 3l18 18M10.58 10.58a2 2 0 102.83 2.83M9.88 4.24A10.7 10.7 0 0112 4c5.25 0 8.94 4.36 10 8a11.8 11.8 0 01-3.05 5.28M6.23 6.23C4.56 7.46 3.34 9.24 2 12c1.06 3.64 4.75 8 10 8 1.18 0 2.28-.2 3.28-.56" /></svg>
    : <svg {...iconProps} className={className}><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z" /><circle cx="12" cy="12" r="2.5" /></svg>;
}

function ArrowIcon({ className }: { className?: string }) {
  return <svg {...iconProps} strokeWidth={2} className={className}><path d="M5 12h14M13 6l6 6-6 6" /></svg>;
}

function DocumentIcon({ className }: { className?: string }) {
  return <svg {...iconProps} className={className}><path d="M7 3h7l5 5v12a1 1 0 01-1 1H7a1 1 0 01-1-1V4a1 1 0 011-1z" /><path d="M14 3v5h5M9 13h6M9 17h6" /></svg>;
}

function ImageIcon({ className }: { className?: string }) {
  return <svg {...iconProps} className={className}><rect x="3" y="4" width="18" height="16" rx="2.5" /><circle cx="9" cy="10" r="1.6" /><path d="M21 16l-5-5-8 9" /></svg>;
}

function UsersIcon({ className }: { className?: string }) {
  return <svg {...iconProps} className={className}><circle cx="12" cy="8" r="3" /><circle cx="5.5" cy="10" r="2.2" /><circle cx="18.5" cy="10" r="2.2" /><path d="M6.5 20c0-3 2.4-5 5.5-5s5.5 2 5.5 5M1.5 18.5c0-2 1.6-3.5 4-3.5M22.5 18.5c0-2-1.6-3.5-4-3.5" /></svg>;
}

function ChartIcon({ className }: { className?: string }) {
  return <svg {...iconProps} className={className}><path d="M5 20v-7M12 20V5M19 20v-10" /></svg>;
}

const features = [
  { label: ["Manage", "Articles"], Icon: DocumentIcon },
  { label: ["Organize", "Media"], Icon: ImageIcon },
  { label: ["Manage", "Authors"], Icon: UsersIcon },
  { label: ["View", "Analytics"], Icon: ChartIcon },
];

/* Decorative only: a stylised dashboard with floating content cards. */
function DashboardIllustration() {
  return <svg aria-hidden="true" viewBox="0 0 520 330" className="h-auto w-full max-w-[520px]">
    <defs>
      <linearGradient id="login-glow" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#a78bfa" /><stop offset="1" stopColor="#6d28d9" /></linearGradient>
      <linearGradient id="login-window" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#ffffff" /><stop offset="1" stopColor="#ece8ff" /></linearGradient>
      <linearGradient id="login-chart" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#8b5cf6" stopOpacity=".28" /><stop offset="1" stopColor="#8b5cf6" stopOpacity="0" /></linearGradient>
      <clipPath id="login-window-clip"><rect x="22" y="58" width="330" height="224" rx="18" /></clipPath>
      <filter id="login-shadow" x="-20%" y="-20%" width="140%" height="150%"><feDropShadow dx="0" dy="10" stdDeviation="10" floodColor="#1e0a4d" floodOpacity=".35" /></filter>
    </defs>
    <rect x="150" y="26" width="300" height="220" rx="26" fill="url(#login-glow)" opacity=".75" transform="rotate(6 300 136)" />
    <g filter="url(#login-shadow)">
      <rect x="22" y="58" width="330" height="224" rx="18" fill="url(#login-window)" />
    </g>
    <circle cx="44" cy="78" r="4" fill="#c4b5fd" /><rect x="56" y="75" width="22" height="6" rx="3" fill="#ddd6fe" />
    <g clipPath="url(#login-window-clip)"><rect x="22" y="94" width="72" height="188" fill="#2b2352" /></g>
    <circle cx="58" cy="116" r="12" fill="#6d28d9" /><text x="58" y="121" textAnchor="middle" fontFamily="Georgia, serif" fontSize="14" fontWeight="700" fill="#fff">W</text>
    {[146, 170, 194, 218].map((y) => <g key={y}><rect x="36" y={y} width="9" height="9" rx="3" fill="#7c6bb5" /><rect x="52" y={y + 2} width="30" height="5" rx="2.5" fill="#4b3f84" /></g>)}
    <rect x="110" y="110" width="76" height="8" rx="4" fill="#ddd6fe" /><rect x="110" y="124" width="44" height="6" rx="3" fill="#ede9fe" />
    <path d="M110 205c24-6 30-34 56-30s34 28 58 8 32-34 56-22" fill="none" stroke="#7c3aed" strokeWidth="3" strokeLinecap="round" />
    <path d="M110 205c24-6 30-34 56-30s34 28 58 8 32-34 56-22V232H110z" fill="url(#login-chart)" />
    <rect x="110" y="244" width="60" height="6" rx="3" fill="#ddd6fe" /><rect x="110" y="258" width="130" height="6" rx="3" fill="#ede9fe" />
    <circle cx="316" cy="124" r="11" fill="none" stroke="#ddd6fe" strokeWidth="3" />

    <circle cx="440" cy="52" r="36" fill="#4c1d95" stroke="#fff" strokeOpacity=".9" strokeWidth="5" />
    <text x="440" y="66" textAnchor="middle" fontFamily="Georgia, serif" fontSize="42" fontWeight="700" fill="#fff">W</text>

    <g filter="url(#login-shadow)">
      <rect x="330" y="112" width="170" height="64" rx="14" fill="#f5f3ff" />
      <rect x="342" y="126" width="34" height="38" rx="8" fill="#fff" />
      <path d="M351 137h16M351 144h16M351 151h10" stroke="#8b5cf6" strokeWidth="2.5" strokeLinecap="round" />
      <rect x="388" y="130" width="96" height="9" rx="4.5" fill="#a78bfa" /><rect x="388" y="146" width="66" height="8" rx="4" fill="#ddd6fe" />
    </g>
    <g filter="url(#login-shadow)">
      <rect x="268" y="176" width="108" height="100" rx="16" fill="#f5f3ff" />
      <rect x="282" y="190" width="80" height="62" rx="12" fill="#fff" />
      <path d="M282 238l22-22 16 16 12-10 30 24v10a10 10 0 01-10 10h-60a10 10 0 01-10-10z" fill="#7c3aed" opacity=".9" />
      <circle cx="340" cy="206" r="6" fill="#c4b5fd" />
      <rect x="296" y="262" width="52" height="6" rx="3" fill="#ddd6fe" />
    </g>
    <g filter="url(#login-shadow)">
      <rect x="388" y="192" width="112" height="100" rx="16" fill="#f5f3ff" />
      <rect x="408" y="248" width="14" height="22" rx="4" fill="#c4b5fd" /><rect x="432" y="232" width="14" height="38" rx="4" fill="#a78bfa" />
      <rect x="456" y="214" width="14" height="56" rx="4" fill="#7c3aed" />
      <rect x="406" y="206" width="40" height="6" rx="3" fill="#ddd6fe" />
    </g>
  </svg>;
}

export default function AdminLogin({ lostPasswordUrl }: { lostPasswordUrl: string }) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [remember, setRemember] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault(); setError(""); setLoading(true);
    const response = await fetch("/api/admin/login/", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ username, password, remember }) });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) setError(body.error || "Login failed"); else window.location.reload();
    setLoading(false);
  }

  const fieldClass = "block min-h-14 w-full rounded-xl border border-[#dbe3f7] bg-[#eef2ff] pl-12 pr-4 text-base text-slate-900 outline-none transition placeholder:text-slate-400 focus-visible:border-violet-500 focus-visible:bg-white focus-visible:ring-4 focus-visible:ring-violet-100";
  const fieldIconClass = "pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-500";

  return <div className="fixed inset-0 z-[100] overflow-auto bg-[#f3f0ff] text-slate-900">
    <div aria-hidden className="pointer-events-none absolute -left-32 -top-32 h-[28rem] w-[28rem] rounded-full bg-violet-300/40 blur-3xl" />
    <div aria-hidden className="pointer-events-none absolute -bottom-40 -right-32 h-[30rem] w-[30rem] rounded-full bg-indigo-300/40 blur-3xl" />
    <div aria-hidden className="pointer-events-none absolute left-8 top-1/3 hidden h-32 w-32 bg-[radial-gradient(#c4b5fd_1.5px,transparent_1.5px)] [background-size:16px_16px] xl:block" />

    <div className="relative flex min-h-full items-center justify-center px-4 py-6 sm:px-8 sm:py-10">
      <div className="grid w-full max-w-[1040px] overflow-hidden rounded-[28px] bg-white shadow-[0_30px_80px_-24px_rgba(76,29,149,0.45)] md:grid-cols-2">
        <aside className="relative flex flex-col overflow-hidden bg-[linear-gradient(150deg,#1e0b4b_0%,#3b1a8f_48%,#6d28d9_100%)] p-6 text-white sm:p-8 md:p-10">
          <div aria-hidden className="pointer-events-none absolute -right-24 top-0 h-80 w-80 rounded-full bg-fuchsia-500/30 blur-3xl" />
          <div aria-hidden className="pointer-events-none absolute -bottom-32 -left-16 h-72 w-96 rounded-[50%] bg-violet-400/20 blur-3xl" />
          <div className="relative flex flex-1 flex-col">
            <Image src="/logo-white.png" alt="Islamonlive" width={350} height={95} priority className="h-10 w-auto self-start object-contain md:h-11" />
            <div className="mt-5 h-0.5 w-14 rounded-full bg-violet-400" />
            <h2 className="mt-5 text-3xl font-extrabold tracking-tight sm:text-4xl">Welcome back!</h2>
            <p className="mt-2 max-w-sm text-base leading-relaxed text-violet-100/90">Access your WordPress admin workspace to manage your content and media.</p>
            <div className="my-6 hidden flex-1 items-center justify-center md:flex"><DashboardIllustration /></div>
            <ul className="mt-auto hidden grid-cols-4 gap-3 md:grid">
              {features.map(({ label, Icon }) => <li key={label.join(" ")} className="flex flex-col items-center gap-2 text-center">
                <span className="flex h-14 w-14 items-center justify-center rounded-2xl border border-white/10 bg-white/10 text-violet-100 shadow-inner"><Icon className="h-6 w-6" /></span>
                <span className="text-xs leading-snug text-violet-100/90">{label[0]}<br />{label[1]}</span>
              </li>)}
            </ul>
          </div>
        </aside>

        <section className="flex flex-col justify-center p-6 sm:p-10 lg:p-14">
          <p className="pill text-xs font-bold uppercase tracking-[0.3em] text-violet-700">Islamonlive</p>
          <h1 className="mt-3 text-3xl font-extrabold tracking-tight text-slate-950 sm:text-4xl">Admin workspace</h1>
          <p className="mt-3 text-base leading-relaxed text-slate-500">Sign in with your existing WordPress admin account to continue.</p>

          <form onSubmit={submit} className="mt-8 space-y-5">
            <label className="block text-sm font-semibold text-slate-900">WordPress username
              <span className="relative mt-2 block">
                <UserIcon className={fieldIconClass} />
                <input className={fieldClass} value={username} onChange={(event) => setUsername(event.target.value)} autoComplete="username" placeholder="Enter your username" autoCapitalize="none" spellCheck={false} required />
              </span>
            </label>
            <label className="block text-sm font-semibold text-slate-900">WordPress password
              <span className="relative mt-2 block">
                <LockIcon className={fieldIconClass} />
                <input className={`${fieldClass} pr-12`} type={showPassword ? "text" : "password"} value={password} onChange={(event) => setPassword(event.target.value)} autoComplete="current-password" placeholder="Enter your password" required />
                <button type="button" aria-label={showPassword ? "Hide password" : "Show password"} title={showPassword ? "Hide password" : "Show password"} onClick={() => setShowPassword((current) => !current)} className="absolute inset-y-0 right-0 flex w-12 items-center justify-center text-slate-500 transition hover:text-violet-700 focus-visible:text-violet-700 focus-visible:outline-none">
                  <EyeIcon off={showPassword} className="h-5 w-5" />
                </button>
              </span>
            </label>

            <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
              <label className="flex min-h-8 items-center gap-2.5 text-sm text-slate-700"><input type="checkbox" checked={remember} onChange={(event) => setRemember(event.target.checked)} className="h-5 w-5 rounded-md border-slate-300 accent-violet-700" />Remember me</label>
              <a href={lostPasswordUrl} target="_blank" rel="noopener noreferrer" className="text-sm font-medium text-violet-700 underline underline-offset-4 hover:text-violet-900">Forgot password?</a>
            </div>

            {error && <p role="alert" className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>}

            <button disabled={loading} className="group flex min-h-14 w-full items-center justify-center gap-2 rounded-xl bg-[linear-gradient(90deg,#7c3aed,#6d28d9)] px-4 py-3 text-base font-bold text-white shadow-[0_12px_28px_-10px_rgba(109,40,217,0.75)] transition hover:brightness-110 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-violet-200 disabled:opacity-60">
              {loading ? "Connecting…" : <>Sign in<ArrowIcon className="h-5 w-5 transition-transform motion-safe:group-hover:translate-x-0.5" /></>}
            </button>
          </form>

          <div className="mt-6 flex items-start gap-3 rounded-xl border border-slate-100 bg-slate-50 px-4 py-3.5">
            <LockIcon className="mt-0.5 h-5 w-5 shrink-0 text-violet-500" />
            <p className="text-xs leading-relaxed text-slate-500">Your credentials are sent only to the WordPress origin through this server. They are not stored in the browser.</p>
          </div>
        </section>
      </div>
    </div>
  </div>;
}
