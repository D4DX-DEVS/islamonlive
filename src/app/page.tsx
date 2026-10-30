import InstallBanner from "@/components/InstallBanner";
import HomeSections, { HomeThemeStyle } from "@/components/home/HomeSections";
import { getHomeLayout, getHomeTheme } from "@/lib/home-layout/store";
import { graph, organizationSchema, websiteSchema } from "@/lib/schema";
import JsonLd from "@/components/JsonLd";
import PageView from "@/components/PageView";

export const revalidate = 60;

/* Self-referencing canonical on the front page.

   It matters more here than it looks: next.config folds WordPress's old
   /page/2/ archive URLs onto /?page=N so they cannot 404, and this magazine
   layout renders the same front page for all of them. Pinning the canonical to
   "/" tells Google those are one page, not a series of near-duplicates. */
export const metadata = {
  alternates: { canonical: "/" },
};

/* The sections, their order, titles, categories and counts are the admin's
   Homepage layout (lib/home-layout; components/home/HomeSections renders it).
   Until an administrator saves one, DEFAULT_LAYOUT reproduces the hand-built page. */
export default async function Home() {
  const [sections, theme] = await Promise.all([getHomeLayout(), getHomeTheme()]);
  return (
    // home-theme scopes the admin's page style (fonts, colours, sizes) to the homepage
    <div className="home-theme space-y-8 sm:space-y-12">
      <HomeThemeStyle theme={theme} />
      <PageView kind="home" />
      {/* Organization, WebSite and the SearchAction that earns a sitelinks
          search box, declared once on the front page. Article pages carry their
          own copies inside Yoast's graph, so repeating them in the layout would
          only duplicate the nodes on every route. */}
      <JsonLd data={graph(websiteSchema(), organizationSchema())} />
      {/* The page's one h1 is the site itself, for screen readers and crawlers;
          the top story in the slider is an h2 like every other section head. */}
      <h1 className="sr-only">Islamonlive.in — Comprehensive Islamic portal in Malayalam</h1>
      <HomeSections sections={sections} />
      {/* Install popup. It portals to <body>, so this call site only decides
          which route offers it — the homepage — not where it appears. */}
      <InstallBanner />
    </div>
  );
}
