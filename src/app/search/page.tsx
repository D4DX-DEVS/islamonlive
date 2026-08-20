import Link from "next/link";
import PostCard from "@/components/PostCard";
import SearchBox from "@/components/SearchBox";
import { getPosts, searchUsers } from "@/lib/wordpress";

export const metadata = { title: "Search" };

export default async function SearchPage({ searchParams }: { searchParams: Promise<{ q?: string; page?: string }> }) {
  const { q = "", page: pg } = await searchParams;
  const page = Number(pg ?? 1);
  // ponytail: author posts merged on page 1 only; paginated pages stay pure text search
  const [textPosts, users] = q
    ? await Promise.all([
        getPosts({ search: q, perPage: 12, page }).catch(() => []),
        page === 1 ? searchUsers(q).catch(() => []) : Promise.resolve([]),
      ])
    : [[], []];
  const authorPosts = users[0] ? await getPosts({ author: users[0].id, perPage: 12 }).catch(() => []) : [];
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
      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {posts.map((p) => <PostCard key={p.id} post={p} showExcerpt />)}
      </div>
      {posts.length === 12 && (
        <div className="mt-8 flex justify-center">
          <Link href={`/search?q=${encodeURIComponent(q)}&page=${page + 1}`} className="rounded bg-purple-800 px-4 py-2 text-sm font-medium text-white">Next →</Link>
        </div>
      )}
    </div>
  );
}
