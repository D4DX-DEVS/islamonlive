import { notFound } from "next/navigation";
import Image from "next/image";
import { getPostBySlug, featuredImage, authorName, primaryCategory, formatDate, stripHtml } from "@/lib/wordpress";

export const revalidate = 600;

// Catch-all: WP keeps sub-category posts at /{cat}/{subcat}/{slug}/, so depth varies.
// The last segment is always the post slug.
type Params = Promise<{ category: string; slug: string[] }>;

export async function generateMetadata({ params }: { params: Params }) {
  const post = await getPostBySlug((await params).slug.at(-1)!);
  if (!post) return {};
  const img = featuredImage(post);
  return {
    title: stripHtml(post.title.rendered),
    description: stripHtml(post.excerpt.rendered).slice(0, 160),
    openGraph: { images: img ? [img.url] : [] },
  };
}

export default async function PostPage({ params }: { params: Params }) {
  const { slug } = await params;
  const post = await getPostBySlug(slug.at(-1)!);
  if (!post) notFound();

  const img = featuredImage(post);
  const cat = primaryCategory(post);

  return (
    <article className="mx-auto max-w-3xl rounded-2xl bg-white p-5 shadow-sm ring-1 ring-zinc-200 sm:p-8">
      {cat && <span className="mb-3 inline-block rounded bg-purple-800 px-2.5 py-1 text-xs font-semibold text-white">{cat.name}</span>}
      <h1 className="text-2xl font-extrabold leading-snug sm:text-3xl" dangerouslySetInnerHTML={{ __html: post.title.rendered }} />
      <div className="mt-3 flex flex-wrap gap-3 text-sm text-zinc-500">
        {authorName(post) && <span>{authorName(post)}</span>}
        <time>{formatDate(post.date)}</time>
      </div>
      {img && (
        <div className="relative mt-6 aspect-[16/9] w-full overflow-hidden rounded-xl bg-zinc-100">
          <Image src={img.url} alt={img.alt} fill priority sizes="(max-width: 768px) 100vw, 768px" className="object-cover" />
        </div>
      )}
      <div
        className="prose prose-zinc mt-6 max-w-none text-justify leading-loose hyphens-auto prose-headings:text-left prose-headings:leading-snug prose-p:leading-loose prose-a:text-purple-800 prose-img:mx-auto prose-img:rounded-lg [&_iframe]:aspect-video [&_iframe]:h-auto [&_iframe]:w-full"
        dangerouslySetInnerHTML={{ __html: post.content.rendered }}
      />
    </article>
  );
}
