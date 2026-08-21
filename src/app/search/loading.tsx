import { Skel, SkelCardGrid } from "@/components/Skeleton";

/* mirrors the real <SearchBox> — rounded field, purple submit chip — so the swap
   from box to skeleton doesn't read as the page losing its search bar */
export default function Loading() {
  return (
    <div>
      <div className="mb-8">
        <div className="mx-auto flex w-full max-w-2xl items-center gap-2 rounded-2xl border border-zinc-300 bg-white py-1.5 pl-4 pr-2 shadow-lg shadow-purple-900/5">
          <Skel className="h-4 w-4 shrink-0 rounded-full" />
          <Skel className="h-4 flex-1" />
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-purple-800">
            <span aria-hidden className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />
          </span>
        </div>
      </div>
      <SkelCardGrid />
    </div>
  );
}
