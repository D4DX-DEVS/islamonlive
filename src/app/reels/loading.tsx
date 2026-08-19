import { Skel, SkelHead } from "@/components/Skeleton";

export default function Loading() {
  return (
    <div>
      <SkelHead />
      {/* mirrors the /reels grid: 9:16 tiles */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
        {Array.from({ length: 12 }, (_, i) => (
          <Skel key={i} className="aspect-[9/16] w-full rounded-xl" />
        ))}
      </div>
    </div>
  );
}
