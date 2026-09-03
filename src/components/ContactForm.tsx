"use client";

import { useState } from "react";

const EMAIL = "editor@islamonlive.in";
const WHATSAPP = "https://wa.me/919895944006";

/* what the message is about — the live site's Elementor form is JS-only and its
   endpoint isn't reachable from here, so the form composes the message and hands
   it to the sender's own mail app (or WhatsApp). Nothing is posted to a server. */
const MATTERS = ["Article submission", "Feedback", "Correction", "Advertising", "Other"] as const;
type Matter = (typeof MATTERS)[number];

const field =
  "w-full min-h-11 rounded-lg border border-zinc-300 bg-white px-3 py-2.5 text-sm text-zinc-900 outline-none transition placeholder:text-zinc-400 focus:border-purple-700 focus:ring-2 focus:ring-purple-100";

export default function ContactForm() {
  const [matter, setMatter] = useState<Matter>("Article submission");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [touched, setTouched] = useState(false);
  const [copied, setCopied] = useState(false);

  const missing = { name: !name.trim(), email: !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email), message: message.trim().length < 10 };
  const invalid = missing.name || missing.email || missing.message;

  const body = `${message.trim()}\n\n—\n${name.trim()}\n${email.trim()}`;
  const mailto = `mailto:${EMAIL}?subject=${encodeURIComponent(`[${matter}] ${name.trim() || "Message from islamonlive.in"}`)}&body=${encodeURIComponent(body)}`;
  const whatsapp = `${WHATSAPP}?text=${encodeURIComponent(`[${matter}]\n${body}`)}`;

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setTouched(true);
    if (invalid) return;
    // opens the sender's mail client with everything already filled in
    window.location.href = mailto;
  };

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(`To: ${EMAIL}\nSubject: [${matter}] ${name.trim()}\n\n${body}`);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2500);
    } catch {
      // clipboard blocked (insecure context, denied permission) — the mail button still works
    }
  };

  return (
    <form onSubmit={submit} noValidate className="space-y-4">
      <div>
        <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-zinc-500">What is it about?</p>
        <div className="flex flex-wrap gap-2">
          {MATTERS.map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setMatter(m)}
              aria-pressed={m === matter}
              className={`pill min-h-10 rounded-full px-3.5 py-2 text-xs font-semibold transition ${
                m === matter ? "bg-purple-800 text-white" : "text-zinc-600 ring-1 ring-zinc-300 hover:bg-purple-50 hover:text-purple-800"
              }`}
            >
              {m}
            </button>
          ))}
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="cf-name" className="mb-1 block text-sm font-medium text-zinc-700">Your name</label>
          <input id="cf-name" value={name} onChange={(e) => setName(e.target.value)} className={field} placeholder="Full name" autoComplete="name" />
          {touched && missing.name && <p className="mt-1 text-xs text-red-600">Please enter your name.</p>}
        </div>
        <div>
          <label htmlFor="cf-email" className="mb-1 block text-sm font-medium text-zinc-700">Your email</label>
          <input id="cf-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} className={field} placeholder="you@example.com" autoComplete="email" />
          {touched && missing.email && <p className="mt-1 text-xs text-red-600">Please enter a valid email address.</p>}
        </div>
      </div>

      <div>
        <label htmlFor="cf-message" className="mb-1 block text-sm font-medium text-zinc-700">Message</label>
        <textarea
          id="cf-message"
          rows={6}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          className={`${field} min-h-32 resize-y`}
          placeholder="Tell us what you are sending — the article, the correction, or the question."
        />
        {touched && missing.message && <p className="mt-1 text-xs text-red-600">Please write at least a couple of sentences.</p>}
      </div>

      <div className="flex flex-wrap items-center gap-3 border-t border-zinc-100 pt-4">
        <button
          type="submit"
          className="pill inline-flex min-h-11 items-center gap-2 rounded-full bg-purple-800 px-5 py-2.5 text-xs font-semibold text-white transition hover:bg-purple-700"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden className="h-3.5 w-3.5">
            <path d="M22 2 11 13M22 2l-7 20-4-9-9-4 20-7z" />
          </svg>
          Send
        </button>
        <a
          href={whatsapp}
          target="_blank"
          rel="noopener noreferrer"
          className="pill inline-flex min-h-11 items-center gap-2 rounded-full px-4 py-2.5 text-xs font-semibold text-purple-800 ring-1 ring-purple-300 transition hover:bg-purple-50"
        >
          Send on WhatsApp
        </a>
        <button type="button" onClick={copy} className="min-h-11 px-1 text-xs font-medium text-zinc-500 underline-offset-2 hover:text-purple-800 hover:underline">
          {copied ? "Copied" : "Copy instead"}
        </button>
      </div>
    </form>
  );
}
