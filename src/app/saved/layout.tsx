import type { Metadata } from "next";

/* /saved is the reader's own bookmark list, held in their browser. A client
   component cannot export metadata, so the robots directive lives on this
   layout: the page is different for every visitor and empty for a crawler, and
   an indexed copy would only ever be a thin page. */
export const metadata: Metadata = {
  robots: { index: false, follow: true },
  alternates: { canonical: "/saved/" },
};

export default function SavedLayout({ children }: { children: React.ReactNode }) {
  return children;
}
