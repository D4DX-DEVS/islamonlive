import { Skel, SkelHead } from "@/components/Skeleton";

export default function Loading() {
  return (
    <div>
      <SkelHead />
      <div className="mx-auto max-w-4xl rounded-xl border border-zinc-200 bg-white p-4 shadow-sm">
        <div className="flex items-center gap-4">
          <Skel className="h-20 w-20 rounded-lg" />
          <div className="flex-1 space-y-2">
            <Skel className="h-5 w-2/3" />
            <Skel className="h-4 w-40" />
          </div>
        </div>
        <Skel className="mt-4 h-2 w-full rounded-full" />
        <div className="mt-6 space-y-3">
          {Array.from({ length: 8 }, (_, i) => (
            <div key={i} className="flex items-center gap-3">
              <Skel className="h-8 w-8 rounded-full" />
              <Skel className="h-4 flex-1" />
              <Skel className="h-4 w-12" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
