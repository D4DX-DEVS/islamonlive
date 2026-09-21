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
import { getPosts, featuredImage, postPath, primaryCategory, formatDate, stripHtml, authorName, authorAvatar, authorSlug, WPPost } from "@/lib/wordpress";
import { getVideos, getShorts } from "@/lib/youtube";
import { getReels } from "@/lib/instagram";
import { getEpisodes } from "@/lib/podcast";
import { getHomeBanners } from "@/lib/banners";
import { graph, organizationSchema, websiteSchema } from "@/lib/schema";
import JsonLd from "@/components/JsonLd";

export const revalidate = 60;

/* Self-referencing canonical on the front page.

   It matters more here than it looks: next.config folds WordPress's old
   /page/2/ archive URLs onto /?page=N so they cannot 404, and this magazine
   layout renders the same front page for all of them. Pinning the canonical to
   "/" tells Google those are one page, not a series of near-duplicates. */
export const metadata = {
  alternates: { canonical: "/" },
};

// posts each hero source contributes to the row's shared pool. The sections
// further down no longer skip past them: a story leading the hero also heads its
// own section, the way the live site runs it. Hiding it below meant the newest
// post in a section was whatever the hero had not claimed, so Shari'ah's block
// sat two posts behind the archive and read as though it had stopped updating.
const HERO_TAKE = 2;
const SIDE_TAKE = 2;
// how many posts each section renders: featured card + 4 rows for the tabbed
// sections, featured card + 11 rows for Columns, which spans Watch + Listen in
// the main column and needs the height. These are also the fetch sizes — the
// hero takes its share off the top of the same lists.
const SECTION_POSTS = 5;
const COLUMNS_POSTS = 12;
/* Editor's Picks is a real editorial signal, not a slice of the feed: the desk
   tags chosen posts `editorspicks` in WordPress (553 of them, still being
   applied). The block used to render `latest.slice(10, 14)` — the 11th-14th
   newest posts site-wide — which is why it always trailed the rest of the page
   by about ten posts and never showed anything the editors had actually picked.
   Desktop shows 4 (featured card + 3 rows), the phone slider 5. */
const EDITORS_PICKS_TAG = 28542;
const PICKS_POSTS = 5;
// the slider and the two cards share one newest-first list, split between them
// in date order: the big slider gets the freshest HERO_MAIN, then each side card
// takes HERO_SIDE behind it — the top card the next block, the bottom card the
// oldest. The side cards rotate through fewer posts than the slider on purpose.
// Keep HERO_CYCLE equal to the blocks below it, and HERO_TAKE / SIDE_TAKE large
// enough to fill them, or the pool's tail is skipped by the sections further
// down the page without ever appearing up here.
const HERO_MAIN = 4;
const HERO_SIDE = 2;
const HERO_SLOTS = 3;
const HERO_CYCLE = HERO_MAIN + HERO_SIDE * (HERO_SLOTS - 1);

/* WP REST `categories=` doesn't include child terms, so parent sections list
   children explicitly — the live site's queries do include them. These are the
   FULL subtrees, verified against /wp-json/wp/v2/categories?parent=…: a term
   left out here is invisible on the homepage even though the category archive
   still lists it (archives pass includeChildren, which takes the whole subtree).
   The second rows are terms that had been missed — all dormant now, but a post
   filed under one would otherwise never reach the front page. Re-check with a
   parent= walk if the desk adds a subcategory. */
const CAT = {
  opinion: [7899, 26, 28543, 3147, 25802, 28544,
            38, 39, 40, 41, 42, 47, 25796, 25797, 25798],
  columns: [28, 36, 28545, 43, 45, 50],
  shariah: [3, 22, 51, 24, 23, 30, 49, 26549, 48],
  culture: [4, 9, 31, 25, 25397, 7, 44],
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
    authorHref: authorSlug(p) ? `/author/${authorSlug(p)}` : null,
    date: formatDate(p.date),
  };
}

function SideList({ title, href, posts, featured = false }: { title: string; href: string; posts: WPPost[]; featured?: boolean }) {
  const [first, ...rest] = posts;
  return (
    // h-full + flex: the cell is stretched to its grid row (lg:self-stretch below),
    // and the card takes whatever the fixed-height list leaves over, so the column
    // ends level with the section beside it at every width instead of at the one
    // the row counts were hand-tuned for
    <aside className="flex h-full flex-col">
      <SectionHead title={title} href={href} />
      {featured && first ? (
        <>
          {/* phones have no row to fill, so the card keeps a ratio there and only
              becomes the flexible one from lg up */}
          <OverlayCard item={toItem(first)} className="mb-3 aspect-video lg:aspect-auto lg:min-h-[180px] lg:flex-1" />
          <div className="space-y-3">
            {/* phones: 2 rows under the card, the rest from sm up */}
            {rest.map((p, i) => (
              <div key={p.id} className={i >= 2 ? "hidden sm:block" : undefined}>
                <ListRow item={toItem(p, true)} compact />
              </div>
            ))}
          </div>
        </>
      ) : (
        <div className="space-y-3">
          {posts.map((p) => <ListRow key={p.id} item={toItem(p, true)} compact />)}
        </div>
      )}
    </aside>
  );
}

export default async function Home() {
  // kicked off first so it runs alongside the batch below, not after it
  const cultureSubsP = Promise.all(
    CULTURE_SUBS.map((c) => getPosts({ perPage: 5, categories: [c.id] }).catch(() => [] as WPPost[]))
  );
  const opinionSubsP = Promise.all(
    OPINION_SUBS.map((c) => getPosts({ perPage: 5, categories: [c.id] }).catch(() => [] as WPPost[]))
  );
  const shariahSubsP = Promise.all(
    SHARIAH_SUBS.map((c) => getPosts({ perPage: 5, categories: [c.id] }).catch(() => [] as WPPost[]))
  );

  const [picks, opinion, columns, shariah, culture, infographics, videos, reels, shorts, episodes, banners] = await Promise.all([
    getPosts({ perPage: PICKS_POSTS, tags: [EDITORS_PICKS_TAG] }).catch(() => [] as WPPost[]),
    // one list per section, newest first. The hero reads its share off the top of
    // these same lists rather than being fed a separate slice, so a post can head
    // both the hero and its section — which is what keeps the section current.
    getPosts({ perPage: SECTION_POSTS, categories: CAT.opinion }),
    // Columns is the sidebar's height driver: its block has to span Watch + Listen
    // in the main column so that "Culture" below it lands level with "Opinion".
    // Its rows are what keep the featured card in shape — too few and the card
    // stretches into a billboard, too many and it flattens to its min height
    getPosts({ perPage: COLUMNS_POSTS, categories: CAT.columns }),
    // Shari'ah now leads the main column, so it needs a section's worth of posts
    getPosts({ perPage: SECTION_POSTS, categories: CAT.shariah }),
    getPosts({ perPage: SECTION_POSTS, categories: CAT.culture }).catch(() => []),
    getPosts({ perPage: 6, categories: CAT.infographics }).catch(() => []),
    getVideos(5).catch(() => []),
    getReels(8).catch(() => []),
    getShorts(8).catch(() => []),
    // the player pages through them 8 at a time
    getEpisodes(40).catch(() => []),
    getHomeBanners().catch(() => []),
  ]);

  // hero row: left slider and right cards are one merged cycle. Opinion,
  // Shari'ah, Columns and Culture all pour into the same pool, deduped by id (a
  // post filed under two of them would otherwise appear twice) and ordered newest
  // first — WP `date` is ISO, so a plain string compare sorts it — then cut to
  // the newest HERO_CYCLE. The latest post on the row leads the big slot instead
  // of whichever section happened to own it.
  const heroPool = [
    ...opinion.slice(0, HERO_TAKE),
    ...shariah.slice(0, HERO_TAKE),
    ...columns.slice(0, SIDE_TAKE),
    ...culture.slice(0, SIDE_TAKE),
  ].filter(Boolean);
  const cycle: Slide[] = heroPool
    .filter((p, n) => heroPool.findIndex((q) => q.id === p.id) === n)
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, HERO_CYCLE)
    .map((p) => toItem(p));
  // the list is then cut into one block per slot, in date order — the slider
  // rotates the newest block, the top card the block behind it, the bottom card
  // the oldest. Each slot stays inside its own block, so the row reads newest
  // (left) to oldest (bottom right) at every step and a post never crosses from
  // one slot to another. Any slot left without posts drops out rather than
  // rendering an empty card.
  // the cards are reserved their share first: a pool thinned by the dedupe above
  // shortens the slider rather than leaving the bottom card empty, which would
  // punch a hole in the right column instead of just rotating through less.
  const sideNeed = HERO_SIDE * (HERO_SLOTS - 1);
  const main = Math.max(1, Math.min(HERO_MAIN, cycle.length - sideNeed));
  const slides = cycle.slice(0, main);
  const sideSlides = Array.from({ length: HERO_SLOTS - 1 }, (_, n) =>
    cycle.slice(main + n * HERO_SIDE, main + (n + 1) * HERO_SIDE),
  ).filter((set) => set.length > 0);

  // the sections show their own newest, hero or no hero. Fetched at section size
  // already, so these are the whole lists — the aliases stay because the tab
  // builders below read them by name.
  const opinionRest = opinion;
  const columnsRest = columns;
  const shariahRest = shariah;
  const cultureRest = culture;

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
      {/* Organization, WebSite and the SearchAction that earns a sitelinks
          search box, declared once on the front page. Article pages carry their
          own copies inside Yoast's graph, so repeating them in the layout would
          only duplicate the nodes on every route. */}
      <JsonLd data={graph(websiteSchema(), organizationSchema())} />
      {/* The page's one h1 is the site itself, for screen readers and crawlers;
          the top story in the slider is an h2 like every other section head.
          With the story as h1 the front page's heading changed on every
          rotation, and the outline read as an article rather than a portal. */}
      <h1 className="sr-only">Islamonlive.in — Comprehensive Islamic portal in Malayalam</h1>
      {/* 1. Hero: big slider + 2 stacked overlay cards. The live site splits the
          row 887/500 with a 37px gutter — 1.77fr / 1fr, gap-9. The side cards take
          their height from the row (lg:aspect-auto), so both columns end level. */}
      <section className="grid gap-4 sm:gap-5 lg:grid-cols-[1.77fr_1fr] lg:gap-9">
        <HeroSlider slides={slides} />
        {/* phones show the slider alone — the two cards repeat Columns and Culture,
            which both have their own sections further down the page */}
        <div className="hidden min-w-0 gap-4 sm:grid sm:grid-cols-2 sm:gap-5 lg:grid-cols-1 lg:grid-rows-2">
          {sideSlides.map((set, n) => (
            <SideSlider key={n} slides={set} interval={7000 + n * 2500} className="aspect-[16/10] sm:aspect-[2/1] lg:aspect-auto" />
          ))}
        </div>
      </section>

      {/* 2. Reels — Instagram (fallback: YouTube shorts). Straight after the hero:
          it is the fastest-moving shelf on the page, and the YouTube band that used
          to sit here now runs inside the left column further down. */}
      {reelItems.length > 0 && (
        <section className="rounded-2xl bg-zinc-100 p-4 sm:rounded-xl sm:p-6">
          <SectionHead title="Reels" href="/reels" />
          {/* 6 latest, one full row — plays in-page in a lightbox */}
          <ReelsLightbox items={reelItems.slice(0, 6)} />
        </section>
      )}

      {/* Editor's Picks — phones only: thumbnail slider right after Reels (desktop keeps the sidebar list).
          Guarded, unlike the old feed slice that could never come back empty: if the
          tag query fails the block drops out rather than leaving a bare heading. */}
      {picks.length > 0 && (
      <section className="lg:hidden">
        <SectionHead title="Editor's Picks" href="/tag/editorspicks" />
        <div className="scrollbar-none flex gap-4 overflow-x-auto">
          {picks.map((p) => (
            <OverlayCard key={p.id} item={toItem(p)} className="aspect-[16/10] w-64 flex-none" />
          ))}
        </div>
      </section>
      )}

      {/* 2b. Promo banner — Elementor image widget pulled from the WP homepage. Hidden on phones. */}
      {banners.map((b) => (
        <a key={b.img} href={b.href} target="_blank" rel="noopener noreferrer" className="hidden overflow-hidden rounded-xl md:block">
          <Image src={b.img} alt={b.alt} width={b.width} height={b.height} sizes="100vw" className="h-auto w-full" />
        </a>
      ))}

      {/* 5. Two-column flow: left Shari'ah / Watch+Listen / Opinion, right
          Editor's Picks / Columns / Culture.

          Real grid ROWS, not two independent flex columns. The columns used to
          stack on their own and were hand-tuned (row counts, PodcastPlayer's
          perPage) so the headings happened to land level — but the tuning only
          held at one viewport: Malayalam titles wrap differently as the track
          widens, so at 1920 the Culture heading sat 82px below Opinion and
          Columns 60px below Watch. Pairing the sections into grid rows makes
          each pair start on the same line at every width, for free.

          items-start, not the default stretch: the Watch cell paints a dark
          panel, and stretching it to the row height would just move the dead
          space inside the band. Any slack in a row sits below the shorter cell.

          order-*: phones render one column, and the row pairing would interleave
          the sidebar lists into the main flow. The order utilities keep the phone
          sequence as it was (main column first, sidebar after); lg:order-none
          hands the DOM order back to the grid. */}
      <div className="grid gap-8 sm:gap-10 lg:grid-cols-3 lg:items-start lg:gap-x-10">
        {/* min-w-0: grid items default to min-width:auto, and long unbroken Malayalam
            titles would otherwise force the track wider than the phone viewport */}
        <div className="order-1 min-w-0 lg:order-none lg:col-span-2">
          <TabbedSection title="Shari'ah" tabs={shariahTabs} />
        </div>
        {/* phones get the slider version after Reels instead */}
        <div className="order-4 hidden min-w-0 lg:order-none lg:block lg:self-stretch">
          {picks.length > 0 && <SideList title="Editor's Picks" href="/tag/editorspicks" posts={picks.slice(0, 4)} featured />}
        </div>

        <div className="order-2 flex min-w-0 flex-col gap-8 sm:gap-10 lg:order-none lg:col-span-2">
          {/* Watch — dark band, player + sidebar list. It reads as a break between
              the two text-heavy sections rather than as a second hero, which is why
              it sits here instead of at the top of the page */}
          {videos.length > 0 && (
            <section className="rounded-2xl bg-zinc-900 p-4 sm:rounded-xl sm:p-6">
              <SectionHead title="Watch" href="/watch-videos" light />
              <WatchPanel videos={videos} />
            </section>
          )}

          {/* sits between Watch and Opinion. The player used to flex to fill the
              sidebar's extra height; stretching an 8-track list only moved the dead
              space inside the black panel. Natural height, fixed list. */}
          <section>
            <SectionHead title="Listen" href="/listen" />
            <PodcastPlayer episodes={episodes} perPage={6} spotifyUrl="https://podcasters.spotify.com/pod/show/islamonlive" />
          </section>
        </div>
        {/* no top padding to match the Watch panel's inner p-6: the row reads off the
            dark panel's top edge, so Columns starts on that edge and its heading sits
            24px above the Watch heading inside the panel */}
        <div className="order-5 min-w-0 lg:order-none lg:self-stretch">
          <SideList title="Columns" href="/category/columns" posts={columnsRest} featured />
        </div>

        <div className="order-3 min-w-0 lg:order-none lg:col-span-2">
          <TabbedSection title="Opinion" tabs={opinionTabs} />
        </div>
        {/* Culture took Shari'ah's old sidebar slot — its topics move into the "…" menu */}
        {/* 4 = the featured card plus 3 rows — measured against Opinion across
            1280/1440/1920 as the count whose worst-case end-of-row mismatch is
            smallest, so the full-width Infographics band below never opens a
            canyon under either cell */}
        <div className="order-6 min-w-0 lg:order-none lg:self-stretch">
          <SideListTabs title="Culture" tabs={cultureTabs} rows={4} />
        </div>
      </div>
      {/* 6. Infographics — portrait tiles, caption below (live-site style) */}
      {infographics.length > 0 && (
        <section>
          {/* the tiles carry their own titles in the artwork, so the captions
              under them stay desktop-only — but the section still needs its
              heading on a phone, or the row reads as a stray strip of images */}
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
                  <h3 className="mt-2 line-clamp-2 hidden text-sm font-bold leading-snug group-hover:text-purple-800 sm:block" dangerouslySetInnerHTML={{ __html: p.title.rendered }} />
                  <time className="mt-1 hidden text-xs text-zinc-500 sm:block">{formatDate(p.date)}</time>
                </Link>
              );
            })}
          </div>
        </section>
      )}

    </div>
  );
}
