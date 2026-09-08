import Link from "next/link";
import { notFound, permanentRedirect } from "next/navigation";
import Image from "next/image";
import InfiniteFeed from "@/components/InfiniteFeed";
import JsonLd from "@/components/JsonLd";
import { FEED_PER_PAGE } from "@/lib/feed";
import { getUserBySlug, getPostsPage, userAvatar, stripHtml } from "@/lib/wordpress";
import { seoMetadata, seoSchema } from "@/lib/seo";
import { breadcrumbSchema, graph, siteNodes, SITE_ID } from "@/lib/schema";
import { siteUrl } from "@/lib/env";
import { pagePath, splitPage } from "@/lib/paging";

export const revalidate = 60;

// no entries: rendered on first request, then cached like a static page
export function generateStaticParams(): { slug: string[] }[] {
  return [];
}

/* The redirect is decided here and thrown by the page; generateMetadata only
   404s. There is no loading.tsx on this route, so nothing is flushed before
   the page's throw sets the status, and the metadata computed for a
   redirected request is simply discarded. Known and accepted: on the first,
   uncached answer Next 16.3 replays the render's headers with appendHeader
   (next-server.js), so that one response carries the same Location twice —
   identical values, which browsers and Googlebot accept; cached answers carry
   it once. An explicit /page/1/ never gets here: next.config 301s it. */
/* /author/{slug}/ and /author/{slug}/page/N/ — the catch-all exists only so the
   page number can be read from the path (see lib/paging.ts). */
async function resolve(all: string[]) {
  const { segments, page, explicit } = splitPage(all);
  if (segments.length !== 1) notFound();
  const slug = segments[0];
  const user = await getUserBySlug(slug);
  if (!user) notFound();
  const path = `/author/${slug}/`;
  return { user, page, path, redirectTo: explicit && page === 1 ? path : null };
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string[] }> }) {
  const { user, page, path } = await resolve((await params).slug);
  return seoMetadata(user.yoast_head_json, {
    path,
    title: user.name,
    description: user.description ? stripHtml(user.description) : `Articles by ${user.name} on Islamonlive.`,
    image: userAvatar(user),
    type: "website",
    page,
  });
}

/* The writer's page: photo, name, bio, then everything they wrote. The live
   site heads its author archive with the same three things (the Elementor
   author box) above a JetEngine listing of the posts. */
export default async function AuthorPage({ params }: { params: Promise<{ slug: string[] }> }) {
  const { user, page, path, redirectTo } = await resolve((await params).slug);
  if (redirectTo) permanentRedirect(redirectTo);

  const { items: posts, totalPages } = await getPostsPage({ author: user.id, perPage: FEED_PER_PAGE, page });
  // an archive with nothing in it is a 404 — WordPress answers the same way, and
  // a 200 carrying an empty list is a soft 404 in Search Console
  if (posts.length === 0) notFound();

  const avatar = userAvatar(user);
  // WP hands the bio back as HTML (paragraphs, <br>, the odd inline style)
  const bio = user.description?.trim() ?? "";
  const url = siteUrl(pagePath(path, page));
  const personId = `${siteUrl(path)}#person`;

  /* ProfilePage + Person rather than CollectionPage: this is the page Google
     reads to work out who wrote the articles, and the author E-E-A-T signal
     depends on the Person node resolving to the same @id the articles cite. */
  const jsonLd =
    seoSchema(user.yoast_head_json) ??
    graph(
      {
        "@type": "ProfilePage",
        "@id": url,
        url,
        name: user.name,
        isPartOf: { "@id": SITE_ID },
        inLanguage: "ml",
        mainEntity: { "@id": personId },
      },
      {
        "@type": "Person",
        "@id": personId,
        name: user.name,
        url: siteUrl(path),
        mainEntityOfPage: { "@id": url },
        ...(bio ? { description: stripHtml(bio) } : {}),
        ...(avatar ? { image: avatar } : {}),
      },
      breadcrumbSchema([{ name: "Home", path: "/" }, { name: "Authors", path: "/authors-list/" }, { name: user.name }], url),
      ...siteNodes()
    );

  return (
    <div>
      <JsonLd data={jsonLd} />
      <nav aria-label="Breadcrumb" className="mb-3 hidden text-xs text-zinc-500 sm:block">
        <Link href="/" className="hover:text-purple-800">Home</Link>
        <span className="px-1.5">/</span>
        <Link href="/authors-list/" className="hover:text-purple-800">Authors</Link>
        <span className="px-1.5">/</span>
        <span className="text-zinc-700">{user.name}</span>
        {page > 1 && <span className="text-zinc-400"> · page {page}</span>}
      </nav>
      <section className="mb-8 overflow-hidden rounded-2xl bg-white shadow-[0_4px_24px_rgba(0,0,0,0.06)] ring-1 ring-black/5">
        <div className="h-20 bg-gradient-to-r from-[#31094C] via-[#4A1E9E] to-[#693FE2] sm:h-24" />
        <div className="px-5 pb-6 sm:px-8">
          <div className="-mt-12 flex flex-col items-center text-center sm:-mt-14 sm:flex-row sm:items-end sm:gap-5 sm:text-left">
            {avatar ? (
              <Image
                src={avatar}
                alt=""
                width={144}
                height={144}
                unoptimized
                className="h-24 w-24 shrink-0 rounded-full object-cover ring-4 ring-white shadow-md sm:h-28 sm:w-28"
              />
            ) : (
              <span className="flex h-24 w-24 shrink-0 items-center justify-center rounded-full bg-zinc-200 text-zinc-500 ring-4 ring-white shadow-md sm:h-28 sm:w-28">
                <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden className="h-12 w-12">
                  <path d="M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm0 1.8c-3.2 0-7 1.7-7 3.9V20h14v-2.3c0-2.2-3.8-3.9-7-3.9Z" />
                </svg>
              </span>
            )}
            <div className="mt-3 min-w-0 sm:mt-0 sm:pb-1">
              <p className="pill text-[11px] font-semibold uppercase tracking-[0.14em] text-[#693FE2]">Author</p>
              <h1 className="mt-1 text-2xl font-extrabold leading-tight text-zinc-900 [overflow-wrap:anywhere] sm:text-3xl">{user.name}</h1>
            </div>
          </div>
          {bio && (
            <div
              className="prose prose-sm prose-zinc mt-4 max-w-3xl leading-relaxed text-zinc-600 [&_p]:my-1.5 [&_*]:!text-left"
              dangerouslySetInnerHTML={{ __html: bio }}
            />
          )}
        </div>
      </section>

      <h2 className="mb-4 border-l-4 border-purple-800 pl-3 text-xl font-extrabold">
        Articles by {user.name}
        {page > 1 && <span className="ml-2 text-base font-semibold text-zinc-500"> page {page} of {totalPages}</span>}
      </h2>
      <InfiniteFeed initial={posts} query={{ kind: "author", id: user.id }} startPage={page} hasMore={page < totalPages} base={path} totalPages={totalPages} />
    </div>
  );
}
