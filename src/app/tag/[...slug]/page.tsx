import Link from "next/link";
import { notFound, permanentRedirect } from "next/navigation";
import InfiniteFeed from "@/components/InfiniteFeed";
import JsonLd from "@/components/JsonLd";
import { FEED_PER_PAGE } from "@/lib/feed";
import { getTagBySlug, getPostsPage, decodeEntities, stripHtml } from "@/lib/wordpress";
import { seoMetadata, seoSchema, termSeo } from "@/lib/seo";
import { breadcrumbSchema, collectionPageSchema, graph, siteNodes } from "@/lib/schema";
import { siteUrl } from "@/lib/env";
import { pagePath, splitPage } from "@/lib/paging";

export const revalidate = 60;

// no entries: rendered on first request, then cached like a static page
export function generateStaticParams(): { slug: string[] }[] {
  return [];
}

/* The redirect is decided here and thrown by the page; generateMetadata only
   404s. There is no loading.tsx on this route, so nothing is flushed before
   the page's throw sets the status, and the metadata computed for a
   redirected request is simply discarded. Known and accepted: on the first,
   uncached answer Next 16.3 replays the render's headers with appendHeader
   (next-server.js), so that one response carries the same Location twice —
   identical values, which browsers and Googlebot accept; cached answers carry
   it once. An explicit /page/1/ never gets here: next.config 301s it. */
/* /tag/{slug}/ and /tag/{slug}/page/N/ — the catch-all exists only so the page
   number can be read from the path (see lib/paging.ts); anything deeper is not
   a tag URL. */
async function resolve(all: string[]) {
  const { segments, page, explicit } = splitPage(all);
  if (segments.length !== 1) notFound();
  const slug = segments[0];
  const tag = await getTagBySlug(slug);
  if (!tag) notFound();
  const path = `/tag/${slug}/`;
  return { tag, page, path, name: decodeEntities(tag.name), redirectTo: explicit && page === 1 ? path : null };
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string[] }> }) {
  const { tag, page, path, name } = await resolve((await params).slug);
  return seoMetadata(termSeo(tag.yoast_head_json), {
    path,
    title: `#${name}`,
    description: stripHtml(tag.description ?? "") || `Articles tagged ${name} on Islamonlive.`,
    type: "website",
    page,
  });
}

export default async function TagPage({ params }: { params: Promise<{ slug: string[] }> }) {
  const { tag, page, path, name, redirectTo } = await resolve((await params).slug);
  if (redirectTo) permanentRedirect(redirectTo);

  const { items: posts, totalPages } = await getPostsPage({ tags: [tag.id], perPage: FEED_PER_PAGE, page });
  // an archive with nothing in it is a 404 — WordPress answers the same way, and
  // a 200 carrying an empty list is a soft 404 in Search Console
  if (posts.length === 0) notFound();

  const url = siteUrl(pagePath(path, page));

  return (
    <div>
      <JsonLd
        data={
          seoSchema(tag.yoast_head_json) ??
          graph(collectionPageSchema(url, `#${name}`), breadcrumbSchema([{ name: "Home", path: "/" }, { name: `#${name}` }], url), ...siteNodes())
        }
      />
      <nav aria-label="Breadcrumb" className="mb-3 hidden text-xs text-zinc-500 sm:block">
        <Link href="/" className="hover:text-purple-800">Home</Link>
        <span className="px-1.5">/</span>
        <span className="text-zinc-700">#{name}</span>
        {page > 1 && <span className="text-zinc-400"> · page {page}</span>}
      </nav>
      <h1 className="mb-6 border-l-4 border-purple-800 pl-3 text-2xl font-extrabold">
        #{name}
        {page > 1 && <span className="ml-2 text-base font-semibold text-zinc-500"> page {page} of {totalPages}</span>}
      </h1>
      <InfiniteFeed initial={posts} query={{ kind: "tag", id: tag.id }} startPage={page} hasMore={page < totalPages} base={path} totalPages={totalPages} />
    </div>
  );
}
