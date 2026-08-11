import { Skel, SkelCardGrid } from "@/components/Skeleton";

export default function Loading() {
  return (
    <div>
      <Skel className="mb-2 h-8 w-56" />
      <Skel className="mb-6 h-4 w-96 max-w-full" />
      <SkelCardGrid />
    </div>
  );
}
