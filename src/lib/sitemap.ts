import { TTL } from "@/lib/cache";
import { SITE_URL, WP_API } from "@/lib/env";
import { toSiteUrl } from "@/lib/urls";
import { getStaticPage } from "@/lib/wpPage";

/* The sitemaps, at the addresses Yoast used.

   Search Console has been fed https://islamonlive.in/sitemap_index.xml and its
   35 children for years. Generating a differently-named set would strand all of
   that, so the routes under app/api/sitemap answer the same URLs (next.config
   rewrites them there) with the same 1,000-per-file chunking Yoast used:

     /sitemap_index.xml          the index
     /post-sitemap.xml           posts 1-1000     (no digit on the first file)
     /post-sitemap2.xml          posts 1001-2000  ... through 23
     /page-sitemap.xml           WP pages
     /category-sitemap.xml       categories
     /post_tag-sitemap.xml (+N)  tags
     /author-sitemap.xml   (+N)  authors
     /news-sitemap.xml           Google News: the last 48 hours

   Every <loc> is built from the object's own permalink through toSiteUrl(), so
   the entries carry the public host and the same encoding of the Malayalam
   slugs as the article's canonical — a sitemap that disagreed with the
   canonical would put the two in conflict.

   Drafts, private and trashed posts never appear: the REST API only returns
   status=publish to an anonymous caller, which is what this is. Anything Yoast
   marked noindex is dropped explicitly. */

const PER_FILE = 1000;
const WP_PER_PAGE = 100; // REST hard limit

export const SITEMAP_TYPES = ["post", "page", "category", "post_tag", "author"] as const;
export type SitemapType = (typeof SITEMAP_TYPES)[number];

export function isSitemapType(s: string): s is SitemapType {
  return (SITEMAP_TYPES as readonly string[]).includes(s);
}

interface Endpoint {
  /** WP REST collection behind this sitemap type. */
  path: string;
}

const ENDPOINTS: Record<SitemapType, Endpoint> = {
  post: { path: "posts" },
  page: { path: "pages" },
  category: { path: "categories" },
  post_tag: { path: "tags" },
  author: { path: "users" },
};

interface Entry {
  link?: string;
  slug?: string;
  modified?: string;
  date?: string;
  title?: { rendered: string };
  count?: number;
  yoast_head_json?: { robots?: { index?: string } };
}

/** WP pages this app 301s elsewhere (see next.config redirects) — their old URL must not be advertised. */
const REDIRECTED_PAGES = new Set(["life", "hadith-padanam", "ask-your-question"]);

/** WP pages this app renders from a route of its own, whatever their REST body holds. */
const ROUTED_PAGES = new Set(["about", "contact", "authors-list"]);

function pageCandidate(e: Entry): boolean {
  return !!e.slug && !e.slug.startsWith("elementor-") && !REDIRECTED_PAGES.has(e.slug);
}

/* A WP page whose body is a page-builder widget arrives with an empty body
   over REST and answers 404 on this site, so it has no business in the sitemap.
   Asking for every page's rendered content in one request makes Elementor
   render them all at once and the origin gives up with a 500 (tested), so the
   check is the same one-page fetch the page route itself makes — sharing its
   cache — a few at a time. A page whose render fails is left out too. */
async function renders(e: Entry): Promise<boolean> {
  if (ROUTED_PAGES.has(e.slug!)) return true;
  const page = await getStaticPage(e.slug!).catch(() => null);
  return !!page && page.html.trim().length > 0;
}

async function realPages(entries: Entry[]): Promise<Entry[]> {
  const keep: Entry[] = [];
  const BATCH = 4;
  for (let i = 0; i < entries.length; i += BATCH) {
    const slice = entries.slice(i, i + BATCH);
    const flags = await Promise.all(slice.map(renders));
    slice.forEach((e, j) => flags[j] && keep.push(e));
  }
  return keep;
}

const STYLESHEET = `<?xml-stylesheet type="text/xsl" href="${SITE_URL}/main-sitemap.xsl"?>`;

function xml(body: string): Response {
  return new Response(`<?xml version="1.0" encoding="UTF-8"?>\n${body}`, {
    headers: {
      "Content-Type": "application/xml; charset=UTF-8",
      "Cache-Control": "public, max-age=0, s-maxage=3600, stale-while-revalidate=86400",
      // the sitemap is for crawlers to read, not to list
      "X-Robots-Tag": "noindex",
    },
  });
}

/* WordPress being unreachable must not hand Google an empty but valid sitemap —
   it would read as "these URLs are gone". A 503 tells the crawler to come back. */
export function sitemapUnavailable(): Response {
  return new Response("Sitemap temporarily unavailable", {
    status: 503,
    headers: { "Retry-After": "600", "Cache-Control": "no-store" },
  });
}

/** &, <, > and quotes are the only characters that may not sit raw in XML text. */
function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

async function wpList(
  path: string,
  params: Record<string, string>,
  // widened: TTL is `as const`, so the default alone would pin this to 3600
  revalidateFor: number = TTL.taxonomy
): Promise<{ items: Entry[]; total: number }> {
  const q = new URLSearchParams(params);
  const res = await fetch(`${WP_API}/${path}?${q}`, {
    next: { revalidate: revalidateFor, tags: ["wp", `wp:${path}`, "sitemap"] },
  });
  if (!res.ok) throw new Error(`WP API ${res.status}: /${path}?${q}`);
  return { items: (await res.json()) as Entry[], total: Number(res.headers.get("X-WP-Total") ?? 0) };
}

function isTaxonomy(type: SitemapType): boolean {
  return type === "category" || type === "post_tag" || type === "author";
}

async function countOf(type: SitemapType): Promise<number> {
  const { total } = await wpList(ENDPOINTS[type].path, {
    per_page: "1",
    _fields: "id",
    ...(type === "category" || type === "post_tag" ? { hide_empty: "true" } : {}),
  });
  return total;
}

/** Yoast's naming: file 1 has no digit, file 2+ do. */
function childName(type: SitemapType, index: number): string {
  return `/${type}-sitemap${index === 1 ? "" : index}.xml`;
}

/** ISO time of the most recently edited item in a collection; undefined when WordPress cannot say. */
async function newest(path: string, revalidateFor: number): Promise<string | undefined> {
  const { items } = await wpList(path, { per_page: "1", orderby: "modified", order: "desc", _fields: "modified" }, revalidateFor).catch(
    () => ({ items: [] as Entry[], total: 0 })
  );
  return items[0]?.modified ? new Date(items[0].modified).toISOString() : undefined;
}

export async function sitemapIndex(): Promise<Response> {
  const [counts, newestPost, newestPage] = await Promise.all([
    Promise.all(SITEMAP_TYPES.map((t) => countOf(t).catch(() => 0))),
    newest("posts", TTL.posts),
    newest("pages", TTL.page),
  ]);

  /* lastmod per file, only where WordPress can say: the newest post edit for
     every post file (an edit to an old article can land in any of them) and
     for the news file, the newest page edit for the page file. Terms and users
     carry no edit time over REST, so their files get none — an invented date
     would only send crawlers back for nothing. */
  const lastmod: Partial<Record<SitemapType | "news", string>> = {
    ...(newestPost ? { post: newestPost, news: newestPost } : {}),
    ...(newestPage ? { page: newestPage } : {}),
  };

  const children: { path: string; type: SitemapType | "news" }[] = [];
  SITEMAP_TYPES.forEach((type, i) => {
    const files = counts[i] > 0 ? Math.ceil(counts[i] / PER_FILE) : 0;
    for (let n = 1; n <= files; n++) children.push({ path: childName(type, n), type });
  });
  children.push({ path: "/news-sitemap.xml", type: "news" });

  const body = children
    .map(({ path, type }) => {
      const mod = lastmod[type] ? `\n\t\t<lastmod>${lastmod[type]}</lastmod>` : "";
      return `\t<sitemap>\n\t\t<loc>${esc(SITE_URL + path)}</loc>${mod}\n\t</sitemap>`;
    })
    .join("\n");

  return xml(`${STYLESHEET}\n<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${body}\n</sitemapindex>`);
}

/** One 1,000-URL child file, assembled from ten 100-row REST pages. */
export async function childSitemap(type: SitemapType, fileIndex: number): Promise<Response> {
  const { path } = ENDPOINTS[type];
  const taxonomy = isTaxonomy(type);
  const pagesPerFile = PER_FILE / WP_PER_PAGE;
  const firstPage = (fileIndex - 1) * pagesPerFile + 1;

  const results = await Promise.all(
    Array.from({ length: pagesPerFile }, (_, i) =>
      wpList(
        path,
        {
          per_page: String(WP_PER_PAGE),
          page: String(firstPage + i),
          _fields: taxonomy ? "link,count,yoast_head_json" : type === "page" ? "link,slug,modified,yoast_head_json" : "link,modified,yoast_head_json",
          // stable ordering keeps a given article in the same file between
          // regenerations, so crawlers are not handed a reshuffled archive
          ...(taxonomy ? { hide_empty: "true" } : { orderby: "id", order: "asc" }),
        },
        taxonomy ? TTL.taxonomy : TTL.posts
      ).catch(() => ({ items: [] as Entry[], total: 0 }))
    )
  );

  const entries = results
    .flatMap((r) => r.items)
    .filter((e) => !!e.link)
    // whatever an editor marked noindex in Yoast stays out of the sitemap too
    .filter((e) => e.yoast_head_json?.robots?.index !== "noindex")
    // an empty term archive is a thin page; Yoast omits those as well
    .filter((e) => (taxonomy ? (e.count ?? 1) > 0 : true));

  // only the WP pages that actually render here (see renders()); Elementor's
  // template "pages" and the ones this app 301s away are not pages at all
  const kept = type === "page" ? await realPages(entries.filter(pageCandidate)) : entries;

  const urls = kept
    .map((e) => {
      const loc = esc(toSiteUrl(e.link!));
      // no changefreq/priority: Google ignores both, and Yoast dropped them too
      const mod = e.modified ? `\n\t\t<lastmod>${new Date(e.modified).toISOString()}</lastmod>` : "";
      return `\t<url>\n\t\t<loc>${loc}</loc>${mod}\n\t</url>`;
    });

  return xml(`${STYLESHEET}\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.join("\n")}\n</urlset>`);
}

/** Google News wants only what published in the last 48 hours. */
export async function newsSitemap(): Promise<Response> {
  const after = new Date(Date.now() - 48 * 3600 * 1000).toISOString();
  const { items } = await wpList(
    "posts",
    { per_page: "100", after, orderby: "date", order: "desc", _fields: "link,date,title,yoast_head_json" },
    TTL.posts
  ).catch(() => ({ items: [] as Entry[], total: 0 }));

  const urls = items
    .filter((e) => e.link && e.date && e.yoast_head_json?.robots?.index !== "noindex")
    .map((e) => {
      const title = esc((e.title?.rendered ?? "").replace(/<[^>]*>/g, "").trim());
      return [
        "\t<url>",
        `\t\t<loc>${esc(toSiteUrl(e.link!))}</loc>`,
        "\t\t<news:news>",
        "\t\t\t<news:publication>",
        "\t\t\t\t<news:name>Islamonlive.in</news:name>",
        "\t\t\t\t<news:language>ml</news:language>",
        "\t\t\t</news:publication>",
        `\t\t\t<news:publication_date>${new Date(e.date!).toISOString()}</news:publication_date>`,
        `\t\t\t<news:title>${title}</news:title>`,
        "\t\t</news:news>",
        "\t</url>",
      ].join("\n");
    });

  return xml(
    `${STYLESHEET}\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:news="http://www.google.com/schemas/sitemap-news/0.9">\n${urls.join("\n")}\n</urlset>`
  );
}
