"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";

/* Makes the phone's Back button close whatever is open on top of the page,
   instead of leaving the article altogether.

   On a phone, Back is the universal "dismiss this" gesture: a reader who has
   pulled up the menu, a picker sheet, the share card or a reel expects Back to
   put it away and leave them where they were. Without this, Back went straight
   to the previous page and the reader lost their place.

   The trick is a throwaway history entry pushed when the overlay opens. Back
   pops that entry rather than the page, and the overlay closes. When the reader
   closes it themselves instead - the X, the backdrop, Escape - the entry is
   unwound, so Back doesn't have to be pressed twice to actually go back.

   Links inside an overlay are the awkward case, and the reason this hook does
   its own routing. Tapping one closes the overlay and starts a navigation at
   the same moment, and unwinding an entry underneath a navigation the router
   has not committed yet cancels it: the reader taps a menu item and stays put.
   So a link click is taken over here - held, the entry unwound, and the
   navigation issued once the unwinding has actually happened. */

let seq = 0;

export function useBackDismiss(open: boolean, onDismiss: () => void): void {
  const router = useRouter();

  // held in a ref so a fresh closure each render can't retrigger the effect and
  // push a second entry for one overlay
  const cb = useRef(onDismiss);
  useEffect(() => {
    cb.current = onDismiss;
  });

  useEffect(() => {
    if (!open) return;
    const mark = ++seq;
    history.pushState({ ...history.state, iolOverlay: mark }, "");

    let byBack = false;
    let goTo: string | null = null;

    const onPop = () => {
      byBack = true;
      cb.current();
    };
    window.addEventListener("popstate", onPop);

    /* Captured on the document so it runs before the router's own handler and
       can call it off. Modified clicks, new tabs, downloads and anything
       leaving the site are left alone - those never disturb this history entry
       anyway. */
    const onClick = (e: MouseEvent) => {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const el = e.target instanceof Element ? e.target.closest("a[href]") : null;
      if (!(el instanceof HTMLAnchorElement)) return;
      if (el.target === "_blank" || el.hasAttribute("download")) return;
      const url = new URL(el.href, location.href);
      if (url.origin !== location.origin) return;
      e.preventDefault();
      goTo = url.pathname + url.search + url.hash;
      cb.current();
    };
    document.addEventListener("click", onClick, true);

    return () => {
      window.removeEventListener("popstate", onPop);
      document.removeEventListener("click", onClick, true);
      // Back did the closing: the entry is already gone
      if (byBack) return;

      if (history.state?.iolOverlay !== mark) {
        if (goTo) router.push(goTo);
        return;
      }
      // unwind first, navigate second - the other order loses the navigation
      const after = () => {
        window.removeEventListener("popstate", after);
        if (goTo) router.push(goTo);
      };
      window.addEventListener("popstate", after);
      history.back();
    };
  }, [open, router]);
}
