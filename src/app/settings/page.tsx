"use client";

import { useState, type ReactNode } from "react";
import {
  FONTS,
  REMINDER_SLOTS,
  TEXT_SIZES,
  TEXT_SIZE_LABELS,
  normalizeReminderTime,
  reminderLabel,
  setReadingPrefs,
  setReminder,
  useReadingPrefs,
  useReminder,
  type FontKey,
} from "@/lib/reader";
import { disableReminder, enableReminder, notificationPermission, pushConfigured } from "@/lib/push";
import Picker from "@/components/Picker";

/* Laid out like a phone's own Settings app: grouped cards, one control per row,
   a label on the left and the value on the right. Everything here is per-device
   and stored in localStorage — there is no account on this site. The one
   exception is the reminder, which also tags the reader's OneSignal
   subscription so the daily cron knows which slot to send them in
   (see app/api/reminder). */

function Group({ title, children, hint }: { title: string; children: ReactNode; hint?: string }) {
  return (
    <section>
      <h2 className="mb-2 px-1 text-[13px] font-semibold uppercase tracking-[0.08em] text-zinc-500">{title}</h2>
      <div className="overflow-hidden rounded-2xl bg-white shadow-[0_1px_2px_rgba(0,0,0,0.06),0_0_0_1px_rgba(0,0,0,0.04)]">{children}</div>
      {hint && <p className="mt-2 px-1 text-xs text-zinc-500">{hint}</p>}
    </section>
  );
}

function Row({ icon, label, hint, children, disabled = false }: { icon: ReactNode; label: string; hint?: string; children?: ReactNode; disabled?: boolean }) {
  return (
    <div className={`flex min-h-14 items-center gap-3 border-b border-zinc-100 py-2.5 pl-4 pr-3 last:border-0 ${disabled ? "opacity-45" : ""}`}>
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[9px] bg-[#693FE2] text-white">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden className="h-[18px] w-[18px]">
          {icon}
        </svg>
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-[15px] font-medium text-zinc-900">{label}</span>
        {hint && <span className="block text-xs text-zinc-500">{hint}</span>}
      </span>
      {children}
    </div>
  );
}

function Switch({ checked, onChange, disabled, label }: { checked: boolean; onChange: () => void; disabled?: boolean; label: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={onChange}
      className={`relative h-[31px] w-[51px] shrink-0 rounded-full transition-colors disabled:opacity-40 ${checked ? "bg-[#34C759]" : "bg-zinc-300"}`}
    >
      <span className={`absolute top-[2px] h-[27px] w-[27px] rounded-full bg-white shadow-[0_3px_8px_rgba(0,0,0,0.15),0_1px_1px_rgba(0,0,0,0.16)] transition-all ${checked ? "left-[22px]" : "left-[2px]"}`} />
    </button>
  );
}

const CUSTOM = "custom";

export default function SettingsPage() {
  const prefs = useReadingPrefs();
  const reminder = useReminder();
  const [busy, setBusy] = useState(false);
  // the custom box: what's typed, and whether the picker is on "Custom"
  const isPreset = (REMINDER_SLOTS as readonly string[]).includes(reminder.time);
  const [custom, setCustom] = useState<boolean>(false);
  const [draft, setDraft] = useState(reminder.time);
  const [draftError, setDraftError] = useState<string | null>(null);
  const showCustom = custom || !isPreset;

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

  const commitDraft = () => {
    const t = normalizeReminderTime(draft);
    if (!t) {
      setDraftError("Type a time like 7:30 or 19:45");
      return;
    }
    setDraftError(null);
    setDraft(t);
    if (t !== reminder.time) void applyReminder({ time: t });
  };

  const timeOptions = [
    ...REMINDER_SLOTS.map((t) => ({ value: t as string, label: reminderLabel(t) })),
    // a custom time already chosen shows up as its own option, so the picker
    // never displays something the reader didn't pick
    ...(!isPreset ? [{ value: reminder.time, label: `${reminderLabel(reminder.time)} (custom)` }] : []),
    { value: CUSTOM, label: "Custom…" },
  ];

  return (
    <div className="mx-auto max-w-xl">
      <h1 className="mb-5 px-1 text-[28px] font-extrabold tracking-tight">Settings</h1>

      <div className="space-y-7">
        <Group title="Display">
          <Row
            label="Text size"
            hint={TEXT_SIZE_LABELS[prefs.size]}
            icon={<path d="M4 18 9.5 5h1L16 18M6.2 13.5h6.6M17 11.5l2-5 2 5m-3.4 0h2.8" />}
          >
            <Picker
              label="Text size"
              value={prefs.size}
              onChange={(v) => setReadingPrefs({ size: v })}
              options={TEXT_SIZES.map((_, i) => ({ value: i, label: TEXT_SIZE_LABELS[i] }))}
            />
          </Row>
          <Row
            label="Font"
            hint="Article text"
            icon={<path d="M6 4h12M12 4v16M8 20h8" />}
          >
            <Picker<FontKey>
              label="Font"
              value={prefs.font}
              onChange={(v) => setReadingPrefs({ font: v })}
              // each row previews its own face
              options={FONTS.map((f) => ({ value: f.key, label: f.label, style: { fontFamily: f.var } }))}
            />
          </Row>
          {/* the preview uses the same custom properties the article body reads,
              so what moves here is exactly what moves on a post */}
          <div className="border-t border-zinc-100 bg-zinc-50/70 px-4 py-4">
            <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-[0.08em] text-zinc-400">Preview</p>
            <p className="reader-body leading-relaxed text-zinc-800">ഖുർആൻ പഠനത്തിന്റെ വഴികൾ — വായന എളുപ്പമാക്കാൻ അക്ഷര വലുപ്പം ക്രമീകരിക്കുക.</p>
          </div>
        </Group>

        <Group
          title="Daily reminder"
          hint={
            !configured
              ? "Push isn't configured for this site yet, so reminders can't be delivered."
              : blocked
                ? "Notifications are blocked for this site in your browser settings — allow them there first."
                : "Delivered in your own timezone, rounded to the nearest 15 minutes."
          }
        >
          <Row
            label="Remind me to read"
            hint="A daily nudge with the latest article"
            icon={
              <>
                <path d="M6 16V11a6 6 0 0 1 12 0v5l1.5 2h-15z" />
                <path d="M10 20a2 2 0 0 0 4 0" />
              </>
            }
          >
            <Switch label="Remind me to read" checked={reminder.enabled} disabled={blocked || !configured} onChange={() => void applyReminder({ enabled: !reminder.enabled })} />
          </Row>
          <Row
            label="Time"
            hint={reminder.enabled ? reminderLabel(reminder.time) : "Turn the reminder on first"}
            disabled={!reminder.enabled}
            icon={
              <>
                <circle cx="12" cy="12" r="8.5" />
                <path d="M12 7.5V12l3 2" />
              </>
            }
          >
            <Picker
              label="Reminder time"
              value={showCustom ? CUSTOM : reminder.time}
              disabled={!reminder.enabled}
              onChange={(v) => {
                if (v === CUSTOM) {
                  setCustom(true);
                  setDraft(reminder.time);
                  return;
                }
                setCustom(false);
                setDraftError(null);
                void applyReminder({ time: v });
              }}
              options={timeOptions}
            />
          </Row>
          {showCustom && (
            <div className={`border-t border-zinc-100 px-4 py-3 ${reminder.enabled ? "" : "opacity-45"}`}>
              <label htmlFor="custom-time" className="block text-xs font-semibold text-zinc-600">
                Custom time (24-hour, e.g. 07:30 or 19:45)
              </label>
              <div className="mt-2 flex gap-2">
                <input
                  id="custom-time"
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]{1,2}:[0-9]{2}"
                  placeholder="HH:MM"
                  value={draft}
                  disabled={!reminder.enabled || busy}
                  onChange={(e) => setDraft(e.target.value)}
                  onBlur={commitDraft}
                  onKeyDown={(e) => e.key === "Enter" && commitDraft()}
                  className="min-h-11 w-full rounded-xl border border-zinc-200 bg-white px-3 text-[15px] font-semibold tabular-nums outline-none transition focus-visible:border-[#693FE2] focus-visible:ring-2 focus-visible:ring-[#693FE2]/30 disabled:cursor-not-allowed"
                />
                <button
                  type="button"
                  onClick={commitDraft}
                  disabled={!reminder.enabled || busy}
                  className="min-h-11 shrink-0 rounded-xl bg-[#693FE2] px-4 text-sm font-semibold text-white transition hover:bg-[#5a34c7] disabled:opacity-50"
                >
                  Set
                </button>
              </div>
              {draftError && <p className="mt-1.5 text-xs text-red-600">{draftError}</p>}
            </div>
          )}
        </Group>

      </div>
    </div>
  );
}
