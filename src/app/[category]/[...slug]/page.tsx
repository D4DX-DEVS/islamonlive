import { notFound } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { getPostBySlug, getPosts, featuredImage, author, authorName, primaryCategory, formatDate, stripHtml, WPPost } from "@/lib/wordpress";
import PostCard from "@/components/PostCard";
import ShareRow from "@/components/ShareRow";

export const revalidate = 60;

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
    return (
      <div className="mx-auto grid max-w-[1300px] items-start gap-8 lg:grid-cols-2">
        <div className="lg:sticky lg:top-24">
          {cat && <span className="mb-4 pill inline-flex items-center justify-center rounded bg-purple-800 px-3 py-1.5 text-xs font-semibold text-white">{cat.name}</span>}
          <h1 className="border-b-2 border-purple-800 pb-4 text-2xl font-extrabold leading-snug sm:text-3xl" dangerouslySetInnerHTML={{ __html: post.title.rendered }} />
          <div className="mt-4 flex flex-wrap items-center gap-3 text-sm text-zinc-600">
            {authorName(post) && <span className="font-medium">{authorName(post)}</span>}
            <time className="border-l border-zinc-300 pl-3">{formatDate(post.date)}</time>
            <span className="ml-auto">
              <ShareRow url={post.link} title={stripHtml(post.title.rendered)} />
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

  const a = author(post);
  // same-category reads, minus this post. A dead related-posts call must not 500 the article.
  const related: WPPost[] = post.categories?.[0]
    ? (await getPosts({ categories: [post.categories[0]], perPage: 5 }).catch(() => []))
        .filter((p) => p.id !== post.id)
        .slice(0, 4)
    : [];

  return (
    <div className="mx-auto max-w-[1100px]">
    <article className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-zinc-200 sm:p-8 lg:p-10">
      {cat && <span className="mb-3 pill inline-flex items-center justify-center rounded bg-purple-800 px-3 py-1.5 text-xs font-semibold text-white">{cat.name}</span>}
      <h1 className="text-2xl font-extrabold leading-snug sm:text-3xl" dangerouslySetInnerHTML={{ __html: post.title.rendered }} />
      <div className="mt-3 flex flex-wrap items-center gap-3 text-sm text-zinc-500">
        {authorName(post) && <span>{authorName(post)}</span>}
        <time>{formatDate(post.date)}</time>
        <span className="ml-auto">
          <ShareRow url={post.link} title={stripHtml(post.title.rendered)} />
        </span>
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

      {a && (
        <div className="mt-10 flex items-center gap-4 rounded-xl border border-zinc-200 p-5 print:hidden">
          {a.avatar ? (
            <Image src={a.avatar} alt="" width={72} height={72} unoptimized className="h-16 w-16 shrink-0 rounded-full object-cover ring-1 ring-black/10" />
          ) : (
            <span className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-zinc-200 text-zinc-500">
              <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden className="h-9 w-9">
                <path d="M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm0 1.8c-3.2 0-7 1.7-7 3.9V20h14v-2.3c0-2.2-3.8-3.9-7-3.9Z" />
              </svg>
            </span>
          )}
          <div>
            <p className="text-lg font-bold text-zinc-800">{a.name}</p>
            {a.slug && (
              <Link href={`/author/${a.slug}`} className="pill mt-2 inline-block rounded bg-purple-800 px-4 py-2 text-xs font-semibold text-white hover:bg-purple-700">
                View Other Articles
              </Link>
            )}
          </div>
        </div>
      )}
    </article>

    {related.length > 0 && (
      <section className="mt-10 print:hidden">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-xl font-extrabold text-zinc-900">Related Articles</h2>
          {cat && <Link href={`/category/${cat.slug}`} className="text-sm font-semibold text-purple-800 hover:underline">See all →</Link>}
        </div>
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {related.map((p) => <PostCard key={p.id} post={p} />)}
        </div>
      </section>
    )}
    </div>
  );
}
