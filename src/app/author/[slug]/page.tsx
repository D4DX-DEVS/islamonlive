import { notFound } from "next/navigation";
import Image from "next/image";
import InfiniteFeed from "@/components/InfiniteFeed";
import { FEED_PER_PAGE } from "@/lib/feed";
import { getUserBySlug, getPosts, userAvatar, stripHtml } from "@/lib/wordpress";

export const revalidate = 60;

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const user = await getUserBySlug((await params).slug);
  return {
    title: user?.name ?? "Author",
    description: user?.description ? stripHtml(user.description).slice(0, 160) : undefined,
  };
}

/* The writer's page: photo, name, bio, then everything they wrote. The live
   site heads its author archive with the same three things (the Elementor
   author box) above a JetEngine listing of the posts. */
export default async function AuthorPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ page?: string }>;
}) {
  const { slug } = await params;
  // kept only so old ?page=N links still resolve; the list scrolls itself now
  const page = Math.max(1, Number((await searchParams).page ?? 1) || 1);
  const user = await getUserBySlug(slug);
  if (!user) notFound();

  const posts = await getPosts({ author: user.id, perPage: FEED_PER_PAGE, page });
  const avatar = userAvatar(user);
  // WP hands the bio back as HTML (paragraphs, <br>, the odd inline style)
  const bio = user.description?.trim() ?? "";

  return (
    <div>
      <section className="mb-8 overflow-hidden rounded-2xl bg-white shadow-[0_4px_24px_rgba(0,0,0,0.06)] ring-1 ring-black/5">
        <div className="h-20 bg-gradient-to-r from-[#31094C] via-[#4A1E9E] to-[#693FE2] sm:h-24" />
        <div className="px-5 pb-6 sm:px-8">
          <div className="-mt-12 flex flex-col items-center text-center sm:-mt-14 sm:flex-row sm:items-end sm:gap-5 sm:text-left">
            {avatar ? (
              <Image
                src={avatar}
                alt=""
                width={144}
                height={144}
                unoptimized
                className="h-24 w-24 shrink-0 rounded-full object-cover ring-4 ring-white shadow-md sm:h-28 sm:w-28"
              />
            ) : (
              <span className="flex h-24 w-24 shrink-0 items-center justify-center rounded-full bg-zinc-200 text-zinc-500 ring-4 ring-white shadow-md sm:h-28 sm:w-28">
                <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden className="h-12 w-12">
                  <path d="M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm0 1.8c-3.2 0-7 1.7-7 3.9V20h14v-2.3c0-2.2-3.8-3.9-7-3.9Z" />
                </svg>
              </span>
            )}
            <div className="mt-3 min-w-0 sm:mt-0 sm:pb-1">
              <p className="pill text-[11px] font-semibold uppercase tracking-[0.14em] text-[#693FE2]">Author</p>
              <h1 className="mt-1 text-2xl font-extrabold leading-tight text-zinc-900 [overflow-wrap:anywhere] sm:text-3xl">{user.name}</h1>
            </div>
          </div>
          {bio && (
            <div
              className="prose prose-sm prose-zinc mt-4 max-w-3xl leading-relaxed text-zinc-600 [&_p]:my-1.5 [&_*]:!text-left"
              dangerouslySetInnerHTML={{ __html: bio }}
            />
          )}
        </div>
      </section>

      <h2 className="mb-4 border-l-4 border-purple-800 pl-3 text-xl font-extrabold">Articles by {user.name}</h2>
      <InfiniteFeed initial={posts} query={{ kind: "author", id: user.id }} startPage={page} />
    </div>
  );
}
