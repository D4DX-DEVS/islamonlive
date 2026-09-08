import Link from "next/link";
import { notFound } from "next/navigation";
import { getStaticPage } from "@/lib/wpPage";
import { stripHtml } from "@/lib/wordpress";
import { seoMetadata, seoSchema } from "@/lib/seo";
import { breadcrumbSchema, graph, webPageSchema } from "@/lib/schema";
import { siteUrl } from "@/lib/env";
import JsonLd from "@/components/JsonLd";

export const revalidate = 3600;

// no entries: rendered on first request, then cached like a static page
export function generateStaticParams(): { category: string }[] {
  return [];
}

// WP static pages (privacy-policy, terms-of-use, donate, ...) live at
// single-segment URLs; the param is named "category" to match the sibling
// [category]/[slug] post route (Next.js requires same-position param names to match).
/* notFound() belongs here, not in the component — this route has a loading.tsx,
   so by the time the component runs the 200 has already been flushed and a
   notFound() there would render the right page with the wrong status. See the
   longer note in [category]/[...slug]/page.tsx. */
export async function generateMetadata({ params }: { params: Promise<{ category: string }> }) {
  const { category } = await params;
  const page = await getStaticPage(category);
  if (!page || !page.html.trim()) notFound();

  return seoMetadata(page.seo, {
    path: page.path,
    title: stripHtml(page.title),
    modifiedTime: page.modified,
    type: "website",
  });
}

export default async function WPPageRoute({ params }: { params: Promise<{ category: string }> }) {
  const page = await getStaticPage((await params).category);
  if (!page || !page.html.trim()) notFound();
  const title = stripHtml(page.title);
  const url = siteUrl(page.path);

  return (
    <div className="mx-auto max-w-4xl">
      <JsonLd
        data={
          seoSchema(page.seo) ??
          graph(webPageSchema(url, title), breadcrumbSchema([{ name: "Home", path: "/" }, { name: title }], url))
        }
      />
      <nav className="mb-3 hidden text-xs text-zinc-500 sm:block">
        <Link href="/" className="hover:text-purple-800">Home</Link>
        <span className="px-1.5">/</span>
        <span className="text-zinc-700">{title}</span>
      </nav>
      <h1 className="mb-6 text-3xl font-extrabold" dangerouslySetInnerHTML={{ __html: page.title }} />

      {/* same white panel the About/Contact pages use — the raw Elementor markup
          rendered straight onto the page background read as an unstyled document */}
      <article className="rounded-xl bg-white p-5 shadow-sm ring-1 ring-zinc-900/10 sm:p-7">
        <div
          className="prose prose-zinc max-w-none prose-headings:font-extrabold prose-h2:text-xl prose-h3:text-lg prose-a:text-purple-800 prose-img:rounded-lg [&_iframe]:max-w-full"
          dangerouslySetInnerHTML={{ __html: page.html }}
        />
      </article>
    </div>
  );
}
