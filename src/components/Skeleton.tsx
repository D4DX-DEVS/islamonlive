// .skel is the sweeping-highlight shimmer defined in globals.css
export function Skel({ className = "" }: { className?: string }) {
  return <div className={`skel rounded ${className}`} />;
}

export function SkelHead() {
  return <Skel className="mb-6 h-8 w-48" />;
}

/* the SectionHead / SectionTabs shape: title, optional pills, "See all" */
export function SkelSectionHead({ tabs = 0 }: { tabs?: number }) {
  return (
    <div className="mb-4 flex items-center gap-4 border-l-4 border-zinc-200 pl-3">
      <Skel className="h-6 w-28" />
      {tabs > 0 && (
        <div className="hidden flex-1 justify-center gap-2 sm:flex">
          {Array.from({ length: tabs }, (_, i) => <Skel key={i} className="h-6 w-20 rounded-full" />)}
        </div>
      )}
      <Skel className="ml-auto h-4 w-16" />
    </div>
  );
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

/* mirrors ListRow: bordered white card, optional thumb, title lines, byline */
export function SkelListRow({ thumb = true }: { thumb?: boolean }) {
  return (
    <div className="flex gap-3 rounded-xl border border-zinc-200/80 bg-white p-3 shadow-sm">
      {thumb && <Skel className="h-16 w-24 shrink-0 rounded-lg" />}
      <div className="flex-1 space-y-2">
        <Skel className="h-4 w-full" />
        <Skel className="h-4 w-2/3" />
        <div className="flex items-center gap-2 pt-1">
          <Skel className="h-5 w-5 rounded-full" />
          <Skel className="h-3 w-32" />
        </div>
      </div>
    </div>
  );
}

/* mirrors the single-post <article> card, same width, padding and ring */
export function SkelArticle() {
  return (
    <div className="mx-auto max-w-[1100px] rounded-2xl bg-white p-5 shadow-sm ring-1 ring-zinc-200 sm:p-8 lg:p-10">
      <Skel className="mb-3 h-6 w-20" />
      <Skel className="h-8 w-full sm:h-10" />
      <Skel className="mt-2 h-8 w-2/3 sm:h-10" />
      <div className="mt-3 flex gap-3">
        <Skel className="h-4 w-28" />
        <Skel className="h-4 w-32" />
      </div>
      <Skel className="mt-6 aspect-[16/9] w-full rounded-xl" />
      <div className="mt-8 space-y-3">
        {Array.from({ length: 10 }, (_, i) => (
          <Skel key={i} className={`h-4 ${i % 4 === 3 ? "w-2/3" : "w-full"}`} />
        ))}
      </div>
    </div>
  );
}
