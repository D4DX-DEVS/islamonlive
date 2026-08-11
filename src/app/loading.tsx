import { Skel, SkelCard, SkelListRow } from "@/components/Skeleton";

// home: hero slider + video band + card sections + two-column flow
export default function Loading() {
  return (
    <div className="space-y-10">
      <div className="grid gap-4 lg:grid-cols-3">
        <Skel className="aspect-[16/9] rounded-xl lg:col-span-2 lg:aspect-auto" />
        <div className="hidden gap-4 lg:grid">
          <Skel className="h-40 rounded-xl" />
          <Skel className="h-40 rounded-xl" />
        </div>
      </div>
      <Skel className="h-72 w-full rounded-xl" />
      <div>
        <Skel className="mb-4 h-7 w-40" />
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }, (_, i) => <SkelCard key={i} />)}
        </div>
      </div>
      <div className="grid items-start gap-8 lg:grid-cols-3">
        <div className="space-y-10 lg:col-span-2">
          <div>
            <Skel className="mb-4 h-7 w-40" />
            <div className="grid gap-x-8 sm:grid-cols-2">
              <Skel className="aspect-[16/11]" />
              <div className="divide-y divide-zinc-200">
                {Array.from({ length: 3 }, (_, i) => <SkelListRow key={i} />)}
              </div>
            </div>
          </div>
        </div>
        <div>
          <Skel className="mb-4 h-7 w-40" />
          <div className="divide-y divide-zinc-200">
            {Array.from({ length: 5 }, (_, i) => <SkelListRow key={i} />)}
          </div>
        </div>
      </div>
    </div>
  );
}
