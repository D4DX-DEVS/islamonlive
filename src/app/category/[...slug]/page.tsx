import { notFound } from "next/navigation";
import Link from "next/link";
import PostCard from "@/components/PostCard";
import { getCategoryBySlug, getPosts } from "@/lib/wordpress";

export const revalidate = 300;

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
  const page = Number((await searchParams).page ?? 1);
  const cat = await getCategoryBySlug(leaf(slug));
  if (!cat) notFound();

  const posts = await getPosts({ categories: [cat.id], perPage: 12, page });
  const base = `/category/${slug.join("/")}`;

  return (
    <div>
      <h1 className="mb-6 border-l-4 border-purple-800 pl-3 text-2xl font-extrabold">{cat.name}</h1>
      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {posts.map((p) => <PostCard key={p.id} post={p} showExcerpt />)}
      </div>
      <div className="mt-8 flex justify-center gap-4">
        {page > 1 && (
          <Link href={`${base}?page=${page - 1}`} className="rounded bg-purple-800 px-4 py-2 text-sm font-medium text-white">← Previous</Link>
        )}
        {posts.length === 12 && (
          <Link href={`${base}?page=${page + 1}`} className="rounded bg-purple-800 px-4 py-2 text-sm font-medium text-white">Next →</Link>
        )}
      </div>
    </div>
  );
}
