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
export function ListRow({ item, thumb = true }: { item: PostItem; thumb?: boolean }) {
  return (
    <Link
      href={item.href}
      className="group flex gap-3 rounded-xl border border-zinc-200/80 bg-white p-3 shadow-sm transition duration-200 hover:-translate-y-0.5 hover:border-purple-200 hover:shadow-md"
    >
      {thumb && item.img && (
        <div className="relative h-16 w-24 shrink-0 overflow-hidden rounded-lg bg-zinc-100">
          <Image src={item.img} alt="" fill sizes="96px" className="object-cover transition duration-500 group-hover:scale-105" />
        </div>
      )}
      <div className="min-w-0">
        {/* phones: 3 lines so long Malayalam titles fit; desktop rows stay 2 */}
        <h3 className="line-clamp-3 min-h-[2.75em] [overflow-wrap:anywhere] text-[15px] font-bold leading-snug group-hover:text-purple-800 sm:line-clamp-2" dangerouslySetInnerHTML={{ __html: item.title }} />
        <Byline className="mt-1.5" name={item.author} avatar={item.authorAvatar} date={item.date} />
      </div>
    </Link>
  );
}
