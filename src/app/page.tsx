import Link from "next/link";
import Image from "next/image";
import HeroSlider, { Slide } from "@/components/HeroSlider";
import SideSlider from "@/components/SideSlider";
import ReelsLightbox from "@/components/ReelsLightbox";
import WatchPanel from "@/components/WatchPanel";
import PodcastPlayer from "@/components/PodcastPlayer";
import TabbedSection from "@/components/TabbedSection";
import SideListTabs from "@/components/SideListTabs";
import { OverlayCard, ListRow, PostItem } from "@/components/PostCards";
import { getPosts, featuredImage, postPath, primaryCategory, formatDate, stripHtml, authorName, authorAvatar, WPPost } from "@/lib/wordpress";
import { getVideos, getShorts } from "@/lib/youtube";
import { getReels } from "@/lib/instagram";
import { getEpisodes } from "@/lib/podcast";
import { getHomeBanners } from "@/lib/banners";

export const revalidate = 60;

// posts each hero source contributes: 3 Opinion + 3 Shari'ah in the big slider,
// 3 Columns and 3 Culture in the two cards beside it
const HERO_TAKE = 3;

// WP REST `categories=` doesn't include child terms, so parent sections list
// children explicitly — live site's queries do include them
const CAT = {
  opinion: [7899, 26, 28543, 3147, 25802, 28544],
  columns: [28, 36, 28545, 43, 45, 50],
  shariah: [3, 22, 51, 24, 23, 30, 49, 26549],
  culture: [4, 9, 31, 25, 25397, 7],
  infographics: [28546],
};
// Opinion's children on the live site — the tabs its homepage section shows
const OPINION_SUBS = [
  { label: "India Today", slug: "indian-politics-opinion", id: 26 },
  { label: "Kerala Voice", slug: "kerala-politics-opinion", id: 28543 },
  { label: "Palestine", slug: "palestine-2", id: 3147 },
  { label: "Top Stories", slug: "top-stories-news-analysis", id: 25802 },
  { label: "World Wide", slug: "internationalpolitics-opinion", id: 28544 },
];
// Shari'ah's children — the tabs its section shows, now that it leads the column
const SHARIAH_SUBS = [
  { label: "Quran", slug: "quran", id: 22 },
  { label: "Faith", slug: "faith", id: 51 },
  { label: "Fiqh", slug: "fiqh", id: 24 },
  { label: "Sunnah", slug: "sunnah", id: 23 },
  { label: "Tharbiya", slug: "tharbiya", id: 30 },
];
// Culture's children on the live site
const CULTURE_SUBS = [
  { label: "History", slug: "history", id: 25 },
  { label: "Civilization", slug: "civilization", id: 31 },
  { label: "Art & Literature", slug: "literature", id: 9 },
  { label: "Travel", slug: "travel", id: 7 },
];

function SectionHead({ title, href, light = false }: { title: string; href?: string; light?: boolean }) {
  return (
    <div className={`mb-3 flex items-center justify-between border-l-4 pl-3 pr-2 sm:mb-4 ${light ? "border-purple-500" : "border-purple-800"}`}>
      <h2 className={`text-xl font-extrabold ${light ? "text-white" : "text-zinc-900"}`}>{title}</h2>
      {href && <Link href={href} className={`text-sm font-medium hover:underline ${light ? "text-purple-300" : "text-purple-800"}`}>See all →</Link>}
    </div>
  );
}

function toItem(p: WPPost, thumb = false): PostItem {
  return {
    href: postPath(p),
    img: featuredImage(p, thumb)?.url ?? null,
    title: p.title.rendered,
    excerpt: stripHtml(p.excerpt.rendered),
    category: primaryCategory(p)?.name ?? "",
    author: authorName(p),
    authorAvatar: authorAvatar(p),
    date: formatDate(p.date),
  };
}

function SideList({ title, href, posts, featured = false }: { title: string; href: string; posts: WPPost[]; featured?: boolean }) {
  const [first, ...rest] = posts;
  return (
    <aside>
      <SectionHead title={title} href={href} />
      {featured && first ? (
        <>
          <OverlayCard item={toItem(first)} className="mb-3 aspect-[16/10]" />
          <div className="space-y-3">
            {rest.map((p) => <ListRow key={p.id} item={toItem(p, true)} />)}
          </div>
        </>
      ) : (
        <div className="space-y-3">
          {posts.map((p) => <ListRow key={p.id} item={toItem(p, true)} />)}
        </div>
      )}
    </aside>
  );
}

export default async function Home() {
  // kicked off first so it runs alongside the batch below, not after it
  const cultureSubsP = Promise.all(
    CULTURE_SUBS.map((c) => getPosts({ perPage: 16, categories: [c.id] }).catch(() => [] as WPPost[]))
  );
  const opinionSubsP = Promise.all(
    OPINION_SUBS.map((c) => getPosts({ perPage: 5, categories: [c.id] }).catch(() => [] as WPPost[]))
  );
  const shariahSubsP = Promise.all(
    SHARIAH_SUBS.map((c) => getPosts({ perPage: 5, categories: [c.id] }).catch(() => [] as WPPost[]))
  );

  const [latest, opinion, columns, shariah, culture, infographics, videos, reels, shorts, episodes, banners] = await Promise.all([
    getPosts({ perPage: 18 }),
    // each fetches HERO_TAKE extra: the first 3 go into the hero, the rest feed
    // the section further down, so no post shows up twice on the page
    getPosts({ perPage: 5 + HERO_TAKE, categories: CAT.opinion }),
    getPosts({ perPage: 7 + HERO_TAKE, categories: CAT.columns }),
    // Shari'ah now leads the main column, so it needs a section's worth of posts
    getPosts({ perPage: 5 + HERO_TAKE, categories: CAT.shariah }),
    getPosts({ perPage: 16 + HERO_TAKE, categories: CAT.culture }).catch(() => []),
    getPosts({ perPage: 6, categories: CAT.infographics }).catch(() => []),
    getVideos(5).catch(() => []),
    getReels(8).catch(() => []),
    getShorts(8).catch(() => []),
    // the player's list stretches to the column now — 15 left it half empty
    getEpisodes(40).catch(() => []),
    getHomeBanners().catch(() => []),
  ]);

  // hero banner: the big slider carries Opinion + Shari'ah (alternating so neither
  // section owns the top slot), the two small cards beside it carry Columns and Culture
  const slides: Slide[] = opinion
    .slice(0, HERO_TAKE)
    .flatMap((p, n) => [p, shariah[n]])
    .filter(Boolean)
    .map((p) => toItem(p));
  // the two cards rotate too — staggered so they don't flip together
  const sideSlides = [
    columns.slice(0, HERO_TAKE).map((p) => toItem(p)),
    culture.slice(0, HERO_TAKE).map((p) => toItem(p)),
  ];

  // what's left after the hero took its share — the sections below use these
  const opinionRest = opinion.slice(HERO_TAKE);
  const columnsRest = columns.slice(HERO_TAKE);
  const shariahRest = shariah.slice(HERO_TAKE);
  const cultureRest = culture.slice(HERO_TAKE);

  const [cultureSubPosts, opinionSubPosts, shariahSubPosts] = await Promise.all([cultureSubsP, opinionSubsP, shariahSubsP]);

  const reelItems = reels.length ? reels : shorts;

  // drop tabs with nothing behind them rather than rendering an empty grid
  const cultureTabs = [
    { label: "All", href: "/category/culture", items: cultureRest.map((p) => toItem(p)) },
    ...CULTURE_SUBS.map((c, n) => ({
      label: c.label,
      href: `/category/${c.slug}`,
      items: cultureSubPosts[n].map((p) => toItem(p)),
    })),
  ].filter((t) => t.items.length > 0);

  const opinionTabs = [
    { label: "All", href: "/category/opinion", items: opinionRest.map((p) => toItem(p)) },
    ...OPINION_SUBS.map((c, n) => ({
      label: c.label,
      href: `/category/${c.slug}`,
      items: opinionSubPosts[n].map((p) => toItem(p)),
    })),
  ].filter((t) => t.items.length > 0);

  const shariahTabs = [
    { label: "All", href: "/category/shariah", items: shariahRest.map((p) => toItem(p)) },
    ...SHARIAH_SUBS.map((c, n) => ({
      label: c.label,
      href: `/category/${c.slug}`,
      items: shariahSubPosts[n].map((p) => toItem(p)),
    })),
  ].filter((t) => t.items.length > 0);

  return (
    <div className="space-y-8 sm:space-y-12">
      {/* 1. Hero: big slider + 2 stacked overlay cards. The live site splits the
          row 887/500 with a 37px gutter — 1.77fr / 1fr, gap-9. The side cards take
          their height from the row (lg:aspect-auto), so both columns end level. */}
      <section className="grid gap-4 sm:gap-5 lg:grid-cols-[1.77fr_1fr] lg:gap-9">
        <HeroSlider slides={slides} />
        {/* phones: full-width cards stacked under the hero, as on the live site —
            two-up here squeezes the title against the advance disc */}
        <div className="grid min-w-0 gap-4 sm:grid-cols-2 sm:gap-5 lg:grid-cols-1 lg:grid-rows-2">
          {sideSlides.map((set, n) => (
            <SideSlider key={n} slides={set} interval={7000 + n * 2500} className="aspect-[16/10] sm:aspect-[2/1] lg:aspect-auto" />
          ))}
        </div>
      </section>

      {/* 2. Watch — dark band, player + sidebar list */}
      {videos.length > 0 && (
        <section className="rounded-2xl bg-zinc-900 p-4 sm:rounded-xl sm:p-6">
          <SectionHead title="Watch" href="/watch-videos" light />
          <WatchPanel videos={videos} />
        </section>
      )}

      {/* Editor's Picks — phones only: thumbnail slider right after Watch (desktop keeps the sidebar list) */}
      <section className="lg:hidden">
        <SectionHead title="Editor's Picks" href="/category/news" />
        <div className="scrollbar-none flex gap-4 overflow-x-auto">
          {latest.slice(11, 16).map((p) => (
            <OverlayCard key={p.id} item={toItem(p)} className="aspect-[16/10] w-64 flex-none" />
          ))}
        </div>
      </section>

      {/* 2b. Promo banner — Elementor image widget pulled from the WP homepage. Hidden on phones. */}
      {banners.map((b) => (
        <a key={b.img} href={b.href} target="_blank" rel="noopener noreferrer" className="hidden overflow-hidden rounded-xl md:block">
          <Image src={b.img} alt={b.alt} width={b.width} height={b.height} sizes="100vw" className="h-auto w-full" />
        </a>
      ))}

      {/* 3. Reels — Instagram (fallback: YouTube shorts) */}
      {reelItems.length > 0 && (
        <section className="rounded-2xl bg-zinc-100 p-4 sm:rounded-xl sm:p-6">
          <SectionHead title="Reels" href="/reels" />
          {/* 6 latest, one full row — plays in-page in a lightbox */}
          <ReelsLightbox items={reelItems.slice(0, 6)} />
        </section>
      )}

      {/* 5. Two-column flow: left Shari'ah/Opinion/Listen, right Editor's Picks/Columns/Culture.
          One grid so columns stack independently — no whitespace gaps between rows */}
      {/* fixed section gaps, not justify-between: the columns hold different amounts
          of content, and spreading the slack to line the bottoms up left canyons
          between the shorter column's sections. The shorter column just ends earlier. */}
      <div className="grid gap-8 lg:grid-cols-3 lg:gap-10">
        {/* min-w-0: grid items default to min-width:auto, and long unbroken Malayalam
            titles would otherwise force the track wider than the phone viewport */}
        <div className="flex min-w-0 flex-col gap-8 sm:gap-10 lg:col-span-2">
          <TabbedSection title="Shari'ah" tabs={shariahTabs} />

          <TabbedSection title="Opinion" tabs={opinionTabs} />

          {/* last section in the column, so it takes the slack: the sidebar runs
              longer than the main column at wide widths, and a fixed-height player
              left a block of empty page under it. The episode list flexes instead. */}
          <section className="lg:flex lg:h-0 lg:min-h-[320px] lg:flex-1 lg:flex-col">
            <SectionHead title="Listen" href="/listen" />
            <PodcastPlayer episodes={episodes} fill spotifyUrl="https://podcasters.spotify.com/pod/show/islamonlive" />
          </section>
        </div>

        {/* the sidebar carries whatever is left over after the player has flexed —
            a few dozen px spread over two gaps, so both columns end on the same line */}
        <div className="flex min-w-0 flex-col gap-8 sm:gap-10 lg:justify-between">
          {/* phones get the slider version after Watch instead */}
          <div className="hidden lg:block">
            <SideList title="Editor's Picks" href="/category/news" posts={latest.slice(11, 16)} />
          </div>
          <SideList title="Columns" href="/category/columns" posts={columnsRest} featured />
          {/* Culture took Shari'ah's old sidebar slot — its topics move into the "…" menu */}
          {/* a long list on purpose: the sidebar should stay the taller column so the Listen player
              below absorbs the difference instead of the page showing dead space */}
          <SideListTabs title="Culture" tabs={cultureTabs} rows={9} />
        </div>
      </div>
      {/* 6. Infographics — portrait tiles, caption below (live-site style) */}
      {infographics.length > 0 && (
        <section>
          <SectionHead title="Infographics" href="/category/infographics" />
          {/* phones: horizontal slider; ≥sm: grid (5-wide desktop row drops the 6th) */}
          <div className="scrollbar-none flex gap-4 overflow-x-auto sm:grid sm:grid-cols-3 lg:grid-cols-5 lg:[&>*:nth-child(6)]:hidden">
            {infographics.map((p) => {
              const img = featuredImage(p);
              return (
                <Link key={p.id} href={postPath(p)} className="group w-40 flex-none sm:w-auto">
                  {/* ring, not a plain bg — light-background infographics need an edge to read against the page */}
                  <div className="relative aspect-[4/5] w-full overflow-hidden rounded-lg bg-zinc-100 shadow-sm ring-1 ring-inset ring-zinc-900/10 transition group-hover:shadow-md group-hover:ring-purple-300">
                    {img && <Image src={img.url} alt="" fill sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 20vw" className="object-cover transition group-hover:scale-105" />}
                  </div>
                  <h3 className="mt-2 line-clamp-2 text-sm font-bold leading-snug group-hover:text-purple-800" dangerouslySetInnerHTML={{ __html: p.title.rendered }} />
                  <time className="mt-1 block text-xs text-zinc-500">{formatDate(p.date)}</time>
                </Link>
              );
            })}
          </div>
        </section>
      )}

    </div>
  );
}
