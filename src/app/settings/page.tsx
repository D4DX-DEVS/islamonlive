"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import {
  FONTS,
  REMINDER_SLOTS,
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
import TextSizePicker from "@/components/TextSizePicker";
import ConfirmDialog from "@/components/ConfirmDialog";

/* Laid out like a phone's own Settings app: a titled group per area, each with
   its own tinted glyph, and inside it a white card of rows — icon, label and
   sub-label on the left, the control on the right.

   Everything here is per-device and stored in localStorage; there is no account
   on this site. The one exception is the reminder, which also tags the reader's
   OneSignal subscription so the daily cron knows which slot to send them in
   (see app/api/reminder). */

type Tint = "purple" | "green" | "blue";

/* One family, three depths. The reference design used a different hue per
   section, but this site is purple end to end — the header above this page and
   the tab bar below it are both #31094C — and stray teal and sky-blue circles
   read as belonging to some other app. */
const TINT: Record<Tint, string> = {
  purple: "bg-purple-100 text-[#693FE2]",
  green: "bg-purple-50 text-[#5A34C7]",
  blue: "bg-[#31094C]/10 text-[#31094C]",
};

function Group({
  icon,
  tint,
  title,
  hint,
  children,
  note,
}: {
  icon: ReactNode;
  tint: Tint;
  title: string;
  hint: string;
  children: ReactNode;
  note?: string;
}) {
  return (
    <section>
      <div className="mb-3 flex items-center gap-3 px-1">
        <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${TINT[tint]}`}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden className="h-5 w-5">
            {icon}
          </svg>
        </span>
        <span className="min-w-0">
          <h2 className="text-[17px] font-extrabold leading-tight text-zinc-900">{title}</h2>
          <p className="text-[13px] leading-tight text-zinc-500">{hint}</p>
        </span>
      </div>
      <div className="overflow-hidden rounded-[20px] bg-white shadow-[0_1px_2px_rgba(0,0,0,0.06),0_0_0_1px_rgba(0,0,0,0.04)]">{children}</div>
      {note && <p className="mt-2 px-1 text-xs text-zinc-500">{note}</p>}
    </section>
  );
}

function Row({
  icon,
  label,
  hint,
  children,
  disabled = false,
  stack = false,
}: {
  icon: ReactNode;
  label: string;
  hint?: string;
  children?: ReactNode;
  disabled?: boolean;
  /** wide controls sit under the label on a phone instead of squeezing it */
  stack?: boolean;
}) {
  const head = (
    <>
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-purple-50 text-[#693FE2]">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden className="h-[19px] w-[19px]">
          {icon}
        </svg>
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-[15px] font-bold leading-tight text-zinc-900">{label}</span>
        {hint && <span className="mt-0.5 block text-[13px] leading-tight text-zinc-500">{hint}</span>}
      </span>
    </>
  );
  const dim = disabled ? "opacity-45" : "";

  if (stack) {
    return (
      <div className={`border-b border-zinc-100 px-4 py-3 last:border-0 sm:flex sm:min-h-[68px] sm:items-center sm:gap-3 ${dim}`}>
        <div className="flex items-center gap-3 sm:contents">{head}</div>
        <div className="mt-3 sm:mt-0">{children}</div>
      </div>
    );
  }

  return (
    <div className={`flex min-h-[68px] items-center gap-3 border-b border-zinc-100 px-4 py-3 last:border-0 ${dim}`}>
      {head}
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
      className={`relative h-[31px] w-[51px] shrink-0 rounded-full transition-colors disabled:opacity-40 ${checked ? "bg-[#693FE2]" : "bg-zinc-300"}`}
    >
      <span className={`absolute top-[2px] h-[27px] w-[27px] rounded-full bg-white shadow-[0_3px_8px_rgba(0,0,0,0.15),0_1px_1px_rgba(0,0,0,0.16)] transition-all ${checked ? "left-[22px]" : "left-[2px]"}`} />
    </button>
  );
}

/* How much the offline shell is actually holding.

   Counting entries rather than bytes: Cache Storage exposes no size, and
   navigator.storage.estimate() lumps in IndexedDB and localStorage, which this
   button deliberately does not touch — quoting that number next to it would
   promise to free storage the button leaves alone.

   Returns null when the browser has no Cache Storage at all: private windows
   and locked-down profiles both do this, and there the button has nothing to
   do and says so instead of claiming success. */
async function countCached(): Promise<number | null> {
  if (typeof caches === "undefined") return null;
  try {
    const names = await caches.keys();
    const per = await Promise.all(names.map(async (n) => (await (await caches.open(n)).keys()).length));
    return per.reduce((a, b) => a + b, 0);
  } catch {
    return null;
  }
}

const CUSTOM = "custom";

/* row glyphs */
const ICON = {
  textSize: <path d="M4 18 9.5 5h1L16 18M6.2 13.5h6.6M17 11.5l2-5 2 5m-3.4 0h2.8" />,
  font: <path d="M6 4h12M12 4v16M8 20h8" />,
  bell: (
    <>
      <path d="M6 16V11a6 6 0 0 1 12 0v5l1.5 2h-15z" />
      <path d="M10 20a2 2 0 0 0 4 0" />
    </>
  ),
  clock: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 7.5V12l3 2" />
    </>
  ),
  trash: <path d="M4 7h16M9.5 7V5h5v2M6.5 7l.8 12.1a1 1 0 0 0 1 .9h7.4a1 1 0 0 0 1-.9L17.5 7M10 11v5M14 11v5" />,
  info: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 11.5v4.5M12 8h.01" />
    </>
  ),
};

const SUN_ICON = (
  <>
    <circle cx="12" cy="12" r="4" />
    <path d="M12 2v2M12 20v2M2 12h2M20 12h2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M19.1 4.9l-1.4 1.4M6.3 17.7l-1.4 1.4" />
  </>
);

const GEAR_ICON = (
  <>
    <circle cx="12" cy="12" r="3.2" />
    <path d="M19.4 14a1.6 1.6 0 0 0 .32 1.77l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.6 1.6 0 0 0-1.77-.32 1.6 1.6 0 0 0-1 1.46V20a2 2 0 1 1-4 0v-.1a1.6 1.6 0 0 0-1.05-1.46 1.6 1.6 0 0 0-1.77.32l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.6 1.6 0 0 0 .32-1.77 1.6 1.6 0 0 0-1.46-1H4a2 2 0 1 1 0-4h.1a1.6 1.6 0 0 0 1.46-1.05 1.6 1.6 0 0 0-.32-1.77l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.6 1.6 0 0 0 1.77.32H10a1.6 1.6 0 0 0 1-1.46V4a2 2 0 1 1 4 0v.1a1.6 1.6 0 0 0 1 1.46 1.6 1.6 0 0 0 1.77-.32l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.6 1.6 0 0 0-.32 1.77V10a1.6 1.6 0 0 0 1.46 1H20a2 2 0 1 1 0 4h-.1a1.6 1.6 0 0 0-1.46 1Z" />
  </>
);

export default function SettingsPage() {
  const prefs = useReadingPrefs();
  const reminder = useReminder();
  const [busy, setBusy] = useState(false);
  // the custom box: what's typed, and whether the picker is on "Custom"
  const isPreset = (REMINDER_SLOTS as readonly string[]).includes(reminder.time);
  const [custom, setCustom] = useState(false);
  const [draft, setDraft] = useState(reminder.time);
  const [draftError, setDraftError] = useState<string | null>(null);
  const showCustom = custom || !isPreset;
  const commitTimer = useRef<number | null>(null);
  const [cleared, setCleared] = useState(false);
  const [askClear, setAskClear] = useState(false);
  // undefined while the first measurement is still running
  const [cached, setCached] = useState<number | null | undefined>(undefined);

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

  const clearCommitTimer = () => {
    if (commitTimer.current !== null) {
      window.clearTimeout(commitTimer.current);
      commitTimer.current = null;
    }
  };

  /* the box is a native time control, so what lands here is already "HH:MM" —
     all that is left is snapping it onto the 15-minute delivery grid */
  const commitDraft = (raw: string) => {
    clearCommitTimer();
    const t = normalizeReminderTime(raw);
    if (!t) {
      // only reachable when the control is left empty
      setDraftError("Pick a time");
      return;
    }
    setDraftError(null);
    setDraft(t);
    if (t !== reminder.time) void applyReminder({ time: t });
  };

  /* a wheel or a spinner fires change on every tick, so the tag update waits
     for the reader to settle instead of going out on each one */
  const scheduleCommit = (raw: string) => {
    setDraft(raw);
    setDraftError(null);
    clearCommitTimer();
    if (!normalizeReminderTime(raw)) return;
    commitTimer.current = window.setTimeout(() => commitDraft(raw), 600);
  };

  useEffect(
    () => () => {
      if (commitTimer.current !== null) window.clearTimeout(commitTimer.current);
    },
    [],
  );

  /* the stored reminder only arrives after mount — useReminder reads
     localStorage in an effect so the markup matches the server — so the box has
     to follow it, or a saved custom time reopens showing the default. A pending
     commit means the reader is mid-pick; leave their value alone. */
  useEffect(() => {
    if (commitTimer.current === null) setDraft(reminder.time);
  }, [reminder.time]);

  // measured once on arrival so the row can say what is actually there
  useEffect(() => {
    let live = true;
    void countCached().then((n) => {
      if (live) setCached(n);
    });
    return () => {
      live = false;
    };
  }, []);

  /* the offline shell the service worker keeps. Bookmarks, reading history and
     these preferences live in localStorage and are deliberately left alone —
     this frees storage, it does not empty the reader's own library. */
  const clearCache = useCallback(async () => {
    setAskClear(false);
    try {
      const keys = await caches.keys();
      await Promise.all(keys.map((k) => caches.delete(k)));
    } catch {
      // nothing was removed, so don't claim otherwise
      setCached(null);
      return;
    }
    // re-measured rather than assumed: the service worker re-caches the shell
    // on its next request, and the row should show what is really there
    setCached(await countCached());
    setCleared(true);
    window.setTimeout(() => setCleared(false), 2500);
  }, []);

  const cacheHint =
    cached === undefined
      ? "Checking offline storage…"
      : cached === null
        ? "Offline storage isn't available in this browser"
        : cached === 0
          ? "Nothing is cached right now"
          : `${cached} ${cached === 1 ? "file" : "files"} kept for offline use`;

  const timeOptions = [
    ...REMINDER_SLOTS.map((t) => ({ value: t as string, label: reminderLabel(t) })),
    // a custom time already chosen shows up as its own option, so the picker
    // never displays something the reader didn't pick
    ...(!isPreset ? [{ value: reminder.time, label: `${reminderLabel(reminder.time)} (custom)` }] : []),
    { value: CUSTOM, label: "Custom…" },
  ];

  return (
    <div className="mx-auto max-w-xl">
      {/* On a phone the title sits in a coloured band that curves into the page,
          the way a native settings screen opens. The dome and crescent behind it
          are decoration only. On wider screens it goes back to a plain heading,
          where a full-bleed band would look out of place. */}
      <div className="relative -mx-4 -mt-5 mb-6 overflow-hidden rounded-b-[28px] bg-gradient-to-br from-[#31094C] via-[#4A1E9E] to-[#693FE2] px-5 pb-8 pt-7 text-white sm:mx-0 sm:mt-0 sm:rounded-none sm:bg-none sm:px-1 sm:pb-0 sm:pt-0 sm:text-inherit">
        <svg
          viewBox="0 0 120 80"
          aria-hidden
          className="pointer-events-none absolute -right-3 bottom-0 h-24 w-36 text-white/15 sm:hidden"
          fill="currentColor"
        >
          <mask id="iol-crescent">
            <rect width="120" height="80" fill="black" />
            <circle cx="24" cy="16" r="9" fill="white" />
            <circle cx="28" cy="14" r="7.5" fill="black" />
          </mask>
          <rect width="120" height="80" mask="url(#iol-crescent)" />
          <path d="M60 20c9 7 14 15 14 24v36H46V44c0-9 5-17 14-24Z" />
          <path d="M30 44c6 5 9 11 9 18v18H21V62c0-7 3-13 9-18ZM90 44c6 5 9 11 9 18v18H81V62c0-7 3-13 9-18Z" />
          <rect x="0" y="72" width="120" height="8" />
        </svg>
        <div className="relative">
          <h1 className="text-[30px] font-extrabold leading-none tracking-tight">Settings</h1>
          <p className="mt-1.5 text-sm text-white/75 sm:text-zinc-500">Manage your app preferences</p>
        </div>
      </div>

      <div className="space-y-7">
        <Group title="Appearance" hint="Customize how the app looks" tint="purple" icon={SUN_ICON}>
          <Row icon={ICON.textSize} label="Text size" hint="Adjust reading size" stack>
            <TextSizePicker className="sm:shrink-0" />
          </Row>
          <Row icon={ICON.font} label="Font" hint="Reading font style">
            <Picker<FontKey>
              label="Font"
              value={prefs.font}
              onChange={(v) => setReadingPrefs({ font: v })}
              // each row previews its own face
              options={FONTS.map((f) => ({ value: f.key, label: f.label, style: { fontFamily: f.var } }))}
            />
          </Row>
        </Group>

        <Group
          title="Notifications"
          hint="Stay updated with new content"
          tint="green"
          icon={ICON.bell}
          note={
            !configured
              ? "Push isn't configured for this site yet, so reminders can't be delivered."
              : blocked
                ? "Notifications are blocked for this site in your browser settings — allow them there first."
                : "Delivered in your own timezone, rounded to the nearest 15 minutes."
          }
        >
          <Row icon={ICON.bell} label="Daily reminder" hint="Get a daily nudge with the latest article">
            <Switch label="Daily reminder" checked={reminder.enabled} disabled={blocked || !configured} onChange={() => void applyReminder({ enabled: !reminder.enabled })} />
          </Row>
          <Row
            icon={ICON.clock}
            label="Reminder time"
            hint={reminder.enabled ? "Choose when to receive it" : "Turn the reminder on first"}
            disabled={!reminder.enabled}
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
                Custom time
              </label>
              {/* a native time control: the phone opens its own hour/minute wheel,
                  so there is no colon to type on a number pad, and the value can
                  never arrive half-finished. Nothing here is disabled while the
                  tag update is in flight — that would close the wheel mid-pick. */}
              <div className="mt-2 flex gap-2">
                <input
                  id="custom-time"
                  type="time"
                  value={draft}
                  disabled={!reminder.enabled}
                  onChange={(e) => scheduleCommit(e.target.value)}
                  onBlur={(e) => commitDraft(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && commitDraft(e.currentTarget.value)}
                  className="min-h-11 w-full rounded-xl border border-zinc-200 bg-white px-3 text-[15px] font-semibold tabular-nums outline-none transition focus-visible:border-[#693FE2] focus-visible:ring-2 focus-visible:ring-[#693FE2]/30 disabled:cursor-not-allowed"
                />
                <button
                  type="button"
                  onClick={() => commitDraft(draft)}
                  disabled={!reminder.enabled}
                  className="min-h-11 shrink-0 rounded-xl bg-[#693FE2] px-4 text-sm font-semibold text-white transition hover:bg-[#5a34c7] disabled:opacity-50"
                >
                  Set
                </button>
              </div>
              {draftError ? (
                <p className="mt-1.5 text-xs text-red-600">{draftError}</p>
              ) : (
                <p className="mt-1.5 text-xs text-zinc-500">
                  {busy ? "Saving…" : `Set for ${reminderLabel(reminder.time)}`}
                </p>
              )}
            </div>
          )}
        </Group>

        <Group title="App" hint="Storage and version" tint="blue" icon={GEAR_ICON}>
          <Row icon={ICON.trash} label="Clear cached pages" hint={cleared ? "Cleared — your bookmarks are untouched" : cacheHint}>
            <button
              type="button"
              onClick={() => setAskClear(true)}
              disabled={!cached}
              className="min-h-9 shrink-0 touch-manipulation rounded-full bg-zinc-100 px-4 text-sm font-semibold text-zinc-800 transition hover:bg-zinc-200 active:scale-95 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {cleared ? "Cleared" : "Clear"}
            </button>
          </Row>
          <Row icon={ICON.info} label="App version" hint="Islamonlive for the web">
            <span className="pill shrink-0 text-sm font-semibold text-zinc-500">{process.env.NEXT_PUBLIC_APP_VERSION}</span>
          </Row>
        </Group>
      </div>

      <ConfirmDialog
        open={askClear}
        title="Clear cached pages?"
        body={`This frees ${cached ?? 0} cached ${cached === 1 ? "file" : "files"}. Pages you have already read will be downloaded again next time, and they won't open offline until then. Your bookmarks, reading history and these settings are not touched.`}
        confirmLabel="Clear"
        destructive
        onConfirm={() => void clearCache()}
        onCancel={() => setAskClear(false)}
      />
    </div>
  );
}
