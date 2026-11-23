/* What a reader's clipboard gets when they copy text from the site: the text
   they selected, a blank line, then the address of the page it came from, so a
   paragraph pasted into WhatsApp or a document still points back to its source. */

/** Paths the attribution never applies to (the admin edits content; it does not publish it). */
const SKIP_PATHS = /^\/(admin|preview)(\/|$)/;

const escapeHtml = (text: string) =>
  text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/**
 * The address to credit: the page's canonical link when it is on this site,
 * else the current address without its query string or hash.
 */
export function sourceUrl(location: { origin: string; pathname: string }, canonical: string | null | undefined): string {
  if (canonical) {
    try {
      const url = new URL(canonical, location.origin);
      if (url.origin === location.origin) return url.origin + url.pathname;
    } catch {
      /* fall through to the current address */
    }
  }
  return location.origin + location.pathname;
}

/** False on pages where copying must stay untouched. */
export function attributesPath(pathname: string): boolean {
  return !SKIP_PATHS.test(pathname);
}

/** The plain-text and HTML clipboard contents for a selection, or null when there is nothing worth crediting. */
export function withAttribution(text: string, html: string, url: string): { text: string; html: string } | null {
  if (!text.trim()) return null;
  const link = escapeHtml(url);
  return {
    text: `${text.replace(/\s+$/, "")}\n\n${url}`,
    html: `${html || escapeHtml(text).replace(/\n/g, "<br>")}<br><br><a href="${link}">${link}</a>`,
  };
}
