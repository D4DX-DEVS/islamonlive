"use client";

import { useState } from "react";
import Link from "next/link";
import {
  FONTS,
  REMINDER_SLOTS,
  TEXT_SIZES,
  setReadingPrefs,
  setReminder,
  useReadingPrefs,
  useReminder,
  useRecent,
  useSavedCount,
} from "@/lib/reader";
import { disableReminder, enableReminder, notificationPermission, pushConfigured } from "@/lib/push";

/* Everything on this page is per-device and stored in localStorage — there is no
   account on this site. The one exception is the reminder, which also tags the
   reader's OneSignal subscription so the daily cron knows which slot to send them
   in (see app/api/reminder). */

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="mb-3 text-xs font-bold uppercase tracking-[0.14em] text-purple-800">{title}</h2>
      <div className="overflow-hidden rounded-2xl border border-zinc-200/80 bg-white shadow-sm">{children}</div>
    </section>
  );
}

function Row({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <div className={`border-b border-zinc-100 p-4 last:border-0 sm:p-5 ${className}`}>{children}</div>;
}

function LinkRow({ href, label, hint, badge }: { href: string; label: string; hint?: string; badge?: string }) {
  return (
    <Link href={href} className="flex min-h-14 items-center gap-3 border-b border-zinc-100 p-4 transition-colors last:border-0 hover:bg-purple-50/60 sm:p-5">
      <span className="min-w-0 flex-1">
        <span className="block text-[15px] font-semibold text-zinc-900">{label}</span>
        {hint && <span className="block text-xs text-zinc-500">{hint}</span>}
      </span>
      {badge && <span className="pill rounded-full bg-purple-100 px-2 py-0.5 text-xs font-bold text-purple-800">{badge}</span>}
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden className="h-4 w-4 shrink-0 text-zinc-300">
        <path d="m9 5 7 7-7 7" />
      </svg>
    </Link>
  );
}

export default function SettingsPage() {
  const prefs = useReadingPrefs();
  const reminder = useReminder();
  const savedCount = useSavedCount();
  const recent = useRecent();
  const [busy, setBusy] = useState(false);

  const permission = notificationPermission();
  const configured = pushConfigured();
  const blocked = permission === "denied";

  const applyReminder = async (next: { time?: string; enabled?: boolean }) => {
    const merged = { time: next.time ?? reminder.time, enabled: next.enabled ?? reminder.enabled };
    setReminder(merged);
    setBusy(true);
    // the toggle reflects the choice immediately; the tag catches up
    if (merged.enabled) await enableReminder(merged.time);
    else await disableReminder();
    setBusy(false);
  };

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="mb-6 border-l-4 border-purple-800 pl-3 text-2xl font-extrabold">Settings</h1>

      <div className="space-y-8">
        <Section title="Reading">
          <Row>
            <div className="flex items-baseline justify-between">
              <label htmlFor="text-size" className="text-[15px] font-semibold text-zinc-900">Text size</label>
              <span className="text-xs text-zinc-500">{prefs.size + 1} / {TEXT_SIZES.length}</span>
            </div>
            <input
              id="text-size"
              type="range"
              min={0}
              max={TEXT_SIZES.length - 1}
              step={1}
              value={prefs.size}
              onChange={(e) => setReadingPrefs({ size: Number(e.target.value) })}
              className="mt-3 h-2 w-full cursor-pointer appearance-none rounded-full bg-zinc-200 accent-purple-800"
            />
            {/* the preview uses the same custom properties the article body reads,
                so what moves here is exactly what moves on a post */}
            <p className="reader-body mt-4 rounded-xl bg-zinc-50 p-3 leading-relaxed text-zinc-700">
              ഖുർആൻ പഠനത്തിന്റെ വഴികൾ
            </p>
          </Row>
          <Row>
            <p className="text-[15px] font-semibold text-zinc-900">Font</p>
            <div className="mt-3 flex flex-wrap gap-2">
              {FONTS.map((f) => (
                <button
                  key={f.key}
                  type="button"
                  onClick={() => setReadingPrefs({ font: f.key })}
                  aria-pressed={prefs.font === f.key}
                  style={{ fontFamily: f.var }}
                  className={`min-h-11 rounded-xl border px-4 text-sm transition ${
                    prefs.font === f.key
                      ? "border-purple-800 bg-purple-800 text-white"
                      : "border-zinc-200 text-zinc-700 hover:border-purple-300 hover:bg-purple-50"
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </Row>
        </Section>

        <Section title="Daily reminder">
          <Row>
            <div className="flex items-start gap-3">
              <span className="min-w-0 flex-1">
                <span className="block text-[15px] font-semibold text-zinc-900">Remind me to read</span>
                <span className="block text-xs text-zinc-500">A gentle daily nudge with the latest article</span>
              </span>
              <button
                type="button"
                role="switch"
                aria-checked={reminder.enabled}
                aria-label="Remind me to read"
                disabled={busy || blocked || !configured}
                onClick={() => void applyReminder({ enabled: !reminder.enabled })}
                className={`relative h-7 w-12 shrink-0 rounded-full transition disabled:opacity-40 ${reminder.enabled ? "bg-purple-800" : "bg-zinc-300"}`}
              >
                <span className={`absolute top-0.5 h-6 w-6 rounded-full bg-white shadow transition-all ${reminder.enabled ? "left-[1.375rem]" : "left-0.5"}`} />
              </button>
            </div>
            {!configured && (
              <p className="mt-3 text-xs text-amber-700">Push isn&apos;t configured for this site yet, so reminders can&apos;t be delivered.</p>
            )}
            {blocked && (
              <p className="mt-3 text-xs text-amber-700">Notifications are blocked for this site in your browser settings — allow them there first.</p>
            )}
          </Row>
          <Row className={reminder.enabled ? "" : "opacity-50"}>
            <p className="text-[15px] font-semibold text-zinc-900">Time</p>
            <p className="text-xs text-zinc-500">Delivered in your own timezone</p>
            <div className="mt-3 flex flex-wrap gap-2">
              {REMINDER_SLOTS.map((t) => (
                <button
                  key={t}
                  type="button"
                  disabled={!reminder.enabled || busy}
                  onClick={() => void applyReminder({ time: t })}
                  aria-pressed={reminder.time === t}
                  className={`min-h-11 min-w-16 rounded-xl border px-4 text-sm font-semibold transition disabled:cursor-not-allowed ${
                    reminder.time === t
                      ? "border-purple-800 bg-purple-800 text-white"
                      : "border-zinc-200 text-zinc-700 hover:border-purple-300 hover:bg-purple-50"
                  }`}
                >
                  {t}
                </button>
              ))}
            </div>
          </Row>
        </Section>

        <Section title="My reading">
          <LinkRow href="/saved" label="Saved articles" hint="Bookmarked from any post" badge={savedCount ? String(savedCount) : undefined} />
          <LinkRow href="/saved?tab=recent" label="Continue reading" hint={recent.length ? `Last: ${recent[0].title.slice(0, 48)}` : "Nothing read yet"} />
        </Section>

        <Section title="Feedback">
          <LinkRow href="/contact" label="Send feedback" hint="Tell us what to improve" />
        </Section>

        <Section title="About">
          <LinkRow href="/about" label="About IslamOnlive" hint="Malayalam Islamic reading portal" />
          <LinkRow href="/privacy-policy" label="Privacy Policy" />
          <LinkRow href="/terms-of-use" label="Terms of Use" />
          <Row>
            <p className="text-xs text-zinc-500">
              Saved posts, reading history and these preferences live only on this device. Clearing your browser data clears them.
            </p>
          </Row>
        </Section>
      </div>
    </div>
  );
}
