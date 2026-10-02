import Image from "next/image";
import { Icon } from "./icons";

/** A person's uploaded photo, or a plain silhouette (an initial looks wrong for Malayalam names). */
export default function Avatar({ src, className = "h-8 w-8" }: { src?: string | null; className?: string }) {
  return src
    ? <Image src={src} alt="" width={64} height={64} sizes="32px" className={`${className} shrink-0 rounded-full bg-slate-100 object-cover ring-1 ring-slate-200`} />
    : <span aria-hidden className={`${className} flex shrink-0 items-center justify-center rounded-full bg-slate-100 text-slate-400 ring-1 ring-slate-200`}><Icon name="user" className="h-1/2 w-1/2" /></span>;
}
