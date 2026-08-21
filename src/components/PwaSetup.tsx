"use client";

import { useEffect } from "react";

/* Registers the offline service worker and, when an app id is configured,
   OneSignal web push (v16). Renders nothing. */
export default function PwaSetup() {
  useEffect(() => {
    // prod only — a dev-registered SW serves stale JS chunks after edits,
    // which shows up as hydration mismatches against the fresh server HTML
    if ("serviceWorker" in navigator && process.env.NODE_ENV === "production") {
      navigator.serviceWorker.register("/sw.js").catch(() => {});
    }

    const appId = process.env.NEXT_PUBLIC_ONESIGNAL_APP_ID;
    if (!appId || document.getElementById("onesignal-sdk")) return;
    const s = document.createElement("script");
    s.id = "onesignal-sdk";
    s.src = "https://cdn.onesignal.com/sdks/web/v16/OneSignalSDK.page.js";
    s.defer = true;
    document.head.appendChild(s);
    // OneSignal v16 deferred init — prompt behaviour configured in the dashboard
    const w = window as unknown as { OneSignalDeferred?: Array<(os: { init: (o: object) => Promise<void> }) => void> };
    w.OneSignalDeferred = w.OneSignalDeferred || [];
    w.OneSignalDeferred.push((OneSignal) => {
      OneSignal.init({
        appId,
        serviceWorkerPath: "OneSignalSDKWorker.js",
        // narrow scope so OneSignal's worker coexists with /sw.js — two workers
        // registered at "/" fight over the scope and the loser stops controlling
        // the page (push silently dies, or the offline shell does)
        serviceWorkerParam: { scope: "/push/onesignal/" },
        allowLocalhostAsSecureOrigin: true,
      }).catch(() => {});
    });
  }, []);

  return null;
}
