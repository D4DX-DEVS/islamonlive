"use client";

import { useEffect, useRef } from "react";
import { readProgress, recordRead, setReadProgress, type RecentItem } from "@/lib/reader";

// how long the resume keeps re-asserting the reader's place. The page streams
// in behind loading.tsx and Next scrolls to the top when the real segment
// lands, images settle their heights for a beat after that — a single
// scrollTo fired too early is simply undone
const RESUME_MS = 2000;

/* Progress is measured against the article body, not the document: while the
   router swaps pages the document shrinks under a still-attached scroll
   listener and "scrollY / range" jumped to 100% on the way out. The body
   element is gone by then, so measuring it just skips. */
function articleBody(): { top: number; height: number } | null {
  const el = document.querySelector<HTMLElement>(".reader-body");
  if (!el) return null;
  const r = el.getBoundingClientRect();
  return r.height > 0 ? { top: r.top + window.scrollY, height: r.height } : null;
}

/** how far down the body the bottom of the viewport is, 0..1 */
function measure(): number | null {
  const b = articleBody();
  if (!b) return null;
  const seen = window.scrollY + window.innerHeight - b.top;
  return Math.max(0, Math.min(1, seen / b.height));
}

/** the scrollY that puts the viewport's bottom at `p` of the body */
function targetFor(p: number): number | null {
  const b = articleBody();
  if (!b) return null;
  return Math.max(0, Math.round(b.top + p * b.height - window.innerHeight));
}

/* Records the post as read so "Continue reading" can offer it again, and keeps
   the reader's place: how far down the article they got is saved as they
   scroll, and opening the post with `#continue` (the link /saved uses) drops
   them back there. Renders nothing.

   Keyed on the id rather than the whole object: the parent is a server component
   and hands a fresh object literal down on every render, which as an effect
   dependency would re-record on each one. */
export default function ReadTracker({ item }: { item: Omit<RecentItem, "at" | "progress"> }) {
  const { id, href, title, img, category, date } = item;

  // A random browser session id lets the admin dashboard count anonymous
  // readers without collecting names, emails, IPs or WordPress credentials.
  // It stays in localStorage so one reader is not counted again on every page.
  const analyticsId = useRef<string | null>(null);
  const startedAt = useRef(0);
  const latestProgress = useRef(0);

  useEffect(() => {
    recordRead({ id, href, title, img, category, date });
  }, [id, href, title, img, category, date]);

  useEffect(() => {
    startedAt.current = Date.now();
    latestProgress.current = 0;
    const getAnalyticsId = (): string => {
      if (analyticsId.current) return analyticsId.current;
      try {
        const existing = localStorage.getItem("iol:analytics-session");
        if (existing && existing.length >= 12) analyticsId.current = existing;
        else {
          const generated = typeof crypto.randomUUID === "function" ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
          localStorage.setItem("iol:analytics-session", generated);
          analyticsId.current = generated;
        }
      } catch { analyticsId.current = `${Date.now()}-${Math.random().toString(36).slice(2)}`; }
      return analyticsId.current;
    };
    const sendAnalytics = (type: "view" | "heartbeat" | "complete") => {
      const payload = JSON.stringify({ articleId: id, path: href, title, type, seconds: Math.round((Date.now() - startedAt.current) / 1000), progress: latestProgress.current, sessionId: getAnalyticsId() });
      try { void fetch("/api/analytics/event", { method: "POST", headers: { "Content-Type": "application/json" }, body: payload, keepalive: true }); } catch { /* analytics must never affect reading */ }
    };
    sendAnalytics("view");
    const heartbeat = window.setInterval(() => sendAnalytics("heartbeat"), 15_000);
    const finish = () => sendAnalytics(latestProgress.current >= 0.9 ? "complete" : "heartbeat");
    window.addEventListener("pagehide", finish);
    return () => { window.clearInterval(heartbeat); window.removeEventListener("pagehide", finish); finish(); };
  }, [id, href, title]);

  useEffect(() => {
    // the target lives in sessionStorage for the length of the resume: the hash
    // is consumed on the first pass, and the effect can run again before the
    // resume is done (StrictMode in dev, a Suspense re-mount while streaming)
    const key = `iol:resume:${id}`;
    if (window.location.hash === "#continue") {
      const p = readProgress(id);
      // only past the first screen — jumping 3% down a page reads as a glitch
      if (p > 0.05 && p < 0.98) {
        try { sessionStorage.setItem(key, String(p)); } catch { /* private mode */ }
      }
      history.replaceState(null, "", window.location.pathname + window.location.search);
    }
    let p = 0;
    try { p = Number(sessionStorage.getItem(key)) || 0; } catch { /* private mode */ }
    if (!p) return;

    let raf = 0;
    const start = performance.now();
    const done = () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("wheel", done);
      window.removeEventListener("touchstart", done);
      window.removeEventListener("keydown", done);
      try { sessionStorage.removeItem(key); } catch { /* ignore */ }
    };
    const tick = () => {
      const target = targetFor(p);
      if (target !== null && Math.abs(window.scrollY - target) > 2) window.scrollTo({ top: target, behavior: "auto" });
      if (performance.now() - start < RESUME_MS) raf = requestAnimationFrame(tick);
      else done();
    };
    // the reader taking over (a swipe, the wheel, a key) ends the resume —
    // fighting their scroll would be worse than landing a bit off
    window.addEventListener("wheel", done, { passive: true });
    window.addEventListener("touchstart", done, { passive: true });
    window.addEventListener("keydown", done);
    raf = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("wheel", done);
      window.removeEventListener("touchstart", done);
      window.removeEventListener("keydown", done);
    };
  }, [id]);

  useEffect(() => {
    let raf = 0;
    const onScroll = () => {
      if (raf) return;
      raf = requestAnimationFrame(() => {
        raf = 0;
        const p = measure();
        if (p !== null) { latestProgress.current = p; setReadProgress(id, p); }
      });
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      if (raf) cancelAnimationFrame(raf);
    };
  }, [id]);

  return null;
}
