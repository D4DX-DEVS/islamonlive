import { notFound } from "next/navigation";
import InfiniteFeed from "@/components/InfiniteFeed";
import { FEED_PER_PAGE } from "@/lib/feed";
import { getCategoryBySlug, getChildCategoryIds, getPosts } from "@/lib/wordpress";

export const revalidate = 60;

// matches WP nested category URLs (/category/opinion/kerala-politics-opinion/);
// the leaf slug identifies the category.
function leaf(slug: string[]): string {
  return slug[slug.length - 1];
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string[] }> }) {
  const cat = await getCategoryBySlug(leaf((await params).slug));
  return { title: cat?.name ?? "Category" };
}

export default async function CategoryPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string[] }>;
  searchParams: Promise<{ page?: string }>;
}) {
  const { slug } = await params;
  // no Previous/Next any more — the list loads itself as the reader scrolls. The
  // param is still honoured so old ?page=N links (and anything Google indexed)
  // land on their posts and carry on from there
  const page = Math.max(1, Number((await searchParams).page ?? 1) || 1);
  const cat = await getCategoryBySlug(leaf(slug));
  if (!cat) notFound();

  const kids = await getChildCategoryIds(cat.id).catch(() => []);
  const ids = [cat.id, ...kids];
  const posts = await getPosts({ categories: ids, perPage: FEED_PER_PAGE, page });

  return (
    <div>
      <h1 className="mb-6 border-l-4 border-purple-800 pl-3 text-2xl font-extrabold">{cat.name}</h1>
      <InfiniteFeed
        initial={posts}
        query={{ kind: "category", ids }}
        startPage={page}
        variant={cat.slug === "infographics" ? "infographics" : "cards"}
      />
    </div>
  );
}
