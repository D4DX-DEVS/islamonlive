import Link from "next/link";
import Image from "next/image";
import { cache, type CSSProperties } from "react";
import HeroSlider, { type Slide } from "@/components/HeroSlider";
import SideSlider from "@/components/SideSlider";
import ReelsLightbox from "@/components/ReelsLightbox";
import WatchPanel from "@/components/WatchPanel";
import PodcastPlayer from "@/components/PodcastPlayer";
import TabbedSection from "@/components/TabbedSection";
import SideListTabs from "@/components/SideListTabs";
import { OverlayCard, ListRow, PostItem } from "@/components/PostCards";
import { getPosts, getAllCategories, featuredImage, postPath, primaryCategory, formatDate, stripHtml, authorName, authorAvatar, authorSlug, WPPost, WPCategory } from "@/lib/wordpress";
import { getVideos, getShorts } from "@/lib/youtube";
import { getReels } from "@/lib/instagram";
import { getEpisodes } from "@/lib/podcast";
import { getHomeBanners } from "@/lib/banners";
import { groupSections, KIND_LABELS, type HomeSection, type HeroSection, type PostsSection, type Visibility } from "@/lib/home-layout/schema";

/* The homepage, rendered from the admin's layout (lib/home-layout). The
   section markup is the hand-built page's, unchanged; what used to be fixed in
   page.tsx (order, titles, categories, counts) now comes from the layout. */

const none: WPPost[] = [];

// one category list per request, shared by every section that needs slugs
const categoriesById = cache(async (): Promise<Map<number, WPCategory>> => {
  const all = await getAllCategories().catch(() => [] as WPCategory[]);
  return new Map(all.map((c) => [c.id, c]));
});

/** A section's posts, newest first: a tag, categories with their sub-categories, or the latest. Never throws. */
function sourcePosts(perPage: number, categoryIds: number[], tagId: number | null = null): Promise<WPPost[]> {
  if (tagId) return getPosts({ perPage, tags: [tagId] }).catch(() => none);
  if (categoryIds.length) return getPosts({ perPage, categories: categoryIds, includeChildren: true }).catch(() => none);
  return getPosts({ perPage }).catch(() => none);
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

export function SectionHead({ title, href, light = false }: { title: string; href?: string; light?: boolean }) {
  if (!title) return null;
  return (
    <div className={`mb-3 flex items-center justify-between border-l-4 pl-3 pr-2 sm:mb-4 ${light ? "border-purple-500" : "border-purple-800"}`}>
      <h2 className={`text-xl font-extrabold ${light ? "text-white" : "text-zinc-900"}`}>{title}</h2>
      {href && <Link href={href} className={`text-sm font-medium hover:underline ${light ? "text-purple-300" : "text-purple-800"}`}>See all →</Link>}
    </div>
  );
}

function SideList({ title, href, posts }: { title: string; href?: string; posts: WPPost[] }) {
  const [first, ...rest] = posts;
  return (
    // h-full + flex: the cell is stretched to its grid row (lg:self-stretch), and
    // the card takes whatever the list leaves over, so the column ends level with
    // the section beside it at every width
    <aside className="flex h-full flex-col">
      <SectionHead title={title} href={href} />
      {first && (
        <>
          {/* phones have no row to fill, so the card keeps a ratio there and only becomes the flexible one from lg up */}
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
      )}
    </aside>
  );
}

/* ---------- section kinds ---------- */

async function Hero({ section }: { section: HeroSection }) {
  // the slider and the two cards share one newest-first list, cut into one block
  // per slot in date order: the slider rotates the newest block, the top card the
  // block behind it, the bottom card the oldest
  const slots = section.sideCount > 0 ? 2 : 0;
  const sideNeed = section.sideCount * slots;
  const cycle: Slide[] = (await sourcePosts(section.mainCount + sideNeed, section.categoryIds)).map((p) => toItem(p));
  if (!cycle.length) return null;
  // the cards are reserved their share first: a short list shortens the slider rather than leaving a card empty
  const main = Math.max(1, Math.min(section.mainCount, cycle.length - sideNeed));
  const slides = cycle.slice(0, main);
  const sideSlides = Array.from({ length: slots }, (_, n) => cycle.slice(main + n * section.sideCount, main + (n + 1) * section.sideCount)).filter((set) => set.length > 0);
  return (
    // the live site splits the row 887/500 with a 37px gutter — 1.77fr / 1fr, gap-9
    <section className={`grid gap-4 sm:gap-5 lg:gap-9 ${sideSlides.length ? "lg:grid-cols-[1.77fr_1fr]" : ""}`}>
      <HeroSlider slides={slides} />
      {/* phones show the slider alone — the cards repeat stories the sections below carry */}
      {sideSlides.length > 0 && (
        <div className="hidden min-w-0 gap-4 sm:grid sm:grid-cols-2 sm:gap-5 lg:grid-cols-1 lg:grid-rows-2">
          {sideSlides.map((set, n) => (
            <SideSlider key={n} slides={set} interval={7000 + n * 2500} className="aspect-[16/10] sm:aspect-[2/1] lg:aspect-auto" />
          ))}
        </div>
      )}
    </section>
  );
}

async function Reels({ title, href, count }: { title: string; href: string; count: number }) {
  const reels = await getReels(Math.max(count, 8)).catch(() => []);
  const items = reels.length ? reels : await getShorts(Math.max(count, 8)).catch(() => []);
  if (!items.length) return null;
  return (
    <section className="rounded-2xl bg-zinc-100 p-4 sm:rounded-xl sm:p-6">
      <SectionHead title={title} href={href || undefined} />
      <ReelsLightbox items={items.slice(0, count)} />
    </section>
  );
}

async function Banners() {
  const banners = await getHomeBanners().catch(() => []);
  if (!banners.length) return null;
  // hidden on phones, as the Elementor strip was
  return (
    <>
      {banners.map((b) => (
        <a key={b.img} href={b.href} target="_blank" rel="noopener noreferrer" className="hidden overflow-hidden rounded-xl md:block">
          <Image src={b.img} alt={b.alt} width={b.width} height={b.height} sizes="100vw" className="h-auto w-full" />
        </a>
      ))}
    </>
  );
}

async function Watch({ title, href, count }: { title: string; href: string; count: number }) {
  const videos = await getVideos(count).catch(() => []);
  if (!videos.length) return null;
  return (
    <section className="rounded-2xl bg-zinc-900 p-4 sm:rounded-xl sm:p-6">
      <SectionHead title={title} href={href || undefined} light />
      <WatchPanel videos={videos} />
    </section>
  );
}

async function Listen({ title, href, perPage }: { title: string; href: string; perPage: number }) {
  // the player pages through them perPage at a time
  const episodes = await getEpisodes(40).catch(() => []);
  if (!episodes.length) return null;
  return (
    <section>
      <SectionHead title={title} href={href || undefined} />
      <PodcastPlayer episodes={episodes} perPage={perPage} spotifyUrl="https://podcasters.spotify.com/pod/show/islamonlive" />
    </section>
  );
}

function ImageBanner({ img, href, alt, width, height }: { img: string; href: string; alt: string; width: number; height: number }) {
  if (!img) return null;
  // an admin-entered address may be on any host, so it is not sent through the image optimizer
  // eslint-disable-next-line @next/next/no-img-element
  const picture = <img src={img} alt={alt} width={width} height={height} loading="lazy" className="h-auto w-full" />;
  return href
    ? <a href={href} target={href.startsWith("/") ? undefined : "_blank"} rel={href.startsWith("/") ? undefined : "noopener noreferrer"} className="block overflow-hidden rounded-xl">{picture}</a>
    : <div className="overflow-hidden rounded-xl">{picture}</div>;
}

async function Posts({ section }: { section: PostsSection }) {
  const categories = await categoriesById();
  const href = section.href || (section.categoryIds[0] && categories.get(section.categoryIds[0]) ? `/category/${categories.get(section.categoryIds[0])!.slug}` : "");
  const withTabs = section.style === "tabbed" || section.style === "compact_tabs";
  const [posts, tabPosts] = await Promise.all([
    sourcePosts(section.count, section.categoryIds, section.tagId),
    withTabs ? Promise.all(section.tabs.map((tab) => sourcePosts(section.style === "tabbed" ? section.count : Math.max(section.count, 5), [tab.categoryId]))) : Promise.resolve([] as WPPost[][]),
  ]);

  if (withTabs) {
    // drop tabs with nothing behind them rather than rendering an empty grid
    const tabs = [
      { label: "All", href, items: posts.map((p) => toItem(p)) },
      ...section.tabs.map((tab, n) => ({ label: tab.label, href: categories.get(tab.categoryId) ? `/category/${categories.get(tab.categoryId)!.slug}` : href, items: tabPosts[n].map((p) => toItem(p)) })),
    ].filter((t) => t.items.length > 0);
    if (!tabs.length) return null;
    return section.style === "tabbed" ? <TabbedSection title={section.title} tabs={tabs} /> : <SideListTabs title={section.title} tabs={tabs} rows={section.count} />;
  }
  if (!posts.length) return null;

  if (section.style === "featured_list") return <SideList title={section.title} href={href || undefined} posts={posts} />;

  if (section.style === "slider") {
    return (
      <section>
        <SectionHead title={section.title} href={href || undefined} />
        <div className="scrollbar-none flex gap-4 overflow-x-auto">
          {posts.map((p) => <OverlayCard key={p.id} item={toItem(p)} className="aspect-[16/10] w-64 flex-none" />)}
        </div>
      </section>
    );
  }

  if (section.style === "portrait_grid") {
    return (
      <section>
        <SectionHead title={section.title} href={href || undefined} />
        {/* phones: horizontal slider; ≥sm: grid (a 5-wide desktop row drops the 6th) */}
        <div className="scrollbar-none flex gap-4 overflow-x-auto sm:grid sm:grid-cols-3 lg:grid-cols-5 lg:[&>*:nth-child(6)]:hidden">
          {posts.map((p) => {
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
    );
  }

  // grid: a featured card row for wide placements, rows in a sidebar
  return (
    <section>
      <SectionHead title={section.title} href={href || undefined} />
      {section.placement === "side" ? (
        <div className="space-y-3">{posts.map((p) => <ListRow key={p.id} item={toItem(p, true)} compact />)}</div>
      ) : (
        <div className={`grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-5 ${section.placement === "full" ? "lg:grid-cols-4" : "lg:grid-cols-3"}`}>
          {posts.map((p) => <OverlayCard key={p.id} item={toItem(p)} className="aspect-[16/10]" />)}
        </div>
      )}
    </section>
  );
}

function SectionBody({ section }: { section: HomeSection }) {
  switch (section.kind) {
    case "hero": return <Hero section={section} />;
    case "reels": return <Reels title={section.title} href={section.href} count={section.count} />;
    case "banners": return <Banners />;
    case "watch": return <Watch title={section.title} href={section.href} count={section.count} />;
    case "listen": return <Listen title={section.title} href={section.href} perPage={section.perPage} />;
    case "image": return <ImageBanner img={section.img} href={section.href} alt={section.alt} width={section.width} height={section.height} />;
    case "posts": return <Posts section={section} />;
  }
}

const VISIBILITY: Record<Visibility, string> = { all: "", desktop: "hidden lg:block", mobile: "lg:hidden" };

/** A cell whose sections all hide at one size hides with them, so it leaves no gap in the phone column. */
function cellDisplay(sections: HomeSection[]): string {
  if (sections.length && sections.every((s) => s.visibility === "desktop")) return "hidden lg:flex";
  if (sections.length && sections.every((s) => s.visibility === "mobile")) return "flex lg:hidden";
  return "flex";
}

/** One section's box. In the builder preview it carries the section's id and name, which the builder outlines and selects by. */
function Slot({ section, className = "", preview }: { section: HomeSection; className?: string; preview: boolean }) {
  const body = <SectionBody section={section} />;
  if (!preview) return className ? <div className={className}>{body}</div> : body;
  const label = ("title" in section && section.title) || KIND_LABELS[section.kind];
  // the builder sets data-selected from outside React, often before hydration
  return <div className={className} data-section-id={section.id} data-section-label={label} suppressHydrationWarning>{body}</div>;
}

/** Every enabled section in layout order, full-width rows and the paired two-column blocks. */
export default function HomeSections({ sections, preview = false }: { sections: HomeSection[]; /** Mark each section for the admin builder. */ preview?: boolean }) {
  return groupSections(sections).map((group, g) => {
    if (group.type === "full") return <Slot key={group.section.id} section={group.section} className={VISIBILITY[group.section.visibility]} preview={preview} />;
    const hasSide = group.rows.some((row) => row.side.length > 0);
    if (!hasSide) {
      // nothing for a sidebar: the main sections take the full width
      return (
        <div key={`block-${g}`} className="flex flex-col gap-8 sm:gap-10">
          {group.rows.flatMap((row) => row.main).map((s) => <Slot key={s.id} section={s} className={`min-w-0 ${VISIBILITY[s.visibility]}`} preview={preview} />)}
        </div>
      );
    }
    /* Real grid ROWS, not two independent columns: pairing the sections into rows
       makes each pair start on the same line at every width. items-start, so a
       short cell does not stretch its panel. Phones render one column, and the
       --o order keeps the main column first and the sidebar after; lg:order-none
       hands the DOM order back to the grid. */
    const rows = group.rows.length;
    return (
      <div key={`block-${g}`} className="grid gap-8 sm:gap-10 lg:grid-cols-3 lg:items-start lg:gap-x-10">
        {group.rows.flatMap((row, r) => [
          <div key={`m${r}`} style={{ "--o": r + 1 } as CSSProperties} className={`order-[var(--o)] min-w-0 flex-col gap-8 empty:hidden sm:gap-10 lg:order-none lg:col-span-2 ${cellDisplay(row.main)}`}>
            {row.main.map((s) => <Slot key={s.id} section={s} className={`min-w-0 ${VISIBILITY[s.visibility]}`} preview={preview} />)}
          </div>,
          <div key={`s${r}`} style={{ "--o": rows + r + 1 } as CSSProperties} className={`order-[var(--o)] min-w-0 flex-col gap-8 empty:hidden sm:gap-10 lg:order-none lg:self-stretch ${cellDisplay(row.side)}`}>
            {row.side.map((s) => <Slot key={s.id} section={s} className={`min-w-0 ${row.side.length === 1 ? "flex-1" : ""} ${VISIBILITY[s.visibility]}`} preview={preview} />)}
          </div>,
        ])}
      </div>
    );
  });
}
