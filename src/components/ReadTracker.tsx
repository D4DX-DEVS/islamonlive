"use client";

import { useEffect } from "react";
import { recordRead, type RecentItem } from "@/lib/reader";

/* Records the post as read so /settings → Continue reading can offer it again.
   Renders nothing.

   Keyed on the id rather than the whole object: the parent is a server component
   and hands a fresh object literal down on every render, which as an effect
   dependency would re-record on each one. */
export default function ReadTracker({ item }: { item: Omit<RecentItem, "at"> }) {
  const { id, href, title, img, category, date } = item;

  useEffect(() => {
    recordRead({ id, href, title, img, category, date });
  }, [id, href, title, img, category, date]);

  return null;
}
