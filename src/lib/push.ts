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

/** ask for permission, then tag the subscription with the slot they chose */
export function enableReminder(time: string): Promise<void> {
  return new Promise((resolve) => {
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
  });
}

export function disableReminder(): Promise<void> {
  return new Promise((resolve) => {
    queue((os) => {
      try {
        os.User.removeTag(REMINDER_TAG);
      } catch {
        /* nothing subscribed */
      } finally {
        resolve();
      }
    });
  });
}
