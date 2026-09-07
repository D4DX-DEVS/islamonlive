import Link from "next/link";
import ErrorState, { CompassIcon } from "@/components/ErrorState";

/* Every notFound() in the app lands here — a retired author slug, a renamed
   category, an article that moved. Deliberately different copy from error.tsx:
   this is not a failure the reader should sit and retry. */
export default function NotFound() {
  return (
    <ErrorState
      icon={<CompassIcon />}
      title="We can't find that page"
      hint="The link may be old, or the article may have moved somewhere else on the site. Try a search, or start again from the front page."
      action={
        <Link
          href="/"
          className="pill inline-flex min-h-11 items-center rounded-full bg-[#693FE2] px-6 text-sm font-semibold text-white transition hover:bg-[#5a34c7]"
        >
          Go to home
        </Link>
      }
      secondary={{ href: "/search", label: "Search articles" }}
    />
  );
}
