import Link from "next/link";
import ReelsLightbox from "@/components/ReelsLightbox";
import WatchSwitch from "@/components/WatchSwitch";
import { getReels } from "@/lib/instagram";
import { getShorts } from "@/lib/youtube";

export const revalidate = 1800;
export const metadata = { title: "Reels" };

const PER_PAGE = 24;

export default async function ReelsPage({ searchParams }: { searchParams: Promise<{ page?: string }> }) {
  const { page: pg } = await searchParams;
  const page = Math.max(1, Number(pg ?? 1) || 1);

  // same source as the homepage strip: Instagram feed (sorted newest first), shorts fallback.
  // fetch one extra to know whether a next page exists
  const reels = await getReels(page * PER_PAGE + 1).catch(() => []);
  const all = reels.length ? reels : await getShorts(page * PER_PAGE + 1).catch(() => []);
  const items = all.slice((page - 1) * PER_PAGE, page * PER_PAGE);
  const hasNext = all.length > page * PER_PAGE;

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-center gap-3 md:justify-between">
        <h1 className="sr-only border-l-4 border-purple-800 pl-3 text-2xl font-extrabold md:not-sr-only">Reels</h1>
        <WatchSwitch />
      </div>
      {items.length === 0 ? (
        <p className="text-zinc-500">{page > 1 ? "No more reels." : "Reels unavailable right now."}</p>
      ) : (
        <ReelsLightbox items={items} grid />
      )}
      {(page > 1 || hasNext) && (
        <div className="mt-8 flex items-center justify-center gap-4 text-sm font-medium">
          {page > 1 && (
            <Link href={`/reels?page=${page - 1}`} className="rounded bg-purple-800 px-4 py-2 text-white hover:bg-purple-700">← Prev</Link>
          )}
          <span className="text-zinc-500">Page {page}</span>
          {hasNext && (
            <Link href={`/reels?page=${page + 1}`} className="rounded bg-purple-800 px-4 py-2 text-white hover:bg-purple-700">Next →</Link>
          )}
        </div>
      )}
    </div>
  );
}
