import PodcastPlayer from "@/components/PodcastPlayer";
import { getEpisodes } from "@/lib/podcast";

export const revalidate = 1800;
export const metadata = { title: "Listen" };

export default async function ListenPage() {
  const episodes = await getEpisodes(1000);

  return (
    <div>
      <h1 className="mb-6 border-l-4 border-purple-800 pl-3 text-2xl font-extrabold">Listen</h1>
      {episodes.length === 0 ? (
        <p className="text-zinc-500">Episodes unavailable right now.</p>
      ) : (
        <div className="mx-auto max-w-4xl"><PodcastPlayer episodes={episodes} stickyHeader spotifyUrl="https://podcasters.spotify.com/pod/show/islamonlive" /></div>
      )}
    </div>
  );
}
