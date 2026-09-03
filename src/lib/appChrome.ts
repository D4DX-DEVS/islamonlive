"use client";

import { useSyncExternalStore } from "react";
import { usePathname } from "next/navigation";

/* Shared "is the app chrome on screen?" flag for the phone header and the bottom
   tab bar. Both read this one store off a single scroll listener, so they slide
   away and back as one piece — two independent listeners drifted by a frame and
   the bars visibly moved out of step. */

// never hide while the page is still near its top: the first swipe of a page is
// almost always downward, and losing the header immediately reads as a glitch
const TOP_ZONE = 64;
// iOS emits sub-pixel scroll deltas through momentum and rubber-banding; without
// a deadzone the bars flickered whenever a flick decayed
const DEADZONE = 6;
const BOTTOM_SLACK = 8;

let visible = true;
let scrolled = false;
let lastY = 0;
let queued = false;
const listeners = new Set<() => void>();

function emit() {
  for (const l of listeners) l();
}

function read() {
  queued = false;
  const y = window.scrollY;

  const nextScrolled = y > 4;
  const changed = nextScrolled !== scrolled;
  scrolled = nextScrolled;

  const delta = y - lastY;
  // the shadow still has to settle on a 1px scroll, so it is decided above the
  // deadzone that only governs the hide/show direction
  if (Math.abs(delta) < DEADZONE) {
    if (changed) emit();
    return;
  }
  lastY = y;

  const max = document.documentElement.scrollHeight - window.innerHeight;
  // both ends of the page always show the chrome — at the bottom the tab bar is
  // the reader's only way out of the page they just finished
  const nextVisible = y <= TOP_ZONE || y >= max - BOTTOM_SLACK ? true : delta < 0;

  if (nextVisible !== visible || changed) {
    visible = nextVisible;
    emit();
  }
}

function onScroll() {
  if (queued) return;
  queued = true;
  requestAnimationFrame(read);
}

function subscribe(cb: () => void) {
  if (!listeners.size) {
    lastY = window.scrollY;
    scrolled = window.scrollY > 4;
    window.addEventListener("scroll", onScroll, { passive: true });
  }
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
    if (!listeners.size) window.removeEventListener("scroll", onScroll);
  };
}

const chromeSnapshot = () => visible;
const scrolledSnapshot = () => scrolled;
// the server has no scroll position: it always paints the chrome, unshadowed
const serverTrue = () => true;
const serverFalse = () => false;

/** True while the phone header and tab bar should be on screen. */
export function useChromeVisible() {
  const visible = useSyncExternalStore(subscribe, chromeSnapshot, serverTrue);
  // the home page never gives its chrome up. It is the index readers scroll to
  // pick something from, not something they read straight down, so the nav has
  // to stay in reach — the auto-hide is for the pages they read
  return usePathname() === "/" || visible;
}

/** True once the page has moved off its top — drives the header's shadow. */
export function usePageScrolled() {
  return useSyncExternalStore(subscribe, scrolledSnapshot, serverFalse);
}

/** Put the chrome back on screen. Called on every route change. */
export function showChrome() {
  lastY = window.scrollY;
  if (visible) return;
  visible = true;
  emit();
}
