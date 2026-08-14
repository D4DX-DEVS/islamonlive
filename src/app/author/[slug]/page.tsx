import { notFound } from "next/navigation";
import Link from "next/link";
import PostCard from "@/components/PostCard";
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
  const page = Number((await searchParams).page ?? 1);
  const user = await getUserBySlug(slug);
  if (!user) notFound();

  const posts = await getPosts({ author: user.id, perPage: 12, page });

  return (
    <div>
      <h1 className="mb-2 border-l-4 border-purple-800 pl-3 text-2xl font-extrabold">{user.name}</h1>
      {user.description && <p className="mb-6 max-w-3xl text-sm text-zinc-600">{user.description}</p>}
      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {posts.map((p) => <PostCard key={p.id} post={p} showExcerpt />)}
      </div>
      <div className="mt-8 flex justify-center gap-4">
        {page > 1 && <Link href={`/author/${slug}?page=${page - 1}`} className="rounded bg-purple-800 px-4 py-2 text-sm font-medium text-white">← Previous</Link>}
        {posts.length === 12 && <Link href={`/author/${slug}?page=${page + 1}`} className="rounded bg-purple-800 px-4 py-2 text-sm font-medium text-white">Next →</Link>}
      </div>
    </div>
  );
}
