import { notFound } from "next/navigation";
import Link from "next/link";
import PostCard from "@/components/PostCard";
import { getTagBySlug, getPosts } from "@/lib/wordpress";

export const revalidate = 600;

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
  const page = Number((await searchParams).page ?? 1);
  const tag = await getTagBySlug(slug);
  if (!tag) notFound();

  const posts = await getPosts({ tags: [tag.id], perPage: 12, page });

  return (
    <div>
      <h1 className="mb-6 border-l-4 border-purple-800 pl-3 text-2xl font-extrabold">#{tag.name}</h1>
      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {posts.map((p) => <PostCard key={p.id} post={p} showExcerpt />)}
      </div>
      <div className="mt-8 flex justify-center gap-4">
        {page > 1 && <Link href={`/tag/${slug}?page=${page - 1}`} className="rounded bg-purple-800 px-4 py-2 text-sm font-medium text-white">← Previous</Link>}
        {posts.length === 12 && <Link href={`/tag/${slug}?page=${page + 1}`} className="rounded bg-purple-800 px-4 py-2 text-sm font-medium text-white">Next →</Link>}
      </div>
    </div>
  );
}
