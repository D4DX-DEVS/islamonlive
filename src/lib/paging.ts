/* WordPress archive pagination is a path, not a query: /category/news/page/2/.

   The archive routes take the whole path as a catch-all and pull the page
   number off the end here, rather than rewriting it onto ?page= — a page that
   reads searchParams can only ever be rendered per request, while one that
   reads params alone is cached and revalidated like any static page. On a site
   with 79 categories, 3,000 tags and 2,000 authors that is the difference
   between the CDN answering and WordPress answering. */

export interface PagedPath {
  /** The path with the page suffix removed. */
  segments: string[];
  /** 1 when no /page/N/ suffix was given. */
  page: number;
  /** True for an explicit /page/1/, which should redirect to the bare archive. */
  explicit: boolean;
}

export function splitPage(all: string[]): PagedPath {
  const n = all.length;
  // n >= 2: /authors-list/page/2/ arrives as ["page", "2"] with nothing in front
  if (n >= 2 && all[n - 2] === "page" && /^\d{1,6}$/.test(all[n - 1])) {
    const page = Math.max(1, Number(all[n - 1]));
    return { segments: all.slice(0, n - 2), page, explicit: true };
  }
  return { segments: all, page: 1, explicit: false };
}

/** The archive URL for a page: the bare path for page 1, /page/N/ after it. */
export function pagePath(base: string, page: number): string {
  return page > 1 ? `${base.replace(/\/$/, "")}/page/${page}/` : base;
}
