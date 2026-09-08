import Link from "next/link";
import ErrorState, { CompassIcon } from "@/components/ErrorState";
import SearchBox from "@/components/SearchBox";

// its own title: the layout default would label every dead link with the
// site tagline, in the tab and in Search Console's "not found" rows alike
export const metadata = { title: "Page not found" };

// routes this app owns — never a guessed category slug that could itself 404
const SECTIONS = [
  { href: "/", label: "Front page" },
  { href: "/authors-list/", label: "Authors" },
  { href: "/watch-videos/", label: "Videos" },
  { href: "/reels/", label: "Reels" },
  { href: "/listen/", label: "Listen" },
];

/* Every notFound() in the app lands here — a retired author slug, a renamed
   category, an article that moved. Deliberately different copy from error.tsx:
   this is not a failure the reader should sit and retry. The search box sits
   right under the message, because "the link may be old" is only useful with
   a next step already in reach. */
export default function NotFound() {
  return (
    <div className="space-y-6">
      <ErrorState
        icon={<CompassIcon />}
        title="We can't find that page"
        hint="The link may be old, or the article may have moved somewhere else on the site. Search for it below, or start again from the front page."
        action={
          <Link
            href="/"
            className="pill inline-flex min-h-11 items-center rounded-full bg-[#693FE2] px-6 text-sm font-semibold text-white transition hover:bg-[#5a34c7]"
          >
            Go to home
          </Link>
        }
      />
      <div className="mx-auto max-w-lg">
        <SearchBox />
      </div>
      <nav aria-label="Popular sections" className="flex flex-wrap justify-center gap-2 text-sm">
        {SECTIONS.map((s) => (
          <Link key={s.href} href={s.href} className="pill rounded-full bg-white px-4 py-2 font-semibold text-purple-800 ring-1 ring-purple-200 hover:bg-purple-50">
            {s.label}
          </Link>
        ))}
      </nav>
    </div>
  );
}
