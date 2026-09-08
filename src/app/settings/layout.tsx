import type { Metadata } from "next";

/* /settings is per-device reading preferences. Same reasoning as app/saved:
   the client page cannot declare metadata itself, and there is nothing here a
   search engine should list. */
export const metadata: Metadata = {
  robots: { index: false, follow: true },
  alternates: { canonical: "/settings/" },
};

export default function SettingsLayout({ children }: { children: React.ReactNode }) {
  return children;
}
