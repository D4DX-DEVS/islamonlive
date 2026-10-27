import type { WPPage } from "@/lib/wp-model";

/* WordPress static pages (about, contact, …) from MongoDB. */

export async function getPageBySlug(slug: string): Promise<WPPage | null> {
  void slug;
  throw new Error("db/pages.getPageBySlug: not implemented");
}
