import { Skel } from "@/components/Skeleton";

// WP static pages (about, contact, ...): title + prose
export default function Loading() {
  return (
    <div className="mx-auto max-w-3xl">
      <Skel className="mb-6 h-9 w-64" />
      <div className="space-y-3">
        {Array.from({ length: 10 }, (_, i) => (
          <Skel key={i} className={`h-4 ${i % 4 === 3 ? "w-2/3" : "w-full"}`} />
        ))}
      </div>
    </div>
  );
}
