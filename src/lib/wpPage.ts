import { getPageBySlug, stripHtml } from "@/lib/wordpress";

/* The WP static pages (about, contact, privacy-policy, ...) are Elementor
   documents: nested container divs, a breadcrumbs widget and — on Contact — a
   JS-only form widget that renders as the bare string "Please enable JavaScript…"
   once the theme's scripts are gone. Rendering that markup as-is is what made
   those pages look unstyled, so we clean it before it reaches a card. */

// paragraphs we never want on the site regardless of what the WP page carries
const DROP = /(സബ്\s*എഡിറ്റർ)|(sub\s*-?\s*editor)|(enable JavaScript)/i;

/** Inner HTML of every real <p> in a WP page, in document order. */
export function pageParagraphs(html: string): string[] {
  const out: string[] = [];
  const re = /<p\b([^>]*)>([\s\S]*?)<\/p>/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html))) {
    const [, attrs, inner] = m;
    // the breadcrumbs widget is a lone "Home" link — the site has its own nav
    if (/id=["']breadcrumbs["']/i.test(attrs)) continue;
    const text = inner.replace(/<[^>]+>/g, "").replace(/&nbsp;/g, " ").trim();
    if (!text || DROP.test(text)) continue;
    // Elementor writes inline `style="color: black"` on links, which reads as
    // dead text on our cards — drop styling and keep the markup (a/strong/br)
    out.push(inner.replace(/\sstyle=("[^"]*"|'[^']*')/gi, "").trim());
  }
  return out;
}

/** The page body with the Elementor leftovers removed, ready for a .prose card. */
export function cleanPageHtml(html: string, title: string): string {
  let out = html
    // breadcrumbs widget — the page renders its own crumb trail instead
    .replace(/<p\b[^>]*id=["']breadcrumbs["'][\s\S]*?<\/p>/gi, "")
    // paragraphs we never publish (sub editor, the JS-form placeholder)
    .replace(/<p\b[^>]*>([\s\S]*?)<\/p>/gi, (tag, inner: string) =>
      DROP.test(inner.replace(/<[^>]+>/g, "")) ? "" : tag
    )
    // Elementor's inline colours fight the site's own link/text styling
    .replace(/\sstyle=("[^"]*"|'[^']*')/gi, "");

  // WP renders the page title again as the first heading — the <h1> above the
  // card already says it, so drop the duplicate
  const plain = stripHtml(title).trim().toLowerCase();
  out = out.replace(/<h([1-3])\b[^>]*>([\s\S]*?)<\/h\1>/i, (tag, _lvl, inner: string) =>
    stripHtml(inner).trim().toLowerCase() === plain ? "" : tag
  );
  return out;
}

export interface StaticPage {
  title: string;
  paragraphs: string[];
  html: string;
}

export async function getStaticPage(slug: string): Promise<StaticPage | null> {
  const page = await getPageBySlug(slug);
  if (!page) return null;
  return {
    title: page.title.rendered,
    paragraphs: pageParagraphs(page.content.rendered),
    html: cleanPageHtml(page.content.rendered, page.title.rendered),
  };
}
