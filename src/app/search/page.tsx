import Link from "next/link";
import PostCard from "@/components/PostCard";
import { getPosts } from "@/lib/wordpress";

export const metadata = { title: "Search" };

export default async function SearchPage({ searchParams }: { searchParams: Promise<{ q?: string; page?: string }> }) {
  const { q = "", page: pg } = await searchParams;
  const page = Number(pg ?? 1);
  const posts = q ? await getPosts({ search: q, perPage: 12, page }).catch(() => []) : [];

  return (
    <div>
      <h1 className="mb-6 border-l-4 border-purple-800 pl-3 text-2xl font-extrabold">Search</h1>
      <form action="/search" className="mb-8 flex max-w-xl gap-2">
        <input
          type="search" name="q" defaultValue={q} placeholder="Search articles…"
          className="w-full rounded-lg border border-zinc-300 px-4 py-2 outline-none focus:border-purple-700"
        />
        <button className="rounded-lg bg-purple-800 px-5 py-2 font-medium text-white hover:bg-purple-700">Search</button>
      </form>
      {q && posts.length === 0 && <p className="text-zinc-500">No results for “{q}”.</p>}
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
