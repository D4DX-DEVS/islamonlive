import { notFound } from "next/navigation";
import InfiniteFeed from "@/components/InfiniteFeed";
import { FEED_PER_PAGE } from "@/lib/feed";
import { getTagBySlug, getPosts } from "@/lib/wordpress";

export const revalidate = 60;

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const tag = await getTagBySlug((await params).slug);
  return { title: tag?.name ?? "Tag" };
}

export default async function TagPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ page?: string }>;
}) {
  const { slug } = await params;
  // kept only so old ?page=N links still resolve; the list scrolls itself now
  const page = Math.max(1, Number((await searchParams).page ?? 1) || 1);
  const tag = await getTagBySlug(slug);
  if (!tag) notFound();

  const posts = await getPosts({ tags: [tag.id], perPage: FEED_PER_PAGE, page });

  return (
    <div>
      <h1 className="mb-6 border-l-4 border-purple-800 pl-3 text-2xl font-extrabold">#{tag.name}</h1>
      <InfiniteFeed initial={posts} query={{ kind: "tag", id: tag.id }} startPage={page} />
    </div>
  );
}
