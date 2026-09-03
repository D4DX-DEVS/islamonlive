import Image from "next/image";

interface BylineProps {
  name?: string;
  avatar?: string | null;
  date: string;
  /** dark backgrounds (overlay cards, hero) */
  light?: boolean;
  className?: string;
}

/* author avatar as a small round icon on the left of the name.
   No avatar → generic silhouette, not the initial: a Malayalam first letter
   renders as a half-formed cluster and reads as a glitch. */
export default function Byline({ name, avatar, date, light = false, className = "" }: BylineProps) {
  return (
    // wraps rather than truncates: a clipped Malayalam name loses whole
    // syllables, and on a phone-width card the old `truncate` cut most of them
    <p className={`flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-xs ${light ? "text-zinc-300" : "text-zinc-500"} ${className}`}>
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
            <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-zinc-200 text-zinc-500">
              <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden className="h-3.5 w-3.5">
                <path d="M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm0 1.8c-3.2 0-7 1.7-7 3.9V20h14v-2.3c0-2.2-3.8-3.9-7-3.9Z" />
              </svg>
            </span>
          )}
          <span className={`min-w-0 font-medium [overflow-wrap:anywhere] ${light ? "text-white" : "text-zinc-700"}`}>{name}</span>
          {/* the separator travels with the date, so a wrapped name never
              leaves a dangling middot at the end of its line */}
          <span className="shrink-0 whitespace-nowrap">
            <span aria-hidden>·</span> {date}
          </span>
        </>
      )}
      {!name && <span className="shrink-0">{date}</span>}
    </p>
  );
}
