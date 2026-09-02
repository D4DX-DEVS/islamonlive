import Link from "next/link";
import { notFound } from "next/navigation";
import { getStaticPage } from "@/lib/wpPage";
import { stripHtml } from "@/lib/wordpress";

export const revalidate = 3600;

export async function generateMetadata() {
  const page = await getStaticPage("about");
  return page ? { title: stripHtml(page.title) } : {};
}

// the masthead block: chief editor / editor / layout & design. Anything else the
// WP page carries is body copy.
const EDITORIAL = /എഡിറ്റർ|എഡിറ്റര്‍|ഡിസൈൻ|D4 Media/;

export default async function AboutPage() {
  const page = await getStaticPage("about");
  if (!page) notFound();

  const editorial = page.paragraphs.filter((p) => EDITORIAL.test(p));
  const body = page.paragraphs.filter((p) => !EDITORIAL.test(p));

  return (
    <div className="mx-auto max-w-5xl">
      <nav className="mb-3 text-xs text-zinc-500">
        <Link href="/" className="hover:text-purple-800">Home</Link>
        <span className="px-1.5">/</span>
        <span className="text-zinc-700">About Us</span>
      </nav>
      <h1 className="mb-6 text-3xl font-extrabold" dangerouslySetInnerHTML={{ __html: page.title }} />

      <div className="grid gap-5 lg:grid-cols-3">
        {/* editorial masthead — its own card so the names don't run into the copy */}
        <aside className="lg:col-span-1">
          <div className="rounded-xl bg-white p-5 shadow-sm ring-1 ring-zinc-900/10">
            <h2 className="mb-3 inline-flex rounded bg-purple-800 px-3 py-1 text-sm font-semibold text-white">
              എഡിറ്റോറിയല്‍
            </h2>
            <div className="space-y-3 text-sm leading-relaxed text-zinc-700 [&_a]:text-purple-800 [&_a:hover]:underline [&_strong]:text-zinc-900">
              {editorial.map((p, n) => (
                <p key={n} dangerouslySetInnerHTML={{ __html: p }} />
              ))}
            </div>
          </div>
        </aside>

        <div className="lg:col-span-2">
          <div className="rounded-xl bg-white p-5 shadow-sm ring-1 ring-zinc-900/10 sm:p-6">
            <div className="space-y-4 text-[15px] leading-8 text-zinc-800">
              {body.map((p, n) => (
                <p key={n} dangerouslySetInnerHTML={{ __html: p }} />
              ))}
            </div>
            <div className="mt-6 flex flex-wrap gap-3 border-t border-zinc-100 pt-5">
              <Link href="/contact" className="pill rounded-full bg-purple-800 px-4 py-2 text-xs font-semibold text-white hover:bg-purple-700">
                Contact Us
              </Link>
              <a
                href="https://rzp.io/rzp/5bOM6U7A"
                target="_blank"
                rel="noopener noreferrer"
                className="pill rounded-full px-4 py-2 text-xs font-semibold text-purple-800 ring-1 ring-purple-300 hover:bg-purple-50"
              >
                Support Us
              </a>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
