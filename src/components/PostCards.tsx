import Link from "next/link";
import Image from "next/image";
import Byline from "@/components/Byline";

/** plain, serializable post shape — usable from server and client components alike */
export interface PostItem {
  href: string;
  img: string | null;
  title: string;
  category: string;
  author?: string;
  authorAvatar?: string | null;
  date: string;
  excerpt?: string;
}

/* image card with gradient overlay + chip + title — live-site hero/right-column style */
export function OverlayCard({ item, className = "" }: { item: PostItem; className?: string }) {
  return (
    <Link href={item.href} className={`group relative block overflow-hidden rounded-xl bg-zinc-900 ${className}`}>
      {item.img && (
        <Image src={item.img} alt="" fill sizes="(max-width: 1024px) 100vw, 33vw" className="object-cover object-top transition duration-500 group-hover:scale-105" />
      )}
      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/25 to-transparent" />
      <div className="absolute inset-x-0 bottom-0 p-4">
        {item.category && (
          <span className="pill mb-1.5 inline-flex items-center justify-center rounded bg-purple-700 px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-white">{item.category}</span>
        )}
        <h3 className="line-clamp-2 text-base font-bold leading-snug text-white lg:text-lg" dangerouslySetInnerHTML={{ __html: item.title }} />
        <Byline className="mt-1.5" light name={item.author} avatar={item.authorAvatar} date={item.date} />
      </div>
    </Link>
  );
}

/* compact card: optional thumb + title + byline */
/* `compact` is the sidebar's size: the right column is half the width of a main
   cell, so the same row there costs a lot more vertical space per headline. A
   smaller thumb and a step down in title size buy back ~15px a row, which is what
   lets a sidebar list end level with the section beside it. */
export function ListRow({ item, thumb = true, compact = false }: { item: PostItem; thumb?: boolean; compact?: boolean }) {
  return (
    <Link
      href={item.href}
      className={`group flex gap-3 rounded-xl border border-zinc-200/80 bg-white shadow-sm transition duration-200 hover:-translate-y-0.5 hover:border-purple-200 hover:shadow-md ${compact ? "p-2.5" : "p-3"}`}
    >
      {thumb && item.img && (
        <div className={`relative shrink-0 overflow-hidden rounded-lg bg-zinc-100 ${compact ? "h-14 w-20" : "h-16 w-24"}`}>
          <Image src={item.img} alt="" fill sizes={compact ? "80px" : "96px"} className="object-cover transition duration-500 group-hover:scale-105" />
        </div>
      )}
      <div className="min-w-0">
        {/* phones: 3 lines so long Malayalam titles fit; desktop rows stay 2 */}
        <h3
          className={`line-clamp-3 min-h-[2.75em] [overflow-wrap:anywhere] font-bold leading-snug group-hover:text-purple-800 sm:line-clamp-2 ${compact ? "text-sm" : "text-[15px]"}`}
          dangerouslySetInnerHTML={{ __html: item.title }}
        />
        <Byline className="mt-1.5" name={item.author} avatar={item.authorAvatar} date={item.date} />
      </div>
    </Link>
  );
}
