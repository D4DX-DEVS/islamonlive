import { useCallback, useEffect, useState } from "react";

/* A workspace tab left open overnight still shows yesterday's screen, but its
   session may have ended. Rather than let every panel fail on its own with
   "authentication required", the session is checked when the tab opens, when it
   comes back into view and every so often, and any admin API call answered 401
   says the same. Each check of a remembered session also slides it forward. */

const CHECK_EVERY_MS = 15 * 60_000;

/** True for an admin API call whose 401 means "signed out" (a wrong password at sign-in is not that). */
export function isSessionLoss(url: string, status: number): boolean {
  if (status !== 401) return false;
  let path: string;
  try { path = new URL(url, "http://local").pathname; } catch { return false; }
  return path.startsWith("/api/admin/") && !path.startsWith("/api/admin/login");
}

export function useSessionWatch(active: boolean): { ended: boolean; resume: () => void } {
  const [ended, setEnded] = useState(false);

  useEffect(() => {
    if (!active) return;
    const original = window.fetch;
    const watched: typeof window.fetch = async (input, init) => {
      const response = await original(input, init);
      const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
      if (isSessionLoss(url, response.status)) setEnded(true);
      return response;
    };
    window.fetch = watched;

    let last = 0;
    const check = () => {
      if (document.visibilityState !== "visible" || Date.now() - last < 30_000) return;
      last = Date.now();
      // a network failure is not a sign-out; the next check tries again
      void watched("/api/admin/session/", { cache: "no-store", credentials: "same-origin" }).catch(() => {});
    };
    check();
    const timer = window.setInterval(check, CHECK_EVERY_MS);
    document.addEventListener("visibilitychange", check);
    window.addEventListener("focus", check);
    return () => {
      // another wrapper may have been installed over ours since; only undo our own
      if (window.fetch === watched) window.fetch = original;
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", check);
      window.removeEventListener("focus", check);
    };
  }, [active]);

  const resume = useCallback(() => setEnded(false), []);
  return { ended, resume };
}
