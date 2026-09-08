import Link from "next/link";
import { notFound, permanentRedirect } from "next/navigation";
import InfiniteFeed from "@/components/InfiniteFeed";
import JsonLd from "@/components/JsonLd";
import { FEED_PER_PAGE } from "@/lib/feed";
import { getCategoryBySlug, getPostsPage, decodeEntities, stripHtml } from "@/lib/wordpress";
import { seoMetadata, seoSchema, termSeo } from "@/lib/seo";
import { breadcrumbSchema, collectionPageSchema, graph, siteNodes } from "@/lib/schema";
import { siteUrl } from "@/lib/env";
import { toSitePath } from "@/lib/urls";
import { pagePath, splitPage } from "@/lib/paging";

export const revalidate = 60;

/* No entries: every archive renders on its first request and is then cached
   and revalidated like a static page. Without this export a dynamic route is
   rendered afresh on every request and never cached at all. */
export function generateStaticParams(): { slug: string[] }[] {
  return [];
}

// matches WP nested category URLs (/category/opinion/kerala-politics-opinion/);
// the leaf slug identifies the category.
function leaf(slug: string[]): string {
  return slug[slug.length - 1] ?? "";
}

/** The archive's real path — WP's own term link, so nesting and encoding match. */
function categoryPath(cat: { slug: string; link?: string }): string {
  return cat.link ? toSitePath(cat.link) : `/category/${cat.slug}/`;
}

/* The redirect is decided here and thrown by the page; generateMetadata only
   404s. There is no loading.tsx on this route, so nothing is flushed before
   the page's throw sets the status, and the metadata computed for a
   redirected request is simply discarded. Known and accepted: on the first,
   uncached answer Next 16.3 replays the render's headers with appendHeader
   (next-server.js), so that one response carries the same Location twice —
   identical values, which browsers and Googlebot accept; cached answers carry
   it once. An explicit /page/1/ never gets here: next.config 301s it. */
/* One resolution for both generateMetadata and the page. A nested category is
   reachable by its leaf alone, so /category/anything/views/ would render the
   Views archive at a 200 — those are sent to the real path (keeping the page
   number) instead of letting Google index an archive at unlimited addresses.
   An explicit /page/1/ goes to the bare archive, as WordPress does. */
async function resolve(all: string[]) {
  const { segments, page, explicit } = splitPage(all);
  const cat = await getCategoryBySlug(leaf(segments));
  if (!cat) notFound();

  const canonical = categoryPath(cat);
  const requested = `/category/${segments.join("/")}/`;
  const wrongPath = decodeURIComponent(requested).toLowerCase() !== decodeURIComponent(canonical).toLowerCase();
  const redirectTo = wrongPath || (explicit && page === 1) ? pagePath(canonical, page) : null;

  return { cat, page, canonical, name: decodeEntities(cat.name), redirectTo };
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string[] }> }) {
  const { cat, page, canonical, name } = await resolve((await params).slug);

  // Yoast's archive title/description come from a site-wide template (with its
  // typos); the archive's own name and WP description read better — termSeo()
  return seoMetadata(termSeo(cat.yoast_head_json), {
    path: canonical,
    title: name,
    // stripHtml() first: a WP blurb that is only &nbsp; and an empty heading must not count as one
    description: stripHtml(cat.description ?? "") || `${name} — the latest articles, opinion and analysis from Islamonlive.`,
    type: "website",
    page,
  });
}

export default async function CategoryPage({ params }: { params: Promise<{ slug: string[] }> }) {
  const { cat, page, canonical, name, redirectTo } = await resolve((await params).slug);
  if (redirectTo) permanentRedirect(redirectTo);

  // the whole subtree, as WordPress's own archive lists it (see postQuery)
  const ids = [cat.id];
  const { items: posts, totalPages } = await getPostsPage({ categories: ids, includeChildren: true, perPage: FEED_PER_PAGE, page });

  // an archive with nothing in it is a 404 — WordPress answers the same way, and
  // a 200 carrying an empty list is a soft 404 in Search Console; a page number
  // past the end is the same case
  if (posts.length === 0) notFound();

  const url = siteUrl(pagePath(canonical, page));

  return (
    <div>
      <JsonLd
        data={
          seoSchema(cat.yoast_head_json) ??
          graph(collectionPageSchema(url, name), breadcrumbSchema([{ name: "Home", path: "/" }, { name }], url), ...siteNodes())
        }
      />
      <nav aria-label="Breadcrumb" className="mb-3 hidden text-xs text-zinc-500 sm:block">
        <Link href="/" className="hover:text-purple-800">Home</Link>
        <span className="px-1.5">/</span>
        <span className="text-zinc-700">{name}</span>
        {page > 1 && <span className="text-zinc-400"> · page {page}</span>}
      </nav>
      <h1 className="mb-6 border-l-4 border-purple-800 pl-3 text-2xl font-extrabold">
        {name}
        {page > 1 && <span className="ml-2 text-base font-semibold text-zinc-500"> page {page} of {totalPages}</span>}
      </h1>
      <InfiniteFeed
        initial={posts}
        query={{ kind: "category", ids }}
        startPage={page}
        hasMore={page < totalPages}
        variant={cat.slug === "infographics" ? "infographics" : "cards"}
        base={canonical}
        totalPages={totalPages}
      />
    </div>
  );
}
