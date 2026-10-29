"use client";

import { useEffect } from "react";

/* The safety net under next/image's optimizer (/_next/image, sharp).

   It used to sit under the Photon loader, whose per-IP burst limit broke cards
   on scroll. The optimizer runs on our own container now, but a cold rendition
   can still fail — a timeout while the container is busy encoding a row of
   cards, or a deploy swapping instances mid-scroll — and a broken card looks
   the same either way.

   The repair is to re-request the same URL with backoff, and if it still
   fails, to point the element at the original upload (the `url` the optimizer
   was handed), which is a plain CDN file. A full-size upload is more bytes than
   the resize would have been; a broken card is worse.

   Two ways in, because neither alone is enough:

     - an error listener on the window, in the capture phase (error events from
       <img> do not bubble, but they do capture). One listener sees every image
       on the page without touching a call site or making server components
       client ones.
     - a periodic sweep for images that are `complete` with a zero
       naturalWidth. React re-creates <img> nodes when a list re-renders — the
       infinite feed appending a batch, say — and a replacement element can come
       up already failed, from the browser's cache of the refused response,
       without ever firing an error this listener could catch. Three cards on a
       category page died exactly that way; the sweep is what brings them
       back. */

/** How many times to re-request the optimizer URL before falling back. */
const RETRIES = 2;

/** How often to look for images that failed without an error event reaching us. */
const SWEEP_MS = 2500;

/** Backoff before retry n (0-based), jittered so a throttled row does not come
    back in one instant and get throttled again. */
function delayFor(attempt: number): number {
  return (600 + attempt * 900) * (0.75 + Math.random() * 0.5);
}

/**
 * The original behind an optimizer URL:
 * /_next/image/?url=https%3A%2F%2F…%2Fwp-content%2F…jpg&w=640&q=75
 *   -> https://…/wp-content/…jpg
 *
 * Read back out of the URL itself, so this needs no env and cannot disagree
 * with whatever next/image emitted. Photon URLs are still understood, for a
 * tab left open across the deploy that dropped Photon.
 */
function originalUrl(failed: string): string | null {
  try {
    const u = new URL(failed, window.location.href);
    // trailingSlash: true makes next/image emit /_next/image/?url=…
    if (u.pathname.replace(/\/$/, "") === "/_next/image") return u.searchParams.get("url");
    if (!u.host.endsWith(".wp.com")) return null;
    const m = /^\/([^/]+)(\/.*)$/.exec(u.pathname);
    return m ? `https://${m[1]}${m[2]}` : null;
  } catch {
    return null;
  }
}

/** Nurse one failed image back: same URL a few times, then the origin. */
function repair(img: HTMLImageElement): void {
  // a retry is already scheduled for this element — let it land
  if (img.dataset.retryPending) return;

  // the URL the browser actually chose out of the srcset, not the fallback src
  const failed = img.currentSrc || img.src;
  if (!failed.includes("/_next/image") && !failed.includes(".wp.com/")) return;

  const attempt = Number(img.dataset.retry ?? 0);

  if (attempt >= RETRIES) {
    const original = originalUrl(failed);
    if (!original) return;
    // mark first: if the origin is a 404 too, nothing here runs again
    img.dataset.retry = "done";
    img.srcset = "";
    img.src = original;
    return;
  }

  img.dataset.retry = String(attempt + 1);
  img.dataset.retryPending = "1";
  window.setTimeout(() => {
    delete img.dataset.retryPending;
    /* Re-requesting re-runs the browser's image selection, and with a srcset
       present it would pick by viewport rather than re-fetch the URL that
       failed. Dropping it pins the retry to that exact rendition — the one this
       element needs and the one the optimizer is busy encoding. */
    img.srcset = "";
    img.src = failed;
  }, delayFor(attempt));
}

/** Loaded, but nothing decoded — a failed request, not one still in flight. */
function isBroken(img: HTMLImageElement): boolean {
  return img.complete && img.naturalWidth === 0 && !!(img.currentSrc || img.src);
}

export default function ImageRetry() {
  useEffect(() => {
    function onError(event: Event) {
      const img = event.target;
      if (img instanceof HTMLImageElement) repair(img);
    }

    function sweep() {
      if (document.hidden) return;
      for (const img of document.querySelectorAll("img")) {
        if (isBroken(img)) repair(img);
      }
    }

    window.addEventListener("error", onError, true);
    const timer = window.setInterval(sweep, SWEEP_MS);
    return () => {
      window.removeEventListener("error", onError, true);
      window.clearInterval(timer);
    };
  }, []);

  return null;
}
