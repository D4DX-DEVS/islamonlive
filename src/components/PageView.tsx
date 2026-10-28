"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import { trackPageView } from "@/lib/analytics/tracker";
import type { PageKind } from "@/lib/analytics/shared";

type PageViewProps = { kind: PageKind; articleId?: number; categories?: number[] };

/* Counts one view of the page it is rendered on (lib/analytics/tracker.ts).
   Renders nothing. The view id is kept per path in a ref, so React re-running
   the effect (StrictMode, a re-render with new props) reuses it and the server
   keeps it one view; a new path is a new view. Categories are passed as a
   string so a fresh array from the server component is not a new dependency. */
export default function PageView({ kind, articleId, categories }: PageViewProps) {
  const pathname = usePathname();
  const view = useRef<{ path: string; id: string } | null>(null);
  const categoryList = (categories ?? []).join(",");

  useEffect(() => {
    if (view.current?.path !== pathname) view.current = { path: pathname, id: crypto.randomUUID?.() ?? `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}` };
    const ids = categoryList ? categoryList.split(",").map(Number) : [];
    return trackPageView({ kind, articleId, categories: ids }, view.current.id);
  }, [pathname, kind, articleId, categoryList]);

  return null;
}
