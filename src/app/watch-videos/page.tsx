import { getVideos } from "@/lib/youtube";
import WatchReels from "@/components/WatchReels";

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
      {/* tapping a tile opens the full-screen vertical reels feed */}
      <WatchReels videos={videos.filter((x) => x.id !== main.id)} />
    </div>
  );
}
