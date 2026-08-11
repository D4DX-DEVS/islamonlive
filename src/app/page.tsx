import Link from "next/link";
import Image from "next/image";
import HeroSlider, { Slide } from "@/components/HeroSlider";
import PodcastPlayer from "@/components/PodcastPlayer";
import { getPosts, featuredImage, postPath, primaryCategory, formatDate, stripHtml, authorName, WPPost } from "@/lib/wordpress";
import { getVideos, getShorts } from "@/lib/youtube";
import { getReels } from "@/lib/instagram";
import { getEpisodes } from "@/lib/podcast";

export const revalidate = 300;

const CAT = { opinion: 38, columns: 28, shariah: 3, culture: 4, infographics: 28546 };

function SectionHead({ title, href, light = false }: { title: string; href?: string; light?: boolean }) {
  return (
    <div className={`mb-4 flex items-center justify-between border-l-4 pl-3 ${light ? "border-cyan-400" : "border-purple-800"}`}>
      <h2 className={`text-xl font-extrabold ${light ? "text-white" : "text-zinc-900"}`}>{title}</h2>
      {href && <Link href={href} className={`text-sm font-medium hover:underline ${light ? "text-cyan-400" : "text-purple-800"}`}>See all →</Link>}
    </div>
  );
}

/* image card with gradient overlay + chip + title — live-site hero/right-column style */
function OverlayCard({ post, className = "" }: { post: WPPost; className?: string }) {
  const img = featuredImage(post);
  const cat = primaryCategory(post);
  return (
    <Link href={postPath(post)} className={`group relative block overflow-hidden rounded-xl bg-zinc-900 ${className}`}>
      {img && <Image src={img.url} alt="" fill sizes="(max-width: 1024px) 100vw, 33vw" className="object-cover transition duration-500 group-hover:scale-105" />}
      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/25 to-transparent" />
      <div className="absolute inset-x-0 bottom-0 p-4">
        {cat && <span className="mb-1.5 inline-block rounded bg-purple-700 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white">{cat.name}</span>}
        <h3 className="line-clamp-2 text-sm font-bold leading-snug text-white" dangerouslySetInnerHTML={{ __html: post.title.rendered }} />
        <p className="mt-1 text-[11px] text-zinc-300">
          {authorName(post) && <>{authorName(post)} · </>}
          {formatDate(post.date)}
        </p>
      </div>
    </Link>
  );
}

/* compact text row: thumb + title + author + date — live-site list style */
function ListRow({ post, thumb = true }: { post: WPPost; thumb?: boolean }) {
  const img = featuredImage(post, true);
  return (
    <Link href={postPath(post)} className="group flex gap-3 py-3">
      {thumb && img && (
        <div className="relative h-16 w-24 shrink-0 overflow-hidden rounded-md bg-zinc-100">
          <Image src={img.url} alt="" fill sizes="96px" className="object-cover" />
        </div>
      )}
      <div className="min-w-0">
        <h3 className="line-clamp-2 text-sm font-bold leading-snug group-hover:text-purple-800" dangerouslySetInnerHTML={{ __html: post.title.rendered }} />
        <p className="mt-1 text-xs text-zinc-500">
          {authorName(post) && <span className="text-zinc-600">{authorName(post)} · </span>}
          {formatDate(post.date)}
        </p>
      </div>
    </Link>
  );
}

function SideList({ title, href, posts, featured = false }: { title: string; href: string; posts: WPPost[]; featured?: boolean }) {
  const [first, ...rest] = posts;
  return (
    <aside>
      <SectionHead title={title} href={href} />
      {featured && first ? (
        <>
          <OverlayCard post={first} className="mb-1 aspect-[16/10]" />
          <div className="divide-y divide-zinc-200">
            {rest.map((p) => <ListRow key={p.id} post={p} />)}
          </div>
        </>
      ) : (
        <div className="divide-y divide-zinc-200">
          {posts.map((p) => <ListRow key={p.id} post={p} />)}
        </div>
      )}
    </aside>
  );
}

export default async function Home() {
  const [latest, opinion, columns, shariah, culture, infographics, videos, reels, shorts, episodes] = await Promise.all([
    getPosts({ perPage: 14 }),
    getPosts({ perPage: 7, categories: [CAT.opinion] }),
    getPosts({ perPage: 7, categories: [CAT.columns] }),
    getPosts({ perPage: 4, categories: [CAT.shariah] }),
    getPosts({ perPage: 14, categories: [CAT.culture] }),
    getPosts({ perPage: 4, categories: [CAT.infographics] }).catch(() => []),
    getVideos(5).catch(() => []),
    getReels(8).catch(() => []),
    getShorts(8).catch(() => []),
    getEpisodes(15).catch(() => []),
  ]);

  const slides: Slide[] = latest.slice(0, 5).map((p) => ({
    href: postPath(p),
    img: featuredImage(p)?.url ?? null,
    title: p.title.rendered,
    excerpt: stripHtml(p.excerpt.rendered),
    category: primaryCategory(p)?.name ?? "",
    author: authorName(p),
    date: formatDate(p.date),
  }));

  const [mainVideo, ...moreVideos] = videos;
  const reelItems = reels.length ? reels : shorts;
  const [opFeatured, ...opRest] = opinion;
  const cultureCols = [culture.slice(0, 7), culture.slice(7, 14)];

  return (
    <div className="space-y-10">
      {/* 1. Hero: big slider + 2 stacked overlay cards — live-site layout */}
      <section className="grid gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2"><HeroSlider slides={slides} /></div>
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-1 lg:grid-rows-2">
          {latest.slice(5, 7).map((p) => (
            <OverlayCard key={p.id} post={p} className="aspect-[4/5] sm:aspect-[16/10] lg:aspect-auto" />
          ))}
        </div>
      </section>

      {/* 2. Watch — dark band, player + sidebar list */}
      {videos.length > 0 && (
        <section className="rounded-xl bg-zinc-900 p-5">
          <SectionHead title="Watch" href="/watch-videos" light />
          <div className="grid gap-4 lg:grid-cols-3">
            <div className="lg:col-span-2">
              <div className="relative aspect-video w-full overflow-hidden rounded-lg">
                <iframe
                  src={`https://www.youtube-nocookie.com/embed/${mainVideo.id}`}
                  title={mainVideo.title}
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                  className="absolute inset-0 h-full w-full"
                />
              </div>
            </div>
            <div className="flex flex-col gap-3">
              <p className="border-b border-zinc-700 pb-2 text-xs font-semibold uppercase tracking-wide text-zinc-400">
                Our Videos <span className="text-zinc-500">· {videos.length} videos</span>
              </p>
              {moreVideos.slice(0, 4).map((v) => (
                <Link key={v.id} href={`/watch-videos?v=${v.id}`} className="group flex gap-3">
                  <div className="relative h-16 w-28 shrink-0 overflow-hidden rounded bg-zinc-800">
                    <Image src={v.thumbnail} alt="" fill sizes="112px" className="object-cover" />
                  </div>
                  <p className="line-clamp-3 text-xs font-medium text-zinc-200 group-hover:text-cyan-400">{v.title}</p>
                </Link>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* 3. Reels — Instagram (fallback: YouTube shorts) */}
      {reelItems.length > 0 && (
        <section>
          <SectionHead title="Reels" href="https://www.instagram.com/islam.onlive/" />
          <div className="flex gap-4 overflow-x-auto pb-2">
            {reelItems.map((r) => (
              <a key={r.id} href={r.url} target="_blank" rel="noopener noreferrer" className="group relative block w-28 shrink-0 overflow-hidden rounded-lg bg-zinc-200 sm:w-36">
                <div className="relative aspect-[9/16] w-full">
                  <Image src={r.thumbnail} alt="" fill sizes="144px" className="object-cover transition group-hover:scale-105" unoptimized />
                </div>
                <span className="absolute inset-0 flex items-center justify-center">
                  <span className="rounded-full bg-black/50 p-3 text-white transition group-hover:bg-purple-700">▶</span>
                </span>
              </a>
            ))}
          </div>
        </section>
      )}

      {/* 4. Infographics — portrait tiles, caption below (live-site style) */}
      {infographics.length > 0 && (
        <section>
          <SectionHead title="Infographics" href="/category/infographics" />
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            {infographics.map((p) => {
              const img = featuredImage(p);
              return (
                <Link key={p.id} href={postPath(p)} className="group">
                  <div className="relative aspect-[4/5] w-full overflow-hidden rounded-lg bg-zinc-100">
                    {img && <Image src={img.url} alt="" fill sizes="(max-width: 768px) 50vw, 25vw" className="object-cover transition group-hover:scale-105" />}
                  </div>
                  <h3 className="mt-2 line-clamp-2 text-sm font-bold leading-snug group-hover:text-purple-800" dangerouslySetInnerHTML={{ __html: p.title.rendered }} />
                  <time className="mt-1 block text-xs text-zinc-500">{formatDate(p.date)}</time>
                </Link>
              );
            })}
          </div>
        </section>
      )}

      {/* 5. Two-column flow: left Opinion/Listen/Culture, right Editor's Picks/Columns/Shari'a.
          One grid so columns stack independently — no whitespace gaps between rows */}
      <div className="grid items-start gap-8 lg:grid-cols-3">
        <div className="space-y-10 lg:col-span-2">
          <section>
            <SectionHead title="Opinion" href="/category/opinion" />
            <div className="grid gap-x-8 sm:grid-cols-2">
              {opFeatured && (
                <OverlayCard post={opFeatured} className="mb-3 aspect-[16/11] sm:mb-0" />
              )}
              <div className="divide-y divide-zinc-200">
                {opRest.slice(0, 3).map((p) => <ListRow key={p.id} post={p} thumb={false} />)}
              </div>
              <div className="sm:col-span-2 sm:columns-2 sm:gap-8">
                {opRest.slice(3, 6).map((p) => <ListRow key={p.id} post={p} thumb={false} />)}
              </div>
            </div>
          </section>

          <section>
            <SectionHead title="Listen" href="/listen" />
            <PodcastPlayer episodes={episodes} listHeight={320} spotifyUrl="https://podcasters.spotify.com/pod/show/islamonlive" />
          </section>

          <section>
            <SectionHead title="Culture" href="/category/culture" />
            <div className="grid gap-x-8 sm:grid-cols-2">
              {cultureCols.map((col, n) => {
                const [first, ...rest] = col;
                return first ? (
                  <div key={n}>
                    <OverlayCard post={first} className="aspect-[16/10]" />
                    <div className="mt-1 divide-y divide-zinc-200">
                      {rest.map((p) => <ListRow key={p.id} post={p} />)}
                    </div>
                  </div>
                ) : null;
              })}
            </div>
          </section>
        </div>

        <div className="space-y-10">
          <SideList title="Editor's Picks" href="/category/news" posts={latest.slice(8, 13)} />
          <SideList title="Columns" href="/category/columns" posts={columns} featured />
          <SideList title="Shari'a" href="/category/shariah" posts={shariah} featured />
        </div>
      </div>
    </div>
  );
}
