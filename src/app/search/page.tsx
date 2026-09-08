import Link from "next/link";
import InfiniteFeed from "@/components/InfiniteFeed";
import SearchBox from "@/components/SearchBox";
import { FEED_PER_PAGE } from "@/lib/feed";
import { normalizeSearch, searchPosts } from "@/lib/search";
import { getPosts, searchUsers } from "@/lib/wordpress";

/* Search results are noindex,follow.

   Every query string would otherwise be its own indexable URL — an unbounded
   set of thin, near-duplicate pages, which is the classic way a large archive
   dilutes its own crawl budget. `follow` still lets Googlebot walk through to
   the articles themselves, which are the pages we want ranked. The canonical
   points at the bare /search/ so any that do get fetched consolidate there. */
type Props = { searchParams: Promise<{ q?: string; page?: string }> };

export async function generateMetadata({ searchParams }: Props) {
  const q = normalizeSearch((await searchParams).q ?? "");
  return {
    title: q ? `Search: ${q}` : "Search",
    robots: { index: false, follow: true },
    alternates: { canonical: "/search/" },
  };
}

// routes this app owns — never a guessed category slug that could itself 404
const SECTIONS = [
  { href: "/", label: "Front page" },
  { href: "/authors-list/", label: "Authors" },
  { href: "/watch-videos/", label: "Videos" },
  { href: "/listen/", label: "Listen" },
];

/* Page 1 with nothing, or a page number past the end of the results: this
   route has a loading.tsx, so a notFound() thrown here would only ever paint
   the 404 page under a 200 — an honest "nothing here" with a way back is the
   truthful answer, and the route is noindex anyway. */
function NoResults({ q, page }: { q: string; page: number }) {
  const past = page > 1;
  return (
    <div className="mx-auto max-w-lg rounded-2xl border border-dashed border-zinc-300 bg-white/60 px-6 py-10 text-center">
      <h2 className="text-[17px] font-bold text-zinc-800">{past ? `Nothing more for “${q}”` : `No results for “${q}”`}</h2>
      <p className="mx-auto mt-2 max-w-sm text-sm leading-relaxed text-zinc-500">
        {past ? `Page ${page} is past the end of these results.` : "Check the spelling, try fewer or different words, or start from one of these."}
      </p>
      <div className="mt-5 flex flex-wrap items-center justify-center gap-2 text-sm">
        {past && (
          <Link href={`/search/?q=${encodeURIComponent(q)}`} className="pill rounded-full bg-[#693FE2] px-4 py-2 font-semibold text-white hover:bg-[#5a34c7]">
            First page of results
          </Link>
        )}
        {SECTIONS.map((s) => (
          <Link key={s.href} href={s.href} className="pill rounded-full bg-white px-4 py-2 font-semibold text-purple-800 ring-1 ring-purple-200 hover:bg-purple-50">
            {s.label}
          </Link>
        ))}
      </div>
    </div>
  );
}

export default async function SearchPage({ searchParams }: Props) {
  const { q: raw = "", page: pg } = await searchParams;
  const q = normalizeSearch(raw);
  const page = Math.max(1, Number(pg ?? 1) || 1);

  // GPT-style: empty query = centred hero with chips, results appear under the box
  if (!q) {
    return (
      <div className="flex min-h-[55vh] flex-col items-center justify-center px-2 text-center">
        <h1 className="text-2xl font-extrabold sm:text-3xl">What do you want to read?</h1>
        <p className="mt-2 text-sm text-zinc-500">Search articles, topics and authors across Islamonlive</p>
        <div className="mt-6 w-full">
          <SearchBox />
        </div>
      </div>
    );
  }

  // ponytail: author posts merged on page 1 only; paginated pages stay pure text search
  const [text, users] = await Promise.all([
    searchPosts(q, page, FEED_PER_PAGE),
    page === 1 ? searchUsers(q).catch(() => []) : Promise.resolve([]),
  ]);
  const author = users[0];
  const authorPosts = author ? await getPosts({ author: author.id, perPage: FEED_PER_PAGE }).catch(() => []) : [];
  const seen = new Set<number>();
  const posts = [...authorPosts, ...text.items].filter((p) => !seen.has(p.id) && seen.add(p.id));

  return (
    <div>
      <div className="mb-6">
        <SearchBox initialQ={q} />
      </div>
      <h1 className="mb-1 text-xl font-extrabold [overflow-wrap:anywhere]">Search: “{q}”</h1>
      {posts.length === 0 ? (
        <NoResults q={q} page={page} />
      ) : (
        <>
          {/* the count is the text search's X-WP-Total; the author block on page 1
              is an extra on top of it, not part of it */}
          <p className="mb-5 text-sm text-zinc-500" aria-live="polite">
            {author && (
              <>
                Articles by{" "}
                <Link href={`/author/${author.slug}/`} className="font-semibold text-purple-800 hover:underline">
                  {author.name}
                </Link>
                {text.total > 0 ? ", then " : "."}
              </>
            )}
            {text.total > 0 && (
              <>
                {text.total.toLocaleString("en-IN")} {text.total === 1 ? "article matches" : "articles match"} “{q}”
                {page > 1 && ` · page ${page} of ${text.totalPages}`}
              </>
            )}
          </p>
          <InfiniteFeed
            // the author block only pads page 1, so whether more exists is decided by
            // the text search alone
            initial={posts}
            query={{ kind: "search", q }}
            startPage={page}
            hasMore={page < text.totalPages}
          />
        </>
      )}
    </div>
  );
}
