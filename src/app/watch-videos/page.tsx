import { getVideos } from "@/lib/youtube";
import WatchReels from "@/components/WatchReels";
import WatchSwitch from "@/components/WatchSwitch";

export const revalidate = 3600;
// canonical drops the ?v= deep-link so every video variant consolidates here
export const metadata = { title: "Videos", alternates: { canonical: "/watch-videos/" } };

export default async function WatchPage({ searchParams }: { searchParams: Promise<{ v?: string }> }) {
  const videos = await getVideos(30);
  if (!videos.length) return <p className="text-zinc-500">Videos unavailable right now.</p>;

  const { v } = await searchParams;
  const main = videos.find((x) => x.id === v) ?? videos[0];

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-center gap-3 md:justify-between">
        <h1 className="sr-only border-l-4 border-purple-800 pl-3 text-2xl font-extrabold md:not-sr-only">Videos</h1>
        <WatchSwitch />
      </div>
      <div className="relative mb-3 aspect-video w-full overflow-hidden rounded-xl">
        <iframe
          key={main.id}
          src={`https://www.youtube.com/embed/${main.id}?playsinline=1&rel=0`}
          title={main.title}
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
          // YouTube "error 153": embeds without a Referer are refused
          referrerPolicy="strict-origin-when-cross-origin"
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
