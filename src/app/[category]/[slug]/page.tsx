import { notFound } from "next/navigation";
import Image from "next/image";
import { getPostBySlug, featuredImage, authorName, primaryCategory, formatDate, stripHtml } from "@/lib/wordpress";

export const revalidate = 600;

export async function generateMetadata({ params }: { params: Promise<{ category: string; slug: string }> }) {
  const post = await getPostBySlug((await params).slug);
  if (!post) return {};
  const img = featuredImage(post);
  return {
    title: stripHtml(post.title.rendered),
    description: stripHtml(post.excerpt.rendered).slice(0, 160),
    openGraph: { images: img ? [img.url] : [] },
  };
}

export default async function PostPage({ params }: { params: Promise<{ category: string; slug: string }> }) {
  const { slug } = await params;
  const post = await getPostBySlug(slug);
  if (!post) notFound();

  const img = featuredImage(post);
  const cat = primaryCategory(post);

  return (
    <article className="mx-auto max-w-3xl">
      {cat && <span className="mb-3 inline-block rounded bg-purple-800 px-2.5 py-1 text-xs font-semibold text-white">{cat.name}</span>}
      <h1 className="text-3xl font-extrabold leading-snug" dangerouslySetInnerHTML={{ __html: post.title.rendered }} />
      <div className="mt-3 flex gap-3 text-sm text-zinc-500">
        {authorName(post) && <span>{authorName(post)}</span>}
        <time>{formatDate(post.date)}</time>
      </div>
      {img && (
        <div className="relative mt-6 aspect-[16/9] w-full overflow-hidden rounded-xl bg-zinc-100">
          <Image src={img.url} alt={img.alt} fill priority sizes="(max-width: 768px) 100vw, 768px" className="object-cover" />
        </div>
      )}
      <div
        className="prose prose-zinc mt-8 max-w-none prose-a:text-purple-800 prose-img:rounded-lg [&_iframe]:max-w-full"
        dangerouslySetInnerHTML={{ __html: post.content.rendered }}
      />
    </article>
  );
}
