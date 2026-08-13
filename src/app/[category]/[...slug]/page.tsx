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

  // infographics get the live-site split layout: content column + sticky banner
  const isInfographic = post._embedded?.["wp:term"]?.flat().some((t) => t.taxonomy === "category" && t.slug === "infographics") ?? false;

  if (isInfographic) {
    // live-site layout: left = sticky heading block + banner image, right = scrolling content
    const shareUrl = encodeURIComponent(post.link);
    const shareTitle = encodeURIComponent(stripHtml(post.title.rendered));
    return (
      <div className="mx-auto grid max-w-[1300px] items-start gap-8 lg:grid-cols-2">
        <div className="lg:sticky lg:top-24">
          {cat && <span className="mb-4 inline-block rounded bg-purple-800 px-2.5 py-1 text-xs font-semibold text-white">{cat.name}</span>}
          <h1 className="border-b-2 border-purple-800 pb-4 text-2xl font-extrabold leading-snug sm:text-3xl" dangerouslySetInnerHTML={{ __html: post.title.rendered }} />
          <div className="mt-4 flex flex-wrap items-center gap-3 text-sm text-zinc-600">
            {authorName(post) && <span className="font-medium">{authorName(post)}</span>}
            <time className="border-l border-zinc-300 pl-3">{formatDate(post.date)}</time>
            <span className="ml-auto flex gap-2">
              {[
                { href: `https://www.facebook.com/sharer/sharer.php?u=${shareUrl}`, label: "Share on Facebook", d: "M13.5 9H15V6.5h-1.5c-1.933 0-3.5 1.567-3.5 3.5v1.5H8v2.5h2V19h2.5v-5H15l.5-2.5h-3V10a1 1 0 0 1 1-1Z" },
                { href: `https://twitter.com/intent/tweet?url=${shareUrl}&text=${shareTitle}`, label: "Share on X", d: "M8 7l3.13 4.44L8.2 15h1.4l2.2-2.77L13.75 15H16l-3.25-4.6L15.6 7h-1.4l-2.05 2.58L10.25 7H8Z" },
                { href: `https://api.whatsapp.com/send?text=${shareTitle}%20${shareUrl}`, label: "Share on WhatsApp", d: "M12 6.5A5.5 5.5 0 0 0 6.5 12c0 .97.25 1.88.69 2.67L6.5 17.5l2.9-.66A5.5 5.5 0 1 0 12 6.5Zm2.6 7.34c-.11.31-.64.6-.89.62-.24.02-.47.11-1.55-.32-1.31-.52-2.15-1.85-2.21-1.94-.06-.09-.53-.7-.53-1.34 0-.63.33-.94.45-1.07a.47.47 0 0 1 .34-.16l.24.01c.08 0 .18-.03.28.21l.39.94c.03.07.05.14.01.23l-.15.23-.22.26c-.07.07-.14.15-.06.29.08.14.36.6.78.97.54.48.99.63 1.13.7.14.07.22.06.3-.03l.46-.53c.1-.14.19-.11.32-.06l1.02.48c.13.07.22.1.25.16.03.06.03.34-.08.65Z" },
                { href: `mailto:?subject=${shareTitle}&body=${shareUrl}`, label: "Share by email", d: "M6.5 8A1.5 1.5 0 0 1 8 6.5h8A1.5 1.5 0 0 1 17.5 8v8a1.5 1.5 0 0 1-1.5 1.5H8A1.5 1.5 0 0 1 6.5 16V8Zm1.7.5 3.8 3 3.8-3H8.2Zm7.8 1.2-3.5 2.77a.75.75 0 0 1-.93 0L8 9.7V16h8V9.7Z" },
              ].map((s) => (
                <a key={s.label} href={s.href} target="_blank" rel="noopener noreferrer" aria-label={s.label} className="rounded-full bg-zinc-100 p-1.5 text-zinc-600 transition hover:bg-purple-800 hover:text-white">
                  <svg viewBox="0 0 24 24" fill="currentColor" className="h-5 w-5"><path d={s.d} /></svg>
                </a>
              ))}
            </span>
          </div>
          {img && (
            <div className="mt-6 w-full overflow-hidden rounded-2xl bg-zinc-100 ring-1 ring-zinc-200">
              {/* unoptimized: infographic text goes soft through the optimizer's downscale */}
              <Image src={img.url} alt={img.alt} width={1080} height={1350} priority unoptimized className="h-auto w-full" />
            </div>
          )}
        </div>
        {/* right: scrolling content */}
        <div
          className="prose prose-zinc max-w-none leading-loose prose-a:text-purple-800 prose-img:rounded-lg break-words [&_*]:max-w-full [&_img]:h-auto"
          dangerouslySetInnerHTML={{ __html: post.content.rendered }}
        />
      </div>
    );
  }

  return (
    <article className="mx-auto max-w-[1100px] rounded-2xl bg-white p-5 shadow-sm ring-1 ring-zinc-200 sm:p-8 lg:p-10">
      {cat && <span className="mb-3 inline-block rounded bg-purple-800 px-2.5 py-1 text-xs font-semibold text-white">{cat.name}</span>}
      <h1 className="text-2xl font-extrabold leading-snug sm:text-3xl" dangerouslySetInnerHTML={{ __html: post.title.rendered }} />
      <div className="mt-3 flex flex-wrap gap-3 text-sm text-zinc-500">
        {authorName(post) && <span>{authorName(post)}</span>}
        <time>{formatDate(post.date)}</time>
      </div>
      {img && (
        <div className="relative mt-6 aspect-[16/9] w-full overflow-hidden rounded-xl bg-zinc-100">
          <Image src={img.url} alt={img.alt} fill priority sizes="(max-width: 1100px) 100vw, 1100px" className="object-cover" />
        </div>
      )}
      <div
        className="prose prose-zinc mt-6 max-w-none text-justify leading-loose hyphens-auto prose-headings:text-left prose-headings:leading-snug prose-p:leading-loose prose-a:text-purple-800 prose-img:mx-auto prose-img:rounded-lg [&_iframe]:aspect-video [&_iframe]:h-auto [&_iframe]:w-full break-words [&_*]:max-w-full [&_img]:h-auto [&_table]:block [&_table]:overflow-x-auto"
        dangerouslySetInnerHTML={{ __html: post.content.rendered }}
      />
    </article>
  );
}
