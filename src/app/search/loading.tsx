import { Skel, SkelHead, SkelCardGrid } from "@/components/Skeleton";

export default function Loading() {
  return (
    <div>
      <SkelHead />
      <div className="mb-8 flex max-w-xl gap-2">
        <Skel className="h-10 w-full rounded-lg" />
        <Skel className="h-10 w-24 rounded-lg" />
      </div>
      <SkelCardGrid />
    </div>
  );
}
