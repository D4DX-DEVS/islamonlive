"use client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import Image from "next/image";

/* "Add this to your home screen" prompt, docked at the foot of the homepage.

   The manifest and the service worker have been in place all along; what was
   missing was anyone listening for `beforeinstallprompt`. Chrome fires it once
   per eligible page load and, left alone, does nothing a reader would notice —
   it only lights up an address-bar icon. Capturing the event lets the page ask
   at a moment a reader is actually looking at the site.

   Safari on iOS has no such event and no programmatic install at all: the only
   route is Share -> Add to Home Screen, so there the button opens a hint
   instead. Chrome on iOS cannot install a PWA either, which is why it is
   excluded rather than shown a hint it can't act on.

   The install state lives in a module-level store read through
   useSyncExternalStore rather than in an effect. Window events and the storage
   check are an external system, which is exactly what that hook is for, and it
   gives the server render a stable empty snapshot for free — the banner is
   absent from the SSR HTML and appears on the first client render without a
   mismatch. Doing the same work in an effect would mean a synchronous setState
   in the effect body, which cascades renders and the lint rule rejects. */

const DISMISS_KEY = "iol:install-dismissed";
const DISMISS_DAYS = 10;
/** breathing room between the page settling and the popup taking the screen */
const OPEN_DELAY_MS = 1500;

/** Chrome's install event — not in lib.dom, so it is described here. */
interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

interface InstallState {
  /** Chrome's captured event, when this page load was eligible */
  prompt: BeforeInstallPromptEvent | null;
  /** iOS Safari, where the only install route is the Share sheet */
  ios: boolean;
  /** installed during this session, via the appinstalled event */
  installed: boolean;
  /** already running standalone, or closed within the last DISMISS_DAYS */
  suppressed: boolean;
}

/* One shared, stable snapshot for the server and for every render before the
   store has anything to report. useSyncExternalStore compares snapshots by
   reference, so this must never be rebuilt. */
const EMPTY: InstallState = { prompt: null, ios: false, installed: false, suppressed: false };

let state: InstallState = EMPTY;
let started = false;
const listeners = new Set<() => void>();

function set(patch: Partial<InstallState>): void {
  state = { ...state, ...patch };
  for (const l of listeners) l();
}

/* Storage throws outright in private mode and wherever site data is blocked, so
   both directions swallow it. An unreadable store reads as "never dismissed":
   showing the banner to someone who once closed it is a far smaller cost than
   hiding it from everyone whose browser refuses the read. */
function dismissedRecently(): boolean {
  try {
    const at = Number(window.localStorage.getItem(DISMISS_KEY));
    if (!at) return false;
    return Date.now() - at < DISMISS_DAYS * 24 * 60 * 60 * 1000;
  } catch {
    return false;
  }
}

function rememberDismissal(): void {
  try {
    window.localStorage.setItem(DISMISS_KEY, String(Date.now()));
  } catch {
    /* nothing to do — the banner still closes for this page view */
  }
}

/** Already running as an installed app, by either platform's spelling. */
function isStandalone(): boolean {
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    (window.navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

/* iPadOS 13+ reports a desktop Macintosh UA, so touch points are what separate
   an iPad from a Mac. The Safari test excludes Chrome/Firefox/Edge on iOS: they
   are WebKit underneath but cannot add to the home screen. */
function isIosSafari(): boolean {
  const ua = navigator.userAgent;
  const ios = /iphone|ipad|ipod/i.test(ua) || (/macintosh/i.test(ua) && navigator.maxTouchPoints > 1);
  return ios && /safari/i.test(ua) && !/crios|fxios|edgios/i.test(ua);
}

/* The inline capture script in the root layout, which runs while the document
   is still parsing. Chrome fires beforeinstallprompt long before React hydrates,
   so the event is already parked here by the time this module runs — reading it
   is the whole point. Listening alone lost that race and the banner silently
   never appeared. */
interface InstallCaptureWindow extends Window {
  __iolInstallEvent?: BeforeInstallPromptEvent | null;
  __iolInstalled?: boolean;
}

/* Runs once, from the first subscribe. It writes `state` directly instead of
   going through set(): React reads the snapshot again right after subscribing,
   so there is no listener to notify yet and nothing to miss. */
function start(): void {
  if (isStandalone() || dismissedRecently()) {
    state = { ...state, suppressed: true };
    return;
  }
  const w = window as InstallCaptureWindow;
  state = {
    ...state,
    ios: isIosSafari(),
    // whatever the capture script already caught, if anything
    prompt: w.__iolInstallEvent ?? null,
    installed: w.__iolInstalled === true,
  };

  // the capture script re-announces on both events; this is the late path, for
  // an install that becomes possible after the page has settled
  const sync = () => set({ prompt: w.__iolInstallEvent ?? null, installed: w.__iolInstalled === true });
  window.addEventListener("iol:installready", sync);
  // direct subscription too, in case the inline script was stripped by a proxy
  // or a CSP: the banner then still works whenever hydration wins the race
  window.addEventListener("beforeinstallprompt", (e: Event) => {
    // without preventDefault Chrome may show its own mini-infobar as well
    e.preventDefault();
    set({ prompt: e as BeforeInstallPromptEvent });
  });
  // the shelf has served its purpose the moment the install lands
  window.addEventListener("appinstalled", () => set({ installed: true }));
}

function subscribe(onChange: () => void): () => void {
  if (!started) {
    started = true;
    start();
  }
  listeners.add(onChange);
  return () => {
    listeners.delete(onChange);
  };
}

const getSnapshot = (): InstallState => state;
const getServerSnapshot = (): InstallState => EMPTY;

export default function InstallBanner() {
  const install = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const [hint, setHint] = useState(false);
  const [closed, setClosed] = useState(false);
  const [ready, setReady] = useState(false);
  const installRef = useRef<HTMLButtonElement>(null);

  const dismiss = useCallback(() => {
    setClosed(true);
    rememberDismissal();
  }, []);

  const onInstall = useCallback(async () => {
    if (install.ios) {
      // first press reveals the Share instructions, second acknowledges them
      if (hint) dismiss();
      else setHint(true);
      return;
    }
    const deferred = install.prompt;
    if (!deferred) return;
    await deferred.prompt();
    const { outcome } = await deferred.userChoice;
    // the event is single-use either way: Chrome fires a fresh one on a later
    // page load if the reader declined. Clear the parked copy too, or the next
    // sync would hand back the spent event.
    (window as InstallCaptureWindow).__iolInstallEvent = null;
    set({ prompt: null, installed: outcome === "accepted" });
  }, [install, hint, dismiss]);

  /* Nothing renders until an install route is known to exist — which on the
     server, and on the very first client render, is never. */
  const open = !closed && !install.suppressed && !install.installed && (!!install.prompt || install.ios);

  /* A prompt that slams up mid-paint reads as an error, and the reader has not
     seen the page it is interrupting yet. One beat after the row settles is
     enough for it to register as the site asking rather than as a popup. */
  useEffect(() => {
    if (!open) return;
    const t = setTimeout(() => setReady(true), OPEN_DELAY_MS);
    return () => clearTimeout(t);
  }, [open]);

  const showing = open && ready;

  /* No useBackDismiss here, deliberately. That hook is built for modals: it
     captures every same-origin link click on the document so a tap inside an
     overlay can close it before routing. This bar is non-modal and the whole
     page stays live underneath, so the hook was intercepting taps on articles,
     nav and everything else while it was on screen. Escape is enough. */
  /* Escape only. No body scroll lock and no focus steal, unlike ConfirmDialog:
     that one interrupts an action the reader just took, this one interrupts
     nothing. Sitting at the bottom, it lets them keep reading and answer when
     they feel like it — freezing the page behind an offer nobody asked for is
     what makes install prompts feel like adware. */
  useEffect(() => {
    if (!showing) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") dismiss();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [showing, dismiss]);

  if (!showing || typeof document === "undefined") return null;

  /* Anchored to the bottom, and deliberately not a modal: no backdrop, and the
     wrapper is click-through (pointer-events-none) so only the card itself takes
     taps and the page underneath stays usable.

     The bottom inset clears MobileTabBar, which is fixed at the foot of the
     viewport below md — without it the buttons would sit under the tab bar on
     exactly the phones most likely to install. */
  return createPortal(
    <div className="pointer-events-none fixed inset-x-0 bottom-0 z-[130] flex justify-center p-3 pb-[calc(4.25rem+env(safe-area-inset-bottom))] md:pb-3">
      <div
        role="dialog"
        aria-labelledby="install-title"
        className="sheet-up-in pointer-events-auto max-w-[calc(100vw-1.5rem)] rounded-2xl bg-white p-2.5 pl-3 shadow-[0_8px_40px_rgba(0,0,0,0.28)] ring-1 ring-zinc-900/10"
      >
        {/* One row: icon, name, action, close. The card takes its width from its
            contents — no w-full/max-w-md — so nothing stretches and there is no
            dead gap between the label and the button. */}
        <div className="flex items-center gap-2.5">
          <Image
            src="/icon-192.png"
            alt=""
            width={40}
            height={40}
            className="h-10 w-10 flex-none rounded-lg ring-1 ring-inset ring-zinc-900/10"
          />
          {/* min-w-0 lets the label shrink instead of shoving the button off the
              edge. It wraps rather than truncating: at 320px there is not room
              for "Install Islamonlive" on one line, and two short lines read
              better than a clipped brand name. Every wider screen keeps it on
              one line, so this is the only width where the bar grows. */}
          <h2 id="install-title" className="min-w-0 text-[15px] font-bold leading-tight text-zinc-900">
            Install Islamonlive
          </h2>
          <button
            ref={installRef}
            type="button"
            onClick={onInstall}
            aria-expanded={install.ios ? hint : undefined}
            className="inline-flex h-9 flex-none touch-manipulation items-center justify-center rounded-full bg-[#693FE2] px-4 text-[14px] font-semibold leading-none text-white transition hover:bg-[#5A34C7] active:scale-[0.98]"
          >
            {install.ios && hint ? "Got it" : "Install"}
          </button>
          <button
            type="button"
            onClick={dismiss}
            aria-label="Close"
            className="inline-flex h-9 w-9 flex-none touch-manipulation items-center justify-center rounded-full text-zinc-400 transition hover:bg-zinc-100 hover:text-zinc-900"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden className="h-4 w-4">
              <path d="M18 6 6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        {install.ios && hint ? (
          /* iOS has no programmatic install, so the button can only ever point at
             the Share sheet. The hint opens as a second line, which is the only
             time this bar is taller than one row. */
          <p className="mt-2.5 flex items-center gap-2 rounded-lg bg-zinc-100 px-3 py-2 text-[13px] leading-relaxed text-zinc-700">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden className="h-4 w-4 flex-none text-[#693FE2]">
              <path d="M12 16V4M8 8l4-4 4 4M5 14v4a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-4" />
            </svg>
            <span>
              Tap <strong className="font-semibold">Share</strong>, then{" "}
              <strong className="font-semibold">Add to Home Screen</strong>.
            </span>
          </p>
        ) : null}
      </div>
    </div>,
    document.body
  );
}
