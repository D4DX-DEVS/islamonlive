import Link from "next/link";
import Image from "next/image";
import { getVideos } from "@/lib/youtube";

export const revalidate = 3600;
export const metadata = { title: "Watch" };

export default async function WatchPage({ searchParams }: { searchParams: Promise<{ v?: string }> }) {
  const videos = await getVideos(30);
  if (!videos.length) return <p className="text-zinc-500">Videos unavailable right now.</p>;

  const { v } = await searchParams;
  const main = videos.find((x) => x.id === v) ?? videos[0];

  return (
    <div>
      <h1 className="mb-6 border-l-4 border-purple-800 pl-3 text-2xl font-extrabold">Watch</h1>
      <div className="relative mb-3 aspect-video w-full overflow-hidden rounded-xl">
        <iframe
          key={main.id}
          src={`https://www.youtube-nocookie.com/embed/${main.id}`}
          title={main.title}
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
          className="absolute inset-0 h-full w-full"
        />
      </div>
      <p className="mb-8 text-lg font-bold">{main.title}</p>
      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {videos.filter((x) => x.id !== main.id).map((x) => (
          <Link key={x.id} href={`/watch-videos?v=${x.id}`} scroll={true} className="group overflow-hidden rounded-lg border border-zinc-200 bg-white shadow-sm hover:shadow-md">
            <div className="relative aspect-video w-full bg-zinc-100">
              <Image src={x.thumbnail} alt="" fill sizes="(max-width: 768px) 100vw, 33vw" className="object-cover transition group-hover:scale-105" />
              <span className="absolute inset-0 flex items-center justify-center">
                <span className="rounded-full bg-black/50 p-3 text-white group-hover:bg-purple-700">▶</span>
              </span>
            </div>
            <p className="p-3 text-sm font-bold leading-snug group-hover:text-purple-800">{x.title}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}
