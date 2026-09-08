import Image from "next/image";
import Link from "next/link";
import { notFound, permanentRedirect } from "next/navigation";
import JsonLd from "@/components/JsonLd";
import { siteUrl } from "@/lib/env";
import { pagePath, splitPage } from "@/lib/paging";
import { breadcrumbSchema, collectionPageSchema, graph, siteNodes } from "@/lib/schema";
import { getUsersPage, stripHtml, userAvatar } from "@/lib/wordpress";

export const revalidate = 3600;

/* /authors-list/ and /authors-list/page/N/ — the writers' directory.

   The WordPress page of that name is a JetEngine listing widget, which the
   REST API hands over as an empty body, so the generic page route had nothing
   to render and an indexed, linked URL 404'd. This is the same directory built
   from the users endpoint: everyone with a published post, A→Z, sixty a page.

   The page number is read from the path, like the archives (lib/paging.ts):
   a route that reads searchParams is rendered on every request, one that
   reads params alone is cached and revalidated like a static page.

   No loading.tsx here on purpose — a page number past the end must answer a
   real 404, and a Suspense fallback would lock the status at 200. */

const PER_PAGE = 60;
const BASE = "/authors-list/";

// no entries: rendered on first request, then cached like a static page
export function generateStaticParams(): { page: string[] }[] {
  return [];
}

type Props = { params: Promise<{ page?: string[] }> };

/* /authors-list/ has no other children, so anything but /page/N/ under it is
   not an address. An explicit /page/1/ is 301'd by next.config before it gets
   here; the redirect below is the backstop (see category/[...slug]/page.tsx). */
function resolve(all: string[] | undefined) {
  const { segments, page, explicit } = splitPage(all ?? []);
  if (segments.length !== 0) notFound();
  return { page, redirectTo: explicit && page === 1 ? BASE : null };
}

export async function generateMetadata({ params }: Props) {
  const { page } = resolve((await params).page);
  return {
    title: page > 1 ? `Authors - Page ${page}` : "Authors",
    description: "Every writer published on Islamonlive, A to Z.",
    // each page is self-canonical, the same way the archive pages are
    alternates: { canonical: pagePath(BASE, page) },
  };
}

function PersonIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden className="h-7 w-7">
      <path d="M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm0 1.8c-3.2 0-7 1.7-7 3.9V20h14v-2.3c0-2.2-3.8-3.9-7-3.9Z" />
    </svg>
  );
}

const PILL = "pill inline-flex min-h-11 items-center rounded-full px-5 text-sm font-semibold transition";

export default async function AuthorsListPage({ params }: Props) {
  const { page, redirectTo } = resolve((await params).page);
  if (redirectTo) permanentRedirect(redirectTo);

  const { items, total, totalPages } = await getUsersPage(page, PER_PAGE);
  // past the last page WP answers 400, which the client folds into an empty
  // list — and an empty page is not a page
  if (items.length === 0) notFound();

  const url = siteUrl(pagePath(BASE, page));

  return (
    <div className="mx-auto max-w-5xl">
      <JsonLd
        data={graph(
          collectionPageSchema(url, "Authors", "Every writer published on Islamonlive, A to Z."),
          breadcrumbSchema([{ name: "Home", path: "/" }, { name: "Authors" }], url),
          ...siteNodes()
        )}
      />
      <nav aria-label="Breadcrumb" className="mb-3 hidden text-xs text-zinc-500 sm:block">
        <Link href="/" className="hover:text-purple-800">Home</Link>
        <span className="px-1.5">/</span>
        <span className="text-zinc-700">Authors</span>
        {page > 1 && <span className="text-zinc-400"> · page {page}</span>}
      </nav>
      <h1 className="text-3xl font-extrabold">Authors</h1>
      <p className="mb-6 mt-1 text-sm text-zinc-500">
        {total} writers · page {page} of {totalPages}
      </p>

      <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {items.map((u) => {
          const avatar = userAvatar(u);
          const bio = u.description ? stripHtml(u.description) : "";
          return (
            <li key={u.id}>
              <Link
                href={`/author/${u.slug}/`}
                className="flex h-full items-center gap-4 rounded-2xl bg-white p-4 shadow-sm ring-1 ring-black/5 transition hover:shadow-md hover:ring-purple-300"
              >
                {avatar ? (
                  <Image src={avatar} alt="" width={56} height={56} unoptimized className="h-14 w-14 shrink-0 rounded-full object-cover ring-1 ring-black/10" />
                ) : (
                  <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-zinc-200 text-zinc-500">
                    <PersonIcon />
                  </span>
                )}
                <span className="min-w-0">
                  <span className="block font-bold text-zinc-900 [overflow-wrap:anywhere]">{u.name}</span>
                  {bio && <span className="mt-0.5 line-clamp-2 text-xs leading-relaxed text-zinc-500">{bio}</span>}
                </span>
              </Link>
            </li>
          );
        })}
      </ul>

      <nav aria-label="Pagination" className="mt-8 flex items-center justify-between gap-3">
        {page > 1 ? (
          <Link rel="prev" href={pagePath(BASE, page - 1)} className={`${PILL} bg-white text-purple-800 ring-1 ring-purple-300 hover:bg-purple-50`}>
            ← Previous
          </Link>
        ) : (
          <span />
        )}
        <span className="text-sm text-zinc-500">
          {page} / {totalPages}
        </span>
        {page < totalPages ? (
          <Link rel="next" href={pagePath(BASE, page + 1)} className={`${PILL} bg-[#693FE2] text-white hover:bg-[#5a34c7]`}>
            Next →
          </Link>
        ) : (
          <span />
        )}
      </nav>
    </div>
  );
}
