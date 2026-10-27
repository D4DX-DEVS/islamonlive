import { TTL } from "@/lib/cache";
import { toWPPage } from "@/lib/db/adapt";
import { cached } from "@/lib/db/cache";
import { collection } from "@/lib/db/client";
import { safeDecode } from "@/lib/urls";
import type { WPPage } from "@/lib/wp-model";

/* WordPress static pages (about, contact, …) from MongoDB. */

const PAGE_TAGS = ["wp", "wp:pages"];

/** The slug as stored is WordPress's: may be percent-encoded, must match as stored or decoded. */
function slugCandidates(slug: string): string[] {
  const decoded = safeDecode(slug);
  return [...new Set([encodeURIComponent(decoded).toLowerCase(), decoded, slug])];
}

async function pageBySlug(slug: string): Promise<WPPage | null> {
  const doc = await (await collection("pages")).findOne(
    { status: "publish", slug: { $in: slugCandidates(slug) } },
    { projection: { content_raw: 0 } }
  );
  return doc ? toWPPage(doc) : null;
}

export const getPageBySlug = cached("pages:slug", pageBySlug, {
  revalidate: TTL.page,
  tags: PAGE_TAGS,
});
