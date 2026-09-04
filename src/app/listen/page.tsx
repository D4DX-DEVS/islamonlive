import PodcastPlayer from "@/components/PodcastPlayer";
import { getEpisodes } from "@/lib/podcast";

export const revalidate = 1800;
export const metadata = { title: "Listen" };

// the same show the Anchor RSS in lib/podcast.ts comes from, resolved once from
// podcasters.spotify.com/pod/show/islamonlive
const SPOTIFY_SHOW_ID = "1juxiGQT9bAOsCKCRYeFi0";
const SPOTIFY_SHOW_URL = `https://open.spotify.com/show/${SPOTIFY_SHOW_ID}`;

export default async function ListenPage() {
  const episodes = await getEpisodes(1000);

  return (
    <div>
      <h1 className="mb-4 border-l-4 border-purple-800 pl-3 text-2xl font-extrabold sm:mb-6">Listen</h1>
      {/* one player, not two. The page used to stack Spotify's own show embed on
          top of this player: two transports, two progress bars and two sources of
          truth for what was playing. The RSS player is the one that works without
          an account, so it stays and owns the page; Spotify keeps a single
          "Follow" link on the stage for the account-only features (follow, save,
          resume across devices). */}
      {episodes.length === 0 ? (
        <p className="text-zinc-500">Episodes unavailable right now.</p>
      ) : (
        <PodcastPlayer episodes={episodes} variant="page" perPage={25} spotifyUrl={SPOTIFY_SHOW_URL} />
      )}
    </div>
  );
}
