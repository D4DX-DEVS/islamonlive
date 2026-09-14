"use client";

import { useEffect, useState } from "react";
import { donateUrl } from "@/lib/support";

/* The phone's bottom donate bar. It appears only once the main Donate button
   has scrolled out of view, so it never sits on top of the thing it duplicates,
   and it disappears again on the way back up.

   IntersectionObserver on the real button rather than a scroll threshold: the
   page's height changes when the bank block is expanded, and a pixel offset
   would then show the bar while the button was still on screen.

   It rides above the app's own tab bar (h-16 + safe area), which is why the
   offset below is not just the inset. */
export default function StickyDonate({ watch }: { watch: string }) {
  const [show, setShow] = useState(false);

  useEffect(() => {
    const target = document.getElementById(watch);
    if (!target || typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver(([entry]) => setShow(!entry.isIntersecting), { threshold: 0 });
    io.observe(target);
    return () => io.disconnect();
  }, [watch]);

  if (!show) return null;

  return (
    <div className="donate-bar fixed inset-x-0 bottom-[calc(4rem+env(safe-area-inset-bottom))] z-40 px-3 pb-2 md:hidden">
      <a
        href={donateUrl(null)}
        target="_blank"
        rel="noopener noreferrer"
        className="cta pill flex min-h-[52px] items-center justify-center gap-2 rounded-2xl bg-[color:var(--gold)] text-[15px] font-extrabold text-[color:var(--gold-ink)] shadow-[0_16px_36px_-12px_rgba(36,16,66,0.6)]"
      >
        <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden className="h-4 w-4">
          <path d="M12 21s-7.5-4.7-9.3-9A5.2 5.2 0 0 1 12 6.6a5.2 5.2 0 0 1 9.3 5.4C19.5 16.3 12 21 12 21Z" />
        </svg>
        Donate Now
      </a>
    </div>
  );
}
