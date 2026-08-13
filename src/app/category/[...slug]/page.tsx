import { notFound } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import PostCard from "@/components/PostCard";
import { getCategoryBySlug, getPosts, featuredImage, postPath } from "@/lib/wordpress";

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
      {cat.slug === "infographics" ? (
        // live-site style: portrait tile + title only — no category badge, author, or excerpt
        <div className="grid grid-cols-2 gap-5 sm:grid-cols-3 lg:grid-cols-5">
          {posts.map((p) => {
            const img = featuredImage(p);
            return (
              <Link key={p.id} href={postPath(p)} className="group">
                <div className="relative aspect-[4/5] w-full overflow-hidden rounded-lg bg-zinc-100 shadow-sm ring-1 ring-inset ring-zinc-900/10 transition group-hover:shadow-md group-hover:ring-purple-300">
                  {img && <Image src={img.url} alt="" fill sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 20vw" className="object-cover transition group-hover:scale-105" />}
                </div>
                <h3 className="mt-2 line-clamp-2 text-sm font-bold leading-snug group-hover:text-purple-800" dangerouslySetInnerHTML={{ __html: p.title.rendered }} />
              </Link>
            );
          })}
        </div>
      ) : (
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {posts.map((p) => <PostCard key={p.id} post={p} showExcerpt />)}
        </div>
      )}
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
