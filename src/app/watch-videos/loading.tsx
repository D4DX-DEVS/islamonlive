import { Skel, SkelHead } from "@/components/Skeleton";

export default function Loading() {
  return (
    <div>
      <SkelHead />
      <Skel className="mb-3 aspect-video w-full rounded-xl" />
      <Skel className="mb-8 h-6 w-2/3" />
      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }, (_, i) => (
          <div key={i} className="overflow-hidden rounded-lg border border-zinc-200 bg-white shadow-sm">
            <Skel className="aspect-video w-full rounded-none" />
            <div className="space-y-2 p-3">
              <Skel className="h-4 w-full" />
              <Skel className="h-4 w-2/3" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
