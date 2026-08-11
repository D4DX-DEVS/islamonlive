import Link from "next/link";
import Image from "next/image";
import { WPPost, featuredImage, postPath, primaryCategory, formatDate, stripHtml } from "@/lib/wordpress";

export default function PostCard({ post, showExcerpt = false }: { post: WPPost; showExcerpt?: boolean }) {
  const img = featuredImage(post, true);
  const cat = primaryCategory(post);
  return (
    <article className="group flex h-full flex-col overflow-hidden rounded-lg border border-zinc-200 bg-white shadow-sm transition hover:shadow-md">
      <Link href={postPath(post)} className="flex h-full flex-col">
        {img && (
          <div className="relative aspect-[16/9] w-full overflow-hidden bg-zinc-100">
            <Image src={img.url} alt={img.alt} fill sizes="(max-width: 768px) 100vw, 33vw" className="object-cover transition group-hover:scale-105" />
          </div>
        )}
        <div className="flex flex-1 flex-col p-4">
          {cat && <span className="mb-2 inline-block rounded bg-purple-800 px-2 py-0.5 text-xs font-semibold text-white">{cat.name}</span>}
          <h3 className="line-clamp-2 min-h-[2.75rem] text-base font-bold leading-snug text-zinc-900 group-hover:text-purple-800" dangerouslySetInnerHTML={{ __html: post.title.rendered }} />
          {showExcerpt && <p className="mt-2 line-clamp-3 text-sm text-zinc-600">{stripHtml(post.excerpt.rendered)}</p>}
          <time className="mt-auto block pt-2 text-xs text-zinc-500">{formatDate(post.date)}</time>
        </div>
      </Link>
    </article>
  );
}
