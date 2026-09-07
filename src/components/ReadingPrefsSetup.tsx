"use client";

import { useEffect } from "react";
import { useReadingPrefs, prefsToCss } from "@/lib/reader";

/* Publishes the reader's text-size and font choice as CSS custom properties,
   where globals.css's .reader-body picks them up. Renders nothing.

   Custom properties rather than classes: the article body is server-rendered
   markup from WordPress, and re-rendering it on the client just to change a font
   would throw away the whole prose tree on every slider step.

   Set on <body>, not <html>: the value is `var(--font-serif-ml)` and the
   next/font variables are declared on <body>. A custom property is resolved
   where it is declared, so on <html> the inner var() found nothing, the
   property became invalid and every face fell back to Noto Sans. */
export default function ReadingPrefsSetup() {
  const prefs = useReadingPrefs();

  useEffect(() => {
    const { size, font } = prefsToCss(prefs);
    const el = document.body;
    el.style.setProperty("--read-size", size);
    el.style.setProperty("--read-font", font);
  }, [prefs]);

  return null;
}
