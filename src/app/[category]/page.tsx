import { notFound } from "next/navigation";
import { getPageBySlug, stripHtml } from "@/lib/wordpress";

export const revalidate = 3600;

// WP static pages (about, contact, privacy-policy, terms-of-use, ...) live at
// single-segment URLs; the param is named "category" to match the sibling
// [category]/[slug] post route (Next.js requires same-position param names to match).
export async function generateMetadata({ params }: { params: Promise<{ category: string }> }) {
  const page = await getPageBySlug((await params).category);
  return page ? { title: stripHtml(page.title.rendered) } : {};
}

export default async function WPPageRoute({ params }: { params: Promise<{ category: string }> }) {
  const page = await getPageBySlug((await params).category);
  if (!page || !page.content.rendered.trim()) notFound();

  return (
    <article className="mx-auto max-w-3xl">
      <h1 className="mb-6 text-3xl font-extrabold" dangerouslySetInnerHTML={{ __html: page.title.rendered }} />
      <div
        className="prose prose-zinc max-w-none prose-a:text-purple-800 prose-img:rounded-lg [&_iframe]:max-w-full"
        dangerouslySetInnerHTML={{ __html: page.content.rendered }}
      />
    </article>
  );
}
