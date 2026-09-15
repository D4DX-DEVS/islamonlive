"use client";

import { useEffect } from "react";

/* The safety net under the Photon loader (lib/imageLoader.ts).

   Photon rate-limits bursts of requests from one IP, and a scroll down the home
   page is exactly that: a row of cards enters the viewport and fires a dozen
   image loads at once. The ones it throttles come back as 429 with an HTML
   body, and because an <img> is a cross-origin no-cors request, Chrome will not
   hand that body to the page — it logs ERR_BLOCKED_BY_ORB and the card renders
   as a broken image. Reloading the page fixes it, which is the tell: the
   rendition is warm the second time, so the request goes through. Cold
   renditions (a width Photon has never resized) are throttled hardest, which is
   why the gaps cluster wherever you scrolled first and then stop appearing.

   The repair is to re-request the same URL with backoff, and if Photon still
   refuses, to point the element at the WordPress original, which has no rate
   limit. A full-size upload is more bytes than the resize would have been; a
   broken card is worse.

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

/** How many times to re-request the Photon URL before falling back. */
const RETRIES = 2;

/** How often to look for images that failed without an error event reaching us. */
const SWEEP_MS = 2500;

/** Backoff before retry n (0-based), jittered so a throttled row does not come
    back in one instant and get throttled again. */
function delayFor(attempt: number): number {
  return (600 + attempt * 900) * (0.75 + Math.random() * 0.5);
}

/**
 * The WordPress original behind a Photon URL:
 * https://i0.wp.com/admin.islamonlive.in/wp-content/…jpg?w=256
 *   -> https://admin.islamonlive.in/wp-content/…jpg
 *
 * The host is read back out of the path Photon was handed, so this needs no env
 * and cannot disagree with whatever the loader emitted.
 */
function originalUrl(photon: string): string | null {
  try {
    const u = new URL(photon);
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
  if (!failed.includes(".wp.com/")) return;

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
       element needs and the one Photon is busy warming. */
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
