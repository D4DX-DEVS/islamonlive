import InfiniteFeed from "@/components/InfiniteFeed";
import SearchBox from "@/components/SearchBox";
import { FEED_PER_PAGE } from "@/lib/feed";
import { getPosts, searchUsers } from "@/lib/wordpress";

export const metadata = { title: "Search" };

export default async function SearchPage({ searchParams }: { searchParams: Promise<{ q?: string; page?: string }> }) {
  const { q = "", page: pg } = await searchParams;
  const page = Math.max(1, Number(pg ?? 1) || 1);
  // ponytail: author posts merged on page 1 only; paginated pages stay pure text search
  const [textPosts, users] = q
    ? await Promise.all([
        getPosts({ search: q, perPage: FEED_PER_PAGE, page }).catch(() => []),
        page === 1 ? searchUsers(q).catch(() => []) : Promise.resolve([]),
      ])
    : [[], []];
  const authorPosts = users[0] ? await getPosts({ author: users[0].id, perPage: FEED_PER_PAGE }).catch(() => []) : [];
  const seen = new Set<number>();
  const posts = [...authorPosts, ...textPosts].filter((p) => !seen.has(p.id) && seen.add(p.id));

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

  return (
    <div>
      <div className="mb-8">
        <SearchBox initialQ={q} />
      </div>
      {posts.length === 0 && <p className="text-center text-zinc-500">No results for “{q}”.</p>}
      <InfiniteFeed
        // the author block only pads page 1, so whether more exists is decided by
        // the text search alone
        initial={posts}
        query={{ kind: "search", q }}
        startPage={page}
        hasMore={textPosts.length >= FEED_PER_PAGE}
      />
    </div>
  );
}
