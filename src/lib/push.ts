"use client";

/* Thin wrapper over the OneSignal v16 SDK that components/PwaSetup.tsx loads.

   Everything goes through window.OneSignalDeferred: the SDK script is `defer`red
   and may not have executed when a reader hits the toggle, and the deferred queue
   is the vendor's own way of saying "run this once I'm up". Calling
   window.OneSignal directly races the script. */

interface OneSignalApi {
  Notifications: {
    permission: boolean;
    requestPermission: () => Promise<void>;
  };
  User: {
    addTag: (key: string, value: string) => void;
    removeTag: (key: string) => void;
    PushSubscription: { id?: string | null };
  };
}

type Deferred = Array<(os: OneSignalApi) => void>;

/** the tag app/api/reminder filters the daily batch on */
export const REMINDER_TAG = "reminder_time";

function queue(fn: (os: OneSignalApi) => void): void {
  if (typeof window === "undefined") return;
  const w = window as unknown as { OneSignalDeferred?: Deferred };
  w.OneSignalDeferred = w.OneSignalDeferred || [];
  w.OneSignalDeferred.push(fn);
}

/** false when NEXT_PUBLIC_ONESIGNAL_APP_ID is unset — PwaSetup never loads the SDK
    then, so the reminder UI has to say so rather than silently doing nothing */
export function pushConfigured(): boolean {
  return Boolean(process.env.NEXT_PUBLIC_ONESIGNAL_APP_ID);
}

/** current browser permission, readable before the SDK is up */
export function notificationPermission(): NotificationPermission | "unsupported" {
  if (typeof window === "undefined" || !("Notification" in window)) return "unsupported";
  return Notification.permission;
}

/* the deferred queue only drains once the SDK script has run — if it never
   loads (blocked, offline, an ad blocker) the promise would hang and the
   settings switch with it. Cap the wait: the local preference is already
   saved; the tag catches up next time the SDK is up. */
const SDK_WAIT_MS = 4000;

function settle(p: Promise<void>): Promise<void> {
  return Promise.race([p, new Promise<void>((r) => setTimeout(r, SDK_WAIT_MS))]);
}

/** ask for permission, then tag the subscription with the slot they chose */
export function enableReminder(time: string): Promise<void> {
  return settle(new Promise((resolve) => {
    queue(async (os) => {
      try {
        if (!os.Notifications.permission) await os.Notifications.requestPermission();
        os.User.addTag(REMINDER_TAG, time);
      } catch {
        /* declined, or the browser blocks prompts outside a gesture */
      } finally {
        resolve();
      }
    });
  }));
}

export function disableReminder(): Promise<void> {
  return settle(new Promise((resolve) => {
    queue((os) => {
      try {
        os.User.removeTag(REMINDER_TAG);
      } catch {
        /* nothing subscribed */
      } finally {
        resolve();
      }
    });
  }));
}

/* ------------------------------------------------------------ catch-up ----

   /api/reminder builds the day's sends once, at 01:00 UTC, from the tags that
   exist then. A reader who switches the nudge on — or moves it — after that is
   in none of them, so without this their first one would arrive tomorrow and
   the switch would look broken. Saving a time asks the server to queue today's
   nudge for this one subscription; the server checks the tag really is theirs
   and reports back whether the slot is still ahead of them.

   The queued notification's id is kept here so moving the time again, or
   switching the reminder off, calls the earlier one off rather than letting two
   arrive. */

/** what came back from the catch-up request — drives the line under the box */
export interface NextNudge {
  /** true when one is queued for today; false when today's slot has gone */
  today: boolean;
}

const CATCH_UP_KEY = "iol:reminder-catchup";

function readCatchUp(): string {
  try {
    return window.localStorage.getItem(CATCH_UP_KEY) ?? "";
  } catch {
    return "";
  }
}

function writeCatchUp(id: string): void {
  try {
    if (id) window.localStorage.setItem(CATCH_UP_KEY, id);
    else window.localStorage.removeItem(CATCH_UP_KEY);
  } catch {
    /* private mode, or storage is full — the daily batch still has them */
  }
}

/** this browser's push subscription, once the SDK is up; null if it never is */
function subscriptionId(): Promise<string | null> {
  return Promise.race([
    new Promise<string | null>((resolve) => {
      queue((os) => resolve(os.User.PushSubscription.id ?? null));
    }),
    new Promise<string | null>((r) => setTimeout(() => r(null), SDK_WAIT_MS)),
  ]);
}

async function catchUp(body: Record<string, unknown>): Promise<{ queued?: boolean; id?: string } | null> {
  try {
    const res = await fetch("/api/reminder/", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) return null;
    return (await res.json()) as { queued?: boolean; id?: string };
  } catch {
    // offline, or the route isn't there — tomorrow's batch still covers them
    return null;
  }
}

/** ask for today's nudge at the time just saved. null when it couldn't be asked */
export async function scheduleTodayNudge(time: string): Promise<NextNudge | null> {
  const id = await subscriptionId();
  if (!id) return null;
  const out = await catchUp({
    subscriptionId: id,
    time,
    offsetMinutes: new Date().getTimezoneOffset(),
    cancelId: readCatchUp() || undefined,
  });
  if (!out) return null;
  writeCatchUp(out.queued ? (out.id ?? "") : "");
  return { today: Boolean(out.queued) };
}

/** switching the reminder off has to call off a nudge already queued for today */
export async function cancelTodayNudge(): Promise<void> {
  const id = readCatchUp();
  if (!id) return;
  writeCatchUp("");
  await catchUp({ cancelId: id, cancelOnly: true });
}
