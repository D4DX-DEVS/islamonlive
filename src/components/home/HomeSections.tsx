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
import { embedFor, groupSections, isScheduledOn, todayInIndia, KIND_LABELS, type BannerItem, type CustomSection, type HomeSection, type HeroSection, type ImageShape, type PostsSection, type Visibility } from "@/lib/home-layout/schema";
import { lookStyle, PREVIEW_SITE_SCOPE, spacingCss, themeCss, type HomeTheme } from "@/lib/home-layout/theme";

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

export function SectionHead({ title, href, linkLabel = "", light = false }: { title: string; href?: string; /** "" = "See all". */ linkLabel?: string; light?: boolean }) {
  if (!title) return null;
  return (
    <div className={`mb-3 flex items-center justify-between border-l-4 pl-3 pr-2 sm:mb-4 ${light ? "border-purple-500" : "border-purple-800"}`}>
      <h2 className={`text-xl font-extrabold ${light ? "text-white" : "text-zinc-900"}`}>{title}</h2>
      {href && <Link href={href} className={`text-sm font-medium hover:underline ${light ? "text-purple-300" : "text-purple-800"}`}>{linkLabel || "See all"} →</Link>}
    </div>
  );
}

function SideList({ title, href, linkLabel, posts }: { title: string; href?: string; linkLabel: string; posts: WPPost[] }) {
  const [first, ...rest] = posts;
  return (
    // h-full + flex: the cell is stretched to its grid row (lg:self-stretch), and
    // the card takes whatever the list leaves over, so the column ends level with
    // the section beside it at every width
    <aside className="flex h-full flex-col">
      <SectionHead title={title} href={href} linkLabel={linkLabel} />
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

async function Reels({ title, href, linkLabel, count, bare }: { title: string; href: string; linkLabel: string; count: number; /** The section's look supplies the box. */ bare: boolean }) {
  const reels = await getReels(Math.max(count, 8)).catch(() => []);
  const items = reels.length ? reels : await getShorts(Math.max(count, 8)).catch(() => []);
  if (!items.length) return null;
  return (
    <section className={bare ? undefined : "rounded-2xl bg-zinc-100 p-4 sm:rounded-xl sm:p-6"}>
      <SectionHead title={title} href={href || undefined} linkLabel={linkLabel} />
      <ReelsLightbox items={items.slice(0, count)} />
    </section>
  );
}

async function Banners({ items }: { items: BannerItem[] }) {
  if (items.length) {
    // set in the builder: shown wherever the section's "Show on" allows. Admin-entered
    // addresses may be on any host, so they skip the image optimizer, like ImageBanner
    return (
      <div className="space-y-4">
        {items.map((b, n) => <ImageBanner key={`${b.img}-${n}`} img={b.img} href={b.href} alt={b.alt} width={b.width} height={b.height} />)}
      </div>
    );
  }
  const banners = await getHomeBanners().catch(() => []);
  if (!banners.length) return null;
  // the saved strip stays hidden on phones, as the Elementor strip was
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

async function Watch({ title, href, linkLabel, count, bare }: { title: string; href: string; linkLabel: string; count: number; bare: boolean }) {
  const videos = await getVideos(count).catch(() => []);
  if (!videos.length) return null;
  return (
    // data-surface: the page style's text colour is for light backgrounds, so it stays off this panel
    <section data-surface="dark" className={bare ? undefined : "rounded-2xl bg-zinc-900 p-4 sm:rounded-xl sm:p-6"}>
      <SectionHead title={title} href={href || undefined} linkLabel={linkLabel} light />
      <WatchPanel videos={videos} />
    </section>
  );
}

async function Listen({ title, href, linkLabel, perPage }: { title: string; href: string; linkLabel: string; perPage: number }) {
  // the player pages through them perPage at a time
  const episodes = await getEpisodes(40).catch(() => []);
  if (!episodes.length) return null;
  return (
    <section>
      <SectionHead title={title} href={href || undefined} linkLabel={linkLabel} />
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

/** Free text, an optional button and an optional embedded player, form or map. */
function Custom({ section }: { section: CustomSection }) {
  const embed = section.embedUrl ? embedFor(section.embedUrl) : null;
  const paragraphs = section.text.split(/\n{2,}/).filter(Boolean);
  if (!section.title && !paragraphs.length && !embed && !(section.buttonLabel && section.buttonHref)) return null;
  const centre = section.align === "center";
  const external = !section.buttonHref.startsWith("/");
  return (
    <section className={centre ? "text-center" : undefined}>
      {section.title && (centre ? <h2 className="mb-3 text-xl font-extrabold text-zinc-900 sm:mb-4">{section.title}</h2> : <SectionHead title={section.title} />)}
      {paragraphs.length > 0 && (
        <div className={`space-y-3 text-base leading-relaxed text-zinc-700 ${centre ? "mx-auto max-w-2xl" : "max-w-3xl"}`}>
          {/* plain text: line breaks inside a paragraph are kept, nothing is parsed as HTML */}
          {paragraphs.map((text, n) => <p key={n} className="whitespace-pre-line">{text}</p>)}
        </div>
      )}
      {section.buttonLabel && section.buttonHref && (
        <a href={section.buttonHref} target={external ? "_blank" : undefined} rel={external ? "noopener noreferrer" : undefined} className="mt-4 inline-flex min-h-11 items-center justify-center rounded-full bg-purple-800 px-6 text-sm font-semibold text-white transition hover:bg-purple-900">
          {section.buttonLabel}
        </a>
      )}
      {embed && (
        <div className={`mt-4 overflow-hidden rounded-xl bg-zinc-100 ${centre ? "mx-auto max-w-3xl" : ""}`}>
          <iframe src={embed.src} title={embed.title} loading="lazy" sandbox="allow-scripts allow-same-origin allow-presentation allow-popups allow-popups-to-escape-sandbox allow-forms" allow="autoplay; encrypted-media; picture-in-picture; fullscreen" referrerPolicy="strict-origin-when-cross-origin" allowFullScreen className="block w-full border-0" style={embed.aspect ? { aspectRatio: embed.aspect } : { height: embed.height }} />
        </div>
      )}
    </section>
  );
}

/* Literal class names, so Tailwind sees every one of them. */
const SHAPE: Record<Exclude<ImageShape, "">, string> = { wide: "aspect-[16/10]", video: "aspect-video", square: "aspect-square", tall: "aspect-[4/5]" };
const LG_COLS = ["", "lg:grid-cols-1", "lg:grid-cols-2", "lg:grid-cols-3", "lg:grid-cols-4", "lg:grid-cols-5", "lg:grid-cols-6"];

/** The card container: a grid from sm up; on phones either stacked or one row that swipes. */
function cardRow(section: PostsSection, lg: string, sm = "sm:grid-cols-2"): { box: string; item: string } {
  const swipe = section.phoneLayout === "row";
  return {
    box: `${swipe ? "scrollbar-none flex overflow-x-auto sm:grid" : "grid grid-cols-1"} gap-4 sm:gap-5 ${sm} ${lg}`,
    item: swipe ? "w-64 flex-none sm:w-auto" : "",
  };
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
    return section.style === "tabbed" ? <TabbedSection title={section.title} tabs={tabs} linkLabel={section.linkLabel} /> : <SideListTabs title={section.title} tabs={tabs} rows={section.count} linkLabel={section.linkLabel} />;
  }
  if (!posts.length) return null;

  if (section.style === "featured_list") return <SideList title={section.title} href={href || undefined} linkLabel={section.linkLabel} posts={posts} />;

  const shape = section.imageShape ? SHAPE[section.imageShape] : "";
  if (section.style === "slider") {
    return (
      <section>
        <SectionHead title={section.title} href={href || undefined} linkLabel={section.linkLabel} />
        <div className="scrollbar-none flex gap-4 overflow-x-auto">
          {posts.map((p) => <OverlayCard key={p.id} item={toItem(p)} className={`${shape || SHAPE.wide} w-64 flex-none`} />)}
        </div>
      </section>
    );
  }

  if (section.style === "portrait_grid") {
    return (
      <section>
        <SectionHead title={section.title} href={href || undefined} linkLabel={section.linkLabel} />
        {/* phones: horizontal slider (or stacked pairs); ≥sm: grid. The automatic 5-wide desktop row drops the 6th */}
        <div className={`${section.phoneLayout === "row" ? "scrollbar-none flex overflow-x-auto sm:grid" : "grid grid-cols-2"} gap-4 sm:grid-cols-3 ${section.columns ? LG_COLS[section.columns] : "lg:grid-cols-5 lg:[&>*:nth-child(6)]:hidden"}`}>
          {posts.map((p) => {
            const img = featuredImage(p);
            return (
              <Link key={p.id} href={postPath(p)} className={`group ${section.phoneLayout === "row" ? "w-40 flex-none sm:w-auto" : ""}`}>
                {/* ring, not a plain bg — light-background infographics need an edge to read against the page */}
                <div className={`relative ${shape || SHAPE.tall} w-full overflow-hidden rounded-lg bg-zinc-100 shadow-sm ring-1 ring-inset ring-zinc-900/10 transition group-hover:shadow-md group-hover:ring-purple-300`}>
                  {img && <Image src={img.url} alt="" fill sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 20vw" className="object-cover transition group-hover:scale-105" />}
                </div>
                <h3 className="mt-2 line-clamp-2 hidden text-sm font-bold leading-snug text-zinc-900 group-hover:text-purple-800 sm:block" dangerouslySetInnerHTML={{ __html: p.title.rendered }} />
                <time data-meta="date" className="mt-1 hidden text-xs text-zinc-500 sm:block">{formatDate(p.date)}</time>
              </Link>
            );
          })}
        </div>
      </section>
    );
  }

  // list: one headline row under another (thumbnail + title + byline); columns side by side only when asked
  if (section.style === "list") {
    const columns = section.placement === "side" ? 1 : section.columns || 1;
    return (
      <section>
        <SectionHead title={section.title} href={href || undefined} linkLabel={section.linkLabel} />
        <div className={`grid grid-cols-1 gap-3 ${columns > 1 ? "sm:grid-cols-2" : ""} ${LG_COLS[columns]}`}>
          {posts.map((p) => <ListRow key={p.id} item={toItem(p, true)} compact={section.placement === "side"} />)}
        </div>
      </section>
    );
  }

  // grid: a featured card row for wide placements, rows in a sidebar
  const row = cardRow(section, section.columns ? LG_COLS[section.columns] : section.placement === "full" ? "lg:grid-cols-4" : "lg:grid-cols-3", section.columns === 1 ? "" : "sm:grid-cols-2");
  return (
    <section>
      <SectionHead title={section.title} href={href || undefined} linkLabel={section.linkLabel} />
      {section.placement === "side" ? (
        <div className="space-y-3">{posts.map((p) => <ListRow key={p.id} item={toItem(p, true)} compact />)}</div>
      ) : (
        <div className={row.box}>
          {posts.map((p) => <OverlayCard key={p.id} item={toItem(p)} className={`${shape || SHAPE.wide} ${row.item}`} />)}
        </div>
      )}
    </section>
  );
}

function SectionBody({ section }: { section: HomeSection }) {
  const bare = section.look.background !== "";
  switch (section.kind) {
    case "hero": return <Hero section={section} />;
    case "reels": return <Reels title={section.title} href={section.href} linkLabel={section.linkLabel} count={section.count} bare={bare} />;
    case "banners": return <Banners items={section.items} />;
    case "watch": return <Watch title={section.title} href={section.href} linkLabel={section.linkLabel} count={section.count} bare={bare} />;
    case "listen": return <Listen title={section.title} href={section.href} linkLabel={section.linkLabel} perPage={section.perPage} />;
    case "custom": return <Custom section={section} />;
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

/** One section's box: its look (background, accent, hidden card details) and, in the builder preview, the id and name the builder outlines and selects by. */
function Slot({ section, className = "", preview, today }: { section: HomeSection; className?: string; preview: boolean; today: string }) {
  const body = <SectionBody section={section} />;
  const look = lookStyle(section.look);
  const styled = Object.keys(look.style).length > 0;
  const classes = `${className} ${look.boxed ? "rounded-2xl p-4 sm:rounded-xl sm:p-6" : ""}`.trim();
  const tone = look.dark ? "dark" : undefined;
  const hide = section.look.hide.length ? section.look.hide.join(" ") : undefined;
  if (!preview) return classes || styled || tone || hide ? <div className={classes || undefined} style={styled ? look.style : undefined} data-tone={tone} data-hide={hide}>{body}</div> : body;
  const name = ("title" in section && section.title) || KIND_LABELS[section.kind];
  // the preview shows scheduled sections whatever the date, so say when readers will see them
  const label = isScheduledOn(section, today) ? name : `${name} · not shown today (${section.showFrom ? `from ${section.showFrom}` : ""}${section.showFrom && section.showUntil ? " " : ""}${section.showUntil ? `until ${section.showUntil}` : ""})`;
  // the builder sets data-selected from outside React, often before hydration
  return <div className={classes || undefined} style={styled ? look.style : undefined} data-tone={tone} data-hide={hide} data-section-id={section.id} data-section-label={label} suppressHydrationWarning>{body}</div>;
}

/**
 * The page style as one stylesheet; every value in it is validated
 * (lib/home-layout/theme). On the homepage it is scoped to .home-theme unless
 * the style applies site-wide, in which case the root layout already carries
 * it; the builder preview always renders the draft's own style.
 */
export function HomeThemeStyle({ theme, preview = false }: { theme: HomeTheme; preview?: boolean }) {
  const css = theme.scope === "home" ? themeCss(theme) : preview ? themeCss(theme, PREVIEW_SITE_SCOPE, PREVIEW_SITE_SCOPE, `${PREVIEW_SITE_SCOPE} main`) : "";
  return <style dangerouslySetInnerHTML={{ __html: `${css}\n${spacingCss(theme)}` }} />;
}

/** Every enabled section in layout order, full-width rows and the paired two-column blocks. */
export default function HomeSections({ sections, preview = false }: { sections: HomeSection[]; /** Mark each section for the admin builder, and show scheduled ones whatever the date. */ preview?: boolean }) {
  const today = todayInIndia();
  const shown = preview ? sections : sections.filter((s) => isScheduledOn(s, today));
  return groupSections(shown).map((group, g) => {
    if (group.type === "full") return <Slot key={group.section.id} section={group.section} className={VISIBILITY[group.section.visibility]} preview={preview} today={today} />;
    const hasSide = group.rows.some((row) => row.side.length > 0);
    if (!hasSide) {
      // nothing for a sidebar: the main sections take the full width
      return (
        <div key={`block-${g}`} data-home-block className="flex flex-col gap-8 sm:gap-10">
          {group.rows.flatMap((row) => row.main).map((s) => <Slot key={s.id} section={s} className={`min-w-0 ${VISIBILITY[s.visibility]}`} preview={preview} today={today} />)}
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
      <div key={`block-${g}`} data-home-block className="grid gap-8 sm:gap-10 lg:grid-cols-3 lg:items-start lg:gap-x-10">
        {group.rows.flatMap((row, r) => [
          <div key={`m${r}`} data-home-block style={{ "--o": r + 1 } as CSSProperties} className={`order-[var(--o)] min-w-0 flex-col gap-8 empty:hidden sm:gap-10 lg:order-none lg:col-span-2 ${cellDisplay(row.main)}`}>
            {row.main.map((s) => <Slot key={s.id} section={s} className={`min-w-0 ${VISIBILITY[s.visibility]}`} preview={preview} today={today} />)}
          </div>,
          <div key={`s${r}`} data-home-block style={{ "--o": rows + r + 1 } as CSSProperties} className={`order-[var(--o)] min-w-0 flex-col gap-8 empty:hidden sm:gap-10 lg:order-none lg:self-stretch ${cellDisplay(row.side)}`}>
            {row.side.map((s) => <Slot key={s.id} section={s} className={`min-w-0 ${row.side.length === 1 ? "flex-1" : ""} ${VISIBILITY[s.visibility]}`} preview={preview} today={today} />)}
          </div>,
        ])}
      </div>
    );
  });
}
