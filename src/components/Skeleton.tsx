// ponytail: animate-pulse over custom shimmer keyframes — swap to gradient shimmer if design asks
export function Skel({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse rounded bg-zinc-200 ${className}`} />;
}

export function SkelHead() {
  return <Skel className="mb-6 h-8 w-48" />;
}

export function SkelCard({ excerpt = false }: { excerpt?: boolean }) {
  return (
    <div className="overflow-hidden rounded-lg border border-zinc-200 bg-white shadow-sm">
      <Skel className="aspect-[16/9] w-full rounded-none" />
      <div className="space-y-2 p-3">
        <Skel className="h-4 w-full" />
        <Skel className="h-4 w-3/4" />
        {excerpt && (
          <>
            <Skel className="h-3 w-full" />
            <Skel className="h-3 w-5/6" />
          </>
        )}
        <Skel className="h-3 w-24" />
      </div>
    </div>
  );
}

export function SkelCardGrid({ count = 12, excerpt = true }: { count?: number; excerpt?: boolean }) {
  return (
    <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
      {Array.from({ length: count }, (_, i) => <SkelCard key={i} excerpt={excerpt} />)}
    </div>
  );
}

export function SkelListRow() {
  return (
    <div className="flex gap-3 py-3">
      <Skel className="h-16 w-24 shrink-0" />
      <div className="flex-1 space-y-2">
        <Skel className="h-4 w-full" />
        <Skel className="h-4 w-2/3" />
        <Skel className="h-3 w-24" />
      </div>
    </div>
  );
}

export function SkelArticle() {
  return (
    <div className="mx-auto max-w-3xl">
      <Skel className="mb-3 h-6 w-20" />
      <Skel className="h-9 w-full" />
      <Skel className="mt-2 h-9 w-2/3" />
      <div className="mt-3 flex gap-3">
        <Skel className="h-4 w-28" />
        <Skel className="h-4 w-32" />
      </div>
      <Skel className="mt-6 aspect-[16/9] w-full rounded-xl" />
      <div className="mt-8 space-y-3">
        {Array.from({ length: 8 }, (_, i) => (
          <Skel key={i} className={`h-4 ${i % 4 === 3 ? "w-2/3" : "w-full"}`} />
        ))}
      </div>
    </div>
  );
}
