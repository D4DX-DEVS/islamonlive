import Link from "next/link";
import { notFound } from "next/navigation";
import InfiniteFeed from "@/components/InfiniteFeed";
import JsonLd from "@/components/JsonLd";
import PageView from "@/components/PageView";
import { FEED_PER_PAGE } from "@/lib/feed";
import { getCategoryBySlug, getPostsPage, decodeEntities } from "@/lib/wordpress";
import { seoMetadata } from "@/lib/seo";
import { breadcrumbSchema, collectionPageSchema, graph, siteNodes } from "@/lib/schema";
import { siteUrl } from "@/lib/env";

export const revalidate = 60;

/* the header's Read menu "See all": every Read section in one feed. It used to
   point at Opinion, the same page as the first link above it — on Opinion
   itself the click went nowhere. Same order as the menu. */
const SECTIONS = ["opinion", "shariah", "culture", "columns"];
const PATH = "/read/";

export const metadata = seoMetadata(undefined, {
  path: PATH,
  title: "Read",
  description: "The latest opinion, Shari'ah, culture and columns from Islamonlive.",
  type: "website",
});

export default async function ReadPage() {
  const cats = (await Promise.all(SECTIONS.map(getCategoryBySlug))).filter((c) => c !== null);
  const ids = cats.map((c) => c.id);
  if (!ids.length) notFound();

  const { items: posts, totalPages } = await getPostsPage({ categories: ids, includeChildren: true, perPage: FEED_PER_PAGE, page: 1 });
  if (posts.length === 0) notFound();

  const url = siteUrl(PATH);

  return (
    <div>
      <PageView kind="category" />
      <JsonLd data={graph(collectionPageSchema(url, "Read"), breadcrumbSchema([{ name: "Home", path: "/" }, { name: "Read" }], url), ...siteNodes())} />
      <nav aria-label="Breadcrumb" className="mb-3 hidden text-xs text-zinc-500 sm:block">
        <Link href="/" className="hover:text-purple-800">Home</Link>
        <span className="px-1.5">/</span>
        <span className="text-zinc-700">Read</span>
      </nav>
      <h1 className="mb-4 border-l-4 border-purple-800 pl-3 text-2xl font-extrabold">Read</h1>
      <div className="mb-6 flex flex-wrap gap-2 text-sm">
        {cats.map((c) => (
          <Link key={c.id} href={`/category/${c.slug}/`} className="pill rounded-full bg-white px-4 py-2 font-semibold text-purple-800 ring-1 ring-purple-200 hover:bg-purple-50">
            {decodeEntities(c.name)}
          </Link>
        ))}
      </div>
      <InfiniteFeed initial={posts} query={{ kind: "category", ids }} startPage={1} hasMore={totalPages > 1} variant="cards" />
    </div>
  );
}
