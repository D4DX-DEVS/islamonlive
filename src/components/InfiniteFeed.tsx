"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import PostCard from "@/components/PostCard";
import { Skel, SkelCard } from "@/components/Skeleton";
import { loadMorePosts } from "@/lib/actions";
import { FEED_PER_PAGE, type FeedQuery } from "@/lib/feed";
import { featuredImage, postPath, type WPPost } from "@/lib/wordpress";

type Variant = "cards" | "infographics";
type Status = "idle" | "loading" | "error" | "end";

const GRID: Record<Variant, string> = {
  cards: "grid gap-5 sm:grid-cols-2 lg:grid-cols-3",
  infographics: "grid grid-cols-2 gap-5 sm:grid-cols-3 lg:grid-cols-5",
};

/* live-site style: portrait tile + title only — no category badge, author or excerpt */
function InfographicTile({ post }: { post: WPPost }) {
  const img = featuredImage(post);
  return (
    <Link href={postPath(post)} className="group">
      <div className="relative aspect-[4/5] w-full overflow-hidden rounded-lg bg-zinc-100 shadow-sm ring-1 ring-inset ring-zinc-900/10 transition group-hover:shadow-md group-hover:ring-purple-300">
        {img && (
          <Image
            src={img.url}
            alt=""
            fill
            sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 20vw"
            className="object-cover transition group-hover:scale-105"
          />
        )}
      </div>
      <h3 className="mt-2 line-clamp-2 text-sm font-bold leading-snug group-hover:text-purple-800" dangerouslySetInnerHTML={{ __html: post.title.rendered }} />
    </Link>
  );
}

function LoadingRow({ variant }: { variant: Variant }) {
  return (
    <div className={`${GRID[variant]} mt-5`} aria-hidden>
      {variant === "cards"
        ? Array.from({ length: 3 }, (_, i) => <SkelCard key={i} excerpt />)
        : Array.from({ length: 5 }, (_, i) => (
            <div key={i}>
              <Skel className="aspect-[4/5] w-full rounded-lg" />
              <Skel className="mt-2 h-4 w-full" />
              <Skel className="mt-1.5 h-4 w-2/3" />
            </div>
          ))}
    </div>
  );
}

/* The archive lists load themselves as the reader scrolls — the first page is
   server-rendered (so it is what crawlers and a cold load see) and every page
   after it comes from the `loadMorePosts` server action. There is no Previous /
   Next: readers on phones never used them, and the same behaviour now runs on
   desktop so both read the same way. */
export default function InfiniteFeed({
  initial,
  query,
  variant = "cards",
  perPage = FEED_PER_PAGE,
  startPage = 1,
  // a short first page is already the whole archive — nothing left to fetch.
  // Search overrides it: its first page is padded with the matching author's
  // posts, so the count on its own says nothing about what is left
  hasMore = initial.length >= perPage,
}: {
  initial: WPPost[];
  query: FeedQuery;
  variant?: Variant;
  perPage?: number;
  startPage?: number;
  hasMore?: boolean;
}) {
  const [items, setItems] = useState(initial);
  const [page, setPage] = useState(startPage);
  const [status, setStatus] = useState<Status>(hasMore ? "idle" : "end");

  // one string identity for the whole query, so the load callback isn't rebuilt
  // (and the observer re-attached) on every parent render
  const queryKey = JSON.stringify(query);
  const feedQuery = useMemo(() => JSON.parse(queryKey) as FeedQuery, [queryKey]);

  // a new list under the same component — /tag/a → /tag/b, or a fresh search —
  // starts over. Adjusted during render rather than in an effect so the old
  // list never paints under the new heading
  const [lastKey, setLastKey] = useState(queryKey);
  if (lastKey !== queryKey) {
    setLastKey(queryKey);
    setItems(initial);
    setPage(startPage);
    setStatus(hasMore ? "idle" : "end");
  }

  // the observer can fire twice before the first state update lands, so the
  // in-flight guard is a ref rather than `status`
  const busy = useRef(false);
  const sentinel = useRef<HTMLDivElement | null>(null);

  const load = useCallback(async () => {
    if (busy.current) return;
    busy.current = true;
    setStatus("loading");
    try {
      const next = await loadMorePosts(feedQuery, page + 1, perPage);
      setItems((prev) => {
        // WP re-paginates as posts are published, so a page can repeat one the
        // reader already has — React would then throw on the duplicate key
        const seen = new Set(prev.map((p) => p.id));
        return [...prev, ...next.filter((p) => !seen.has(p.id))];
      });
      setPage((p) => p + 1);
      setStatus(next.length < perPage ? "end" : "idle");
    } catch {
      setStatus("error");
    } finally {
      busy.current = false;
    }
  }, [feedQuery, page, perPage]);

  useEffect(() => {
    const el = sentinel.current;
    // "error" waits for the reader to hit Retry — re-observing would spin on a
    // dead network
    if (!el || status === "end" || status === "error") return;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) void load();
      },
      // a screen's worth of runway: the next page is usually in before the
      // reader reaches the bottom of the current one
      { rootMargin: "800px 0px" }
    );
    io.observe(el);
    return () => io.disconnect();
  }, [load, status]);

  return (
    <div>
      <div className={GRID[variant]}>
        {items.map((p) => (variant === "cards" ? <PostCard key={p.id} post={p} showExcerpt /> : <InfographicTile key={p.id} post={p} />))}
      </div>

      {/* the trigger sits above the fold of the next page, not at the very end */}
      <div ref={sentinel} aria-hidden className="h-px w-full" />

      {status === "loading" && <LoadingRow variant={variant} />}

      <div role="status" aria-live="polite" className="mt-8 flex justify-center">
        {status === "loading" && <span className="sr-only">Loading more posts</span>}

        {status === "error" && (
          <div className="flex flex-col items-center gap-3 text-center">
            <p className="text-sm text-zinc-500">Couldn&apos;t load more posts.</p>
            <button
              type="button"
              onClick={() => void load()}
              className="pill min-h-11 touch-manipulation rounded-full bg-[#693FE2] px-6 text-sm font-semibold text-white transition active:scale-[0.98] active:bg-[#5a34c7] hover:bg-[#5a34c7]"
            >
              Try again
            </button>
          </div>
        )}

        {status === "end" && items.length > 0 && (
          <p className="pill flex items-center gap-3 text-[11px] font-semibold uppercase tracking-[0.14em] text-zinc-400">
            <span aria-hidden className="h-px w-10 bg-zinc-200" />
            End of archive
            <span aria-hidden className="h-px w-10 bg-zinc-200" />
          </p>
        )}
      </div>
    </div>
  );
}
