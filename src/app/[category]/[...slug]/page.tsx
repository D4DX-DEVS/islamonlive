import { notFound } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { getPostBySlug, getPosts, featuredImage, author, authorName, primaryCategory, formatDate, stripHtml, postPath, WPPost } from "@/lib/wordpress";
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
  // share this site's own URL, not the WP backend permalink
  const shareUrl = new URL(postPath(post), "https://islamonlive.in").href;

  // infographics get the live-site split layout: content column + sticky banner
  const isInfographic = post._embedded?.["wp:term"]?.flat().some((t) => t.taxonomy === "category" && t.slug === "infographics") ?? false;

  if (isInfographic) {
    // side-by-side from sm up: left = sticky title/meta + featured image,
    // right = scrolling infographic content. Phones get the content alone at full
    // width — the artwork already carries the title, and a half-width column
    // rendered the infographic text too small to read
    return (
      <div className="mx-auto grid max-w-[1300px] grid-cols-1 items-start gap-4 sm:grid-cols-2 sm:gap-6 lg:gap-8">
        {/* min-w-0: WP figures carry inline width:750px — without it the grid track
            grows to fit and the whole page overflows the phone viewport */}
        <div className="sticky top-2 hidden min-w-0 sm:block lg:top-24">
          {cat && <span className="mb-3 pill inline-flex items-center justify-center rounded bg-purple-800 px-2 py-1 text-[10px] font-semibold text-white sm:mb-4 sm:px-3 sm:py-1.5 sm:text-xs">{cat.name}</span>}
          <h1 className="border-b-2 border-purple-800 pb-3 text-base font-extrabold leading-snug sm:pb-4 sm:text-2xl lg:text-3xl" dangerouslySetInnerHTML={{ __html: post.title.rendered }} />
          <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-zinc-600 sm:mt-4 sm:gap-3 sm:text-sm">
            {authorName(post) && <span className="font-medium">{authorName(post)}</span>}
            <time className="border-l border-zinc-300 pl-3">{formatDate(post.date)}</time>
            <span className="ml-auto">
              <ShareRow url={shareUrl} title={stripHtml(post.title.rendered)} />
            </span>
          </div>
          {img && (
            <div className="mt-4 w-full overflow-hidden rounded-xl bg-zinc-100 ring-1 ring-zinc-200 sm:mt-6 sm:rounded-2xl">
              {/* unoptimized: infographic text goes soft through the optimizer's downscale */}
              <Image src={img.url} alt={img.alt} width={1080} height={1350} priority unoptimized className="h-auto w-full" />
            </div>
          )}
        </div>
        {/* right: scrolling content */}
        <div
          className="prose prose-zinc min-w-0 max-w-none text-sm leading-relaxed prose-a:text-purple-800 prose-img:rounded-lg break-words sm:text-base [&_*]:max-w-full [&_img]:h-auto [&_iframe]:aspect-video [&_iframe]:h-auto [&_iframe]:w-full [&_table]:block [&_table]:overflow-x-auto"
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
    <article className="rounded-2xl bg-white p-5 shadow-[0_4px_24px_rgba(0,0,0,0.08)] sm:p-8 lg:p-10">
      {cat && <span className="mb-3 pill inline-flex items-center justify-center rounded bg-purple-800 px-3 py-1.5 text-xs font-semibold text-white">{cat.name}</span>}
      <h1 className="text-[22px] font-extrabold leading-snug sm:text-3xl" dangerouslySetInnerHTML={{ __html: post.title.rendered }} />
      {/* phones: author · date on one line, share row on its own line below */}
      <div className="mt-3 flex flex-col gap-3 text-sm text-zinc-500 sm:flex-row sm:flex-wrap sm:items-center">
        <span className="flex min-w-0 items-center gap-2">
          {authorName(post) && (
            <>
              <span className="truncate font-medium text-zinc-700">{authorName(post)}</span>
              <span aria-hidden>·</span>
            </>
          )}
          <time className="shrink-0">{formatDate(post.date)}</time>
        </span>
        <span className="sm:ml-auto">
          <ShareRow url={shareUrl} title={stripHtml(post.title.rendered)} />
        </span>
      </div>
      {img && (
        <div className="relative mt-6 aspect-[16/9] w-full overflow-hidden rounded-xl bg-zinc-100">
          <Image src={img.url} alt={img.alt} fill priority sizes="(max-width: 1100px) 100vw, 1100px" className="object-cover" />
        </div>
      )}
      <div
        className="prose prose-zinc mt-6 max-w-none leading-relaxed sm:text-justify sm:hyphens-auto prose-headings:text-left prose-headings:leading-snug prose-p:leading-relaxed prose-a:text-purple-800 prose-img:mx-auto prose-img:rounded-lg [&_iframe]:aspect-video [&_iframe]:h-auto [&_iframe]:w-full break-words [&_*]:max-w-full [&_img]:h-auto [&_table]:block [&_table]:overflow-x-auto"
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
