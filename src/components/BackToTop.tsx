"use client";

import { useEffect, useState } from "react";

export default function BackToTop() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const onScroll = () => setVisible(window.scrollY > 400);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  if (!visible) return null;

  return (
    <button
      type="button"
      aria-label="Back to top"
      onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
      className="fixed bottom-4 right-4 z-50 flex h-10 w-10 cursor-pointer items-center justify-center rounded-full bg-purple-800 text-white shadow-[0_4px_16px_rgba(0,0,0,0.25)] transition hover:bg-purple-700 sm:bottom-6 sm:right-6 sm:h-11 sm:w-11 print:hidden"
    >
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden className="h-5 w-5">
        <path d="M12 19V5M5 12l7-7 7 7" />
      </svg>
    </button>
  );
}
