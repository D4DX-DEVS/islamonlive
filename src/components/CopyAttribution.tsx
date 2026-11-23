"use client";

import { useEffect } from "react";
import { attributesPath, sourceUrl, withAttribution } from "@/lib/copy-attribution";

/** True when the copy comes from a field the reader types in (search box, forms), which must copy as-is. */
function fromEditable(node: Node | null): boolean {
  const el = node instanceof Element ? node : node?.parentElement;
  return Boolean(el?.closest("input, textarea, select, [contenteditable=''], [contenteditable='true']"));
}

/**
 * Appends the page's link to whatever a reader copies from the site's content
 * (see lib/copy-attribution). Renders nothing; mounted once in the root layout.
 */
export default function CopyAttribution() {
  useEffect(() => {
    function onCopy(event: ClipboardEvent) {
      if (!event.clipboardData || !attributesPath(location.pathname)) return;
      const selection = document.getSelection();
      if (!selection || selection.isCollapsed || !selection.rangeCount) return;
      if (fromEditable(document.activeElement) || fromEditable(selection.anchorNode)) return;
      const holder = document.createElement("div");
      for (let i = 0; i < selection.rangeCount; i++) holder.appendChild(selection.getRangeAt(i).cloneContents());
      const canonical = document.querySelector<HTMLLinkElement>('link[rel="canonical"]')?.href;
      const result = withAttribution(selection.toString(), holder.innerHTML, sourceUrl(location, canonical));
      if (!result) return;
      event.clipboardData.setData("text/plain", result.text);
      event.clipboardData.setData("text/html", result.html);
      event.preventDefault();
    }
    document.addEventListener("copy", onCopy);
    return () => document.removeEventListener("copy", onCopy);
  }, []);
  return null;
}
