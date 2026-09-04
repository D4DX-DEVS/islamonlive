"use client";

import { useEffect } from "react";
import { useReadingPrefs, prefsToCss } from "@/lib/reader";

/* Publishes the reader's text-size and font choice as CSS custom properties on
   <html>, where globals.css's .reader-body picks them up. Renders nothing.

   Custom properties rather than classes: the article body is server-rendered
   markup from WordPress, and re-rendering it on the client just to change a font
   would throw away the whole prose tree on every slider step. */
export default function ReadingPrefsSetup() {
  const prefs = useReadingPrefs();

  useEffect(() => {
    const { size, font } = prefsToCss(prefs);
    const root = document.documentElement;
    root.style.setProperty("--read-size", size);
    root.style.setProperty("--read-font", font);
  }, [prefs]);

  return null;
}
