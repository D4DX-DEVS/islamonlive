/* Helper functions for posts endpoints. */

import { collection } from "@/lib/db/client";

const HTML_TAG_RE = /<[^>]*>/g;

/** Strip HTML tags and entities from text. */
export function stripHtml(html: string): string {
  return html
    .replace(HTML_TAG_RE, " ")
    .replace(/&[a-z]+;/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Generate WordPress auto-excerpt: 55 words of stripped content + "[…]". */
export function generateAutoExcerpt(content: string): string {
  const text = stripHtml(content);
  const words = text.split(/\s+/);
  const truncated = words.slice(0, 55).join(" ");
  if (words.length > 55) {
    return `<p>${truncated} [&hellip;]</p>\n`;
  }
  return `<p>${truncated}</p>\n`;
}

/** Get default category from site settings or return 1. */
export async function getDefaultCategory(): Promise<number> {
  try {
    const settings = await collection("settings");
    const siteSettings = await settings.findOne({ _id: "site" });
    const defaultCat = siteSettings?.default_category;
    if (typeof defaultCat === "number" && defaultCat > 0) {
      return defaultCat;
    }
  } catch {
    // Fall back to 1
  }
  return 1;
}

/** Validate that featured_media exists in media collection. */
export async function validateFeaturedMedia(mediaId: number | null): Promise<boolean> {
  if (!mediaId || mediaId === 0) return true;
  const media = await collection("media");
  const exists = await media.findOne({ _id: mediaId });
  return !!exists;
}

/** Infer custom SEO title from stored seo vs generated. */
export function inferCustomTitle(
  storedSeoTitle: string | undefined,
  generatedTitle: string
): string | undefined {
  if (!storedSeoTitle) return undefined;
  // If stored differs from template, it was custom
  return storedSeoTitle !== generatedTitle ? storedSeoTitle : undefined;
}

/** Infer custom SEO description from stored seo vs generated. */
export function inferCustomDescription(
  storedSeoDesc: string | undefined,
  generatedDesc: string
): string | undefined {
  if (!storedSeoDesc) return undefined;
  // If stored differs from template, it was custom
  return storedSeoDesc !== generatedDesc ? storedSeoDesc : undefined;
}
