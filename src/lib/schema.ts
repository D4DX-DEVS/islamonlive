import { SITE_URL, siteUrl } from "@/lib/env";
import { rewriteUrl } from "@/lib/urls";

/* JSON-LD we build ourselves.

   On an article Yoast's own @graph is richer than anything reconstructed here,
   so seoSchema() wins whenever the plugin answered; these are the fallback for
   a post it skipped, plus the site-level nodes (Organization, WebSite +
   SearchAction) that belong on the home page and the listing pages Yoast does
   not cover.

   The @id values deliberately match Yoast's own — "{site}/#organization",
   "{site}/#website" — so a page that mixes a hand-built breadcrumb with a Yoast
   article graph still resolves to one entity rather than two competing ones. */

export const ORG_ID = `${SITE_URL}/#organization`;
export const SITE_ID = `${SITE_URL}/#website`;

/* The one name for each entity, used by every page — the metadata module makes
   Yoast's own nodes say the same, so the @ids above resolve to one thing. */
export const SITE_NAME = "Islamonlive.in";
export const ORG_NAME = "Islamonlive";
export const SITE_DESCRIPTION = "Comprehensive Islamic portal in Malayalam - news, opinion, columns, Shariah, Quran and more.";
/* The publisher's own profiles — the four with a real profile page (the
   Telegram/WhatsApp invite links in the footer are not entity pages). A YouTube
   presence is the strongest brand signal the AI search engines go by, and the
   channel already exists; Yoast's Site Identity form only knew two of these. */
export const SAME_AS = [
  "https://www.facebook.com/islamonlive",
  "https://x.com/islamonlive",
  "https://www.youtube.com/@IslamOnlivePortal",
  "https://www.instagram.com/islam.onlive/",
];

/* What the About and Contact pages already tell a reader, as data: founded
   18 June 2012 in Kozhikode under D4 Media, the office address, the editorial
   desk's email. Kept in one place so the hand-built Organization node and
   Yoast's (see seo.ts) describe the same entity with the same facts. */
export function organizationDetails(): Record<string, unknown> {
  return {
    sameAs: SAME_AS,
    foundingDate: "2012-06-18",
    foundingLocation: { "@type": "Place", name: "Kozhikode, Kerala, India" },
    parentOrganization: { "@type": "Organization", name: "D4 Media" },
    email: "editor@islamonlive.in",
    address: {
      "@type": "PostalAddress",
      streetAddress: "Hira Centre, Mavoor Road",
      addressLocality: "Kozhikode",
      addressRegion: "Kerala",
      postalCode: "673004",
      addressCountry: "IN",
    },
    contactPoint: [{ "@type": "ContactPoint", contactType: "editorial", email: "editor@islamonlive.in", availableLanguage: ["ml", "en"] }],
  };
}

/** The sitelinks search box action, pointing at the search page that answers directly. */
export function searchAction(): Record<string, unknown> {
  return {
    "@type": "SearchAction",
    target: { "@type": "EntryPoint", urlTemplate: `${SITE_URL}/search/?q={search_term_string}` },
    "query-input": { "@type": "PropertyValueSpecification", valueRequired: true, valueName: "search_term_string" },
  };
}

export function organizationSchema(): Record<string, unknown> {
  return {
    "@type": "Organization",
    "@id": ORG_ID,
    name: ORG_NAME,
    url: `${SITE_URL}/`,
    logo: {
      "@type": "ImageObject",
      "@id": `${SITE_URL}/#/schema/logo/image/`,
      url: siteUrl("/logo.png"),
      contentUrl: siteUrl("/logo.png"),
      width: 298,
      height: 81,
      caption: ORG_NAME,
    },
    image: { "@id": `${SITE_URL}/#/schema/logo/image/` },
    ...organizationDetails(),
  };
}

/** WebSite + the SearchAction that lets Google offer a sitelinks search box. */
export function websiteSchema(): Record<string, unknown> {
  return {
    "@type": "WebSite",
    "@id": SITE_ID,
    url: `${SITE_URL}/`,
    name: SITE_NAME,
    description: SITE_DESCRIPTION,
    publisher: { "@id": ORG_ID },
    inLanguage: "ml",
    potentialAction: [searchAction()],
  };
}

/** The two nodes every hand-built graph should carry so its `isPartOf` resolves. */
export function siteNodes(): Record<string, unknown>[] {
  return [websiteSchema(), organizationSchema()];
}

export interface BreadcrumbItem {
  name: string;
  /** Site-relative path; omit on the final crumb, which is the current page. */
  path?: string;
}

export function breadcrumbSchema(items: BreadcrumbItem[], pageUrl: string): Record<string, unknown> {
  return {
    "@type": "BreadcrumbList",
    "@id": `${pageUrl}#breadcrumb`,
    itemListElement: items.map((item, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: item.name,
      ...(item.path ? { item: siteUrl(item.path) } : {}),
    })),
  };
}

export interface ArticleSchemaInput {
  url: string;
  headline: string;
  description?: string;
  image?: string | null;
  datePublished: string;
  dateModified?: string;
  authorName?: string;
  authorPath?: string | null;
  section?: string;
  /** News desks get NewsArticle; everything else stays a plain Article. */
  isNews?: boolean;
}

export function articleSchema(a: ArticleSchemaInput): Record<string, unknown> {
  return {
    "@type": a.isNews ? "NewsArticle" : "Article",
    "@id": `${a.url}#article`,
    isPartOf: { "@id": a.url },
    mainEntityOfPage: { "@id": a.url },
    headline: a.headline,
    ...(a.description ? { description: a.description } : {}),
    datePublished: a.datePublished,
    dateModified: a.dateModified ?? a.datePublished,
    ...(a.image ? { image: { "@type": "ImageObject", url: rewriteUrl(a.image, true) } } : {}),
    ...(a.authorName
      ? { author: { "@type": "Person", name: a.authorName, ...(a.authorPath ? { url: siteUrl(a.authorPath) } : {}) } }
      : {}),
    ...(a.section ? { articleSection: [a.section] } : {}),
    publisher: { "@id": ORG_ID },
    inLanguage: "ml",
  };
}

/** A plain page — WP pages and the hand-built ones. AboutPage/ContactPage are schema.org subtypes. */
export function webPageSchema(
  url: string,
  name: string,
  opts: { description?: string; type?: "WebPage" | "AboutPage" | "ContactPage"; mainEntity?: Record<string, unknown> } = {}
): Record<string, unknown> {
  return {
    "@type": opts.type ?? "WebPage",
    "@id": url,
    url,
    name,
    ...(opts.description ? { description: opts.description } : {}),
    // what the page is about — the About and Contact pages are about the publisher
    ...(opts.mainEntity ? { mainEntity: opts.mainEntity } : {}),
    isPartOf: { "@id": SITE_ID },
    inLanguage: "ml",
  };
}

/** A WebPage node for listing pages (category, tag, author, search). */
export function collectionPageSchema(url: string, name: string, description?: string): Record<string, unknown> {
  return {
    "@type": "CollectionPage",
    "@id": url,
    url,
    name,
    ...(description ? { description } : {}),
    isPartOf: { "@id": SITE_ID },
    inLanguage: "ml",
  };
}

/** Wrap nodes into the single @graph document a page embeds. */
export function graph(...nodes: (Record<string, unknown> | null | undefined)[]): Record<string, unknown> {
  return { "@context": "https://schema.org", "@graph": nodes.filter(Boolean) };
}
