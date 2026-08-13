import Image from "next/image";

interface BylineProps {
  name?: string;
  avatar?: string | null;
  date: string;
  /** dark backgrounds (overlay cards, hero) */
  light?: boolean;
  className?: string;
}

/* author avatar as a small round icon on the left of the name */
export default function Byline({ name, avatar, date, light = false, className = "" }: BylineProps) {
  return (
    <p className={`flex items-center gap-1.5 text-xs ${light ? "text-zinc-300" : "text-zinc-500"} ${className}`}>
      {name && (
        <>
          {avatar ? (
            <Image
              src={avatar}
              alt=""
              width={20}
              height={20}
              className="h-5 w-5 shrink-0 rounded-full object-cover ring-1 ring-black/10"
              unoptimized
            />
          ) : (
            <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-purple-100 text-[10px] font-bold uppercase text-purple-800">
              {name.trim().charAt(0)}
            </span>
          )}
          <span className={`truncate font-medium ${light ? "text-white" : "text-zinc-700"}`}>{name}</span>
          <span aria-hidden>·</span>
        </>
      )}
      <span className="shrink-0">{date}</span>
    </p>
  );
}
