import { Skel, SkelSectionHead, SkelListRow } from "@/components/Skeleton";

/* mirrors app/page.tsx section for section: hero, watch, reels, infographics,
   then the two-column flow (Opinion / Listen / Culture + right rail) */
export default function Loading() {
  return (
    <div className="space-y-10">
      {/* hero: slider + two stacked cards */}
      <div className="grid gap-4 lg:grid-cols-3">
        <Skel className="aspect-[16/9] rounded-xl lg:col-span-2 lg:aspect-auto" />
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-1 lg:grid-rows-2">
          <Skel className="aspect-[4/5] rounded-xl sm:aspect-[16/10] lg:aspect-auto" />
          <Skel className="aspect-[4/5] rounded-xl sm:aspect-[16/10] lg:aspect-auto" />
        </div>
      </div>

      {/* watch: player + list (light band; real section is dark but a black skeleton reads as broken) */}
      <div className="rounded-xl bg-zinc-100 p-5">
        <Skel className="mb-4 h-6 w-28" />
        <div className="grid gap-4 lg:grid-cols-3">
          <Skel className="aspect-video rounded-lg lg:col-span-2" />
          <div className="space-y-3">
            {Array.from({ length: 4 }, (_, i) => (
              <div key={i} className="flex gap-3">
                <Skel className="h-14 w-24 shrink-0 rounded-lg" />
                <Skel className="h-14 flex-1 rounded-lg" />
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* reels */}
      <div className="rounded-xl bg-zinc-100 p-5">
        <Skel className="mb-4 h-6 w-24" />
        <div className="grid grid-cols-3 gap-4 lg:grid-cols-6">
          {Array.from({ length: 6 }, (_, i) => <Skel key={i} className="aspect-[9/16] rounded-lg" />)}
        </div>
      </div>

      {/* infographics */}
      <div>
        <SkelSectionHead />
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
          {Array.from({ length: 6 }, (_, i) => (
            <div key={i} className={i === 5 ? "lg:hidden" : undefined}>
              <Skel className="aspect-[4/5] w-full rounded-lg" />
              <Skel className="mt-2 h-4 w-full" />
              <Skel className="mt-1 h-3 w-20" />
            </div>
          ))}
        </div>
      </div>

      <div className="grid items-start gap-8 lg:grid-cols-3">
        <div className="space-y-10 lg:col-span-2">
          {/* Opinion: image + headline, then 2x2 cards */}
          <div>
            <SkelSectionHead tabs={4} />
            <div className="grid gap-x-8 gap-y-4 sm:grid-cols-2">
              <Skel className="aspect-[16/11] rounded-xl sm:aspect-auto sm:min-h-[280px]" />
              <div className="space-y-3">
                <Skel className="h-4 w-40" />
                <Skel className="h-6 w-full" />
                <Skel className="h-6 w-4/5" />
                {Array.from({ length: 5 }, (_, i) => (
                  <Skel key={i} className={`h-3 ${i === 4 ? "w-2/3" : "w-full"}`} />
                ))}
              </div>
              <div className="grid gap-4 sm:col-span-2 sm:grid-cols-2 sm:gap-x-8">
                {Array.from({ length: 4 }, (_, i) => <SkelListRow key={i} />)}
              </div>
            </div>
          </div>

          {/* Listen */}
          <div>
            <SkelSectionHead />
            <Skel className="h-80 w-full rounded-xl" />
          </div>

          {/* Culture: two columns of overlay card + list */}
          <div>
            <SkelSectionHead tabs={4} />
            <div className="grid gap-x-8 gap-y-6 sm:grid-cols-2">
              {Array.from({ length: 2 }, (_, c) => (
                <div key={c}>
                  <Skel className="aspect-[16/10] w-full rounded-xl" />
                  <div className="mt-3 space-y-3">
                    {Array.from({ length: 3 }, (_, i) => <SkelListRow key={i} />)}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* right rail: Editor's Picks, Columns, Shari'a */}
        <div className="space-y-10">
          {Array.from({ length: 3 }, (_, s) => (
            <div key={s}>
              <SkelSectionHead />
              {s > 0 && <Skel className="mb-3 aspect-[16/10] w-full rounded-xl" />}
              <div className="space-y-3">
                {Array.from({ length: s > 0 ? 4 : 5 }, (_, i) => <SkelListRow key={i} />)}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
