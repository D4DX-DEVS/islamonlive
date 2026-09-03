import { notFound } from "next/navigation";
import InfiniteFeed from "@/components/InfiniteFeed";
import { FEED_PER_PAGE } from "@/lib/feed";
import { getUserBySlug, getPosts } from "@/lib/wordpress";

export const revalidate = 60;

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const user = await getUserBySlug((await params).slug);
  return { title: user?.name ?? "Author" };
}

export default async function AuthorPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ page?: string }>;
}) {
  const { slug } = await params;
  // kept only so old ?page=N links still resolve; the list scrolls itself now
  const page = Math.max(1, Number((await searchParams).page ?? 1) || 1);
  const user = await getUserBySlug(slug);
  if (!user) notFound();

  const posts = await getPosts({ author: user.id, perPage: FEED_PER_PAGE, page });

  return (
    <div>
      <h1 className="mb-2 border-l-4 border-purple-800 pl-3 text-2xl font-extrabold">{user.name}</h1>
      {user.description && <p className="mb-6 max-w-3xl text-sm text-zinc-600">{user.description}</p>}
      <InfiniteFeed initial={posts} query={{ kind: "author", id: user.id }} startPage={page} />
    </div>
  );
}
