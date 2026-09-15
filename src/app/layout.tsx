import type { Metadata, Viewport } from "next";
import { Noto_Sans_Malayalam, Anek_Malayalam, Noto_Serif_Malayalam, Manjari } from "next/font/google";
import "./globals.css";
import Header, { NavPreviewItem } from "@/components/Header";
import Footer from "@/components/Footer";
import BackToTop from "@/components/BackToTop";
import MobileTabBar from "@/components/MobileTabBar";
import PwaSetup from "@/components/PwaSetup";
import ReadingPrefsSetup from "@/components/ReadingPrefsSetup";
import ImageRetry from "@/components/ImageRetry";
import { getPosts, featuredImage, postPath, primaryCategory, formatDate } from "@/lib/wordpress";
import { SITE_URL } from "@/lib/env";

// which categories feed each nav item's hover preview
const NAV_PREVIEW: Record<string, number[]> = {
  Read: [38, 3, 4, 28],
  Infographics: [28546],
};

async function navPreviews(): Promise<Record<string, NavPreviewItem[]>> {
  const entries = await Promise.all(
    Object.entries(NAV_PREVIEW).map(async ([label, categories]) => {
      const posts = await getPosts({ perPage: 4, categories }).catch(() => []);
      return [
        label,
        posts.map((p) => ({
          href: postPath(p),
          img: featuredImage(p, true)?.url ?? null,
          title: p.title.rendered,
          category: primaryCategory(p)?.name ?? "",
          date: formatDate(p.date),
        })),
      ] as const;
    })
  );
  return Object.fromEntries(entries);
}

const notoMalayalam = Noto_Sans_Malayalam({ subsets: ["malayalam", "latin"], variable: "--font-noto-ml", display: "swap" });
// headings/titles
const anekMalayalam = Anek_Malayalam({ subsets: ["malayalam", "latin"], variable: "--font-anek-ml", display: "swap" });
// the two extra faces /settings offers for the article body. They are only ever
// applied through --read-font, so nothing outside a post can pull them in
const serifMalayalam = Noto_Serif_Malayalam({ subsets: ["malayalam", "latin"], variable: "--font-serif-ml", display: "swap", preload: false });
const manjari = Manjari({ subsets: ["malayalam", "latin"], weight: ["400", "700"], variable: "--font-manjari", display: "swap", preload: false });

export const metadata: Metadata = {
  // every relative URL in a child page's metadata resolves against this, so it
  // has to be the public site and never the WordPress backend
  metadataBase: new URL(SITE_URL),
  title: {
    default: "Islamonlive.in | The one and only Comprehensive Islamic portal in Malayalam",
    template: "%s | Islamonlive.in",
  },
  description: "Comprehensive Islamic portal in Malayalam - news, opinion, columns, Shariah, Quran and more.",
  /* Site-wide social defaults. Pages with a WordPress twin replace these
     wholesale through seoMetadata(); the hand-built pages (home, listen,
     reels, search, the 404) inherit them, so a share of any URL on the
     site carries a title, a description and an image. */
  openGraph: {
    type: "website",
    siteName: "Islamonlive.in",
    locale: "ml_IN",
    url: "/",
    title: "Islamonlive.in | The one and only Comprehensive Islamic portal in Malayalam",
    description: "Comprehensive Islamic portal in Malayalam - news, opinion, columns, Shariah, Quran and more.",
    images: [{ url: "/icon-512.png", width: 512, height: 512, type: "image/png" }],
  },
  twitter: { card: "summary_large_image", title: "Islamonlive.in", description: "Comprehensive Islamic portal in Malayalam - news, opinion, columns, Shariah, Quran and more.", images: ["/icon-512.png"] },
  appleWebApp: { capable: true, statusBarStyle: "default", title: "Islamonlive" },
  icons: { icon: "/icon-192.png", apple: "/icon-192.png" },
};

export const viewport: Viewport = {
  themeColor: "#31094C",
  width: "device-width",
  initialScale: 1,
  // the site is responsive down to 320px, so zoom only ever fires by accident —
  // a stray pinch or a double tap on a card left readers on a half-panned page
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const previews = await navPreviews();
  return (
    <html lang="ml">
      <body className={`${notoMalayalam.variable} ${anekMalayalam.variable} ${serifMalayalam.variable} ${manjari.variable} bg-zinc-50 font-sans text-zinc-900 antialiased flex min-h-dvh flex-col`}>
        {/* Every card image comes from Photon, and the first one pays for the DNS
            lookup and TLS handshake before a byte moves — ~200ms of the ~700ms a
            cold rendition takes. Opening that connection while the HTML is still
            parsing takes it off the critical path. No crossOrigin: an <img> is a
            plain no-cors request and a CORS preconnect would open the wrong
            connection and be ignored. */}
        <link rel="preconnect" href="https://i0.wp.com" />
        <link rel="dns-prefetch" href="https://i0.wp.com" />
        {/* feed autodiscovery — WordPress printed this in <head>; React hoists it there from here */}
        <link rel="alternate" type="application/rss+xml" title="Islamonlive.in" href={`${SITE_URL}/feed/`} />
        <Header previews={previews} />
        {/* paper masthead — the on-screen <header> is display:none when printing */}
        <div className="hidden print:block print:border-b print:border-zinc-400 print:pb-3 print:text-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo.png" alt="islamonlive" className="mx-auto h-10 w-auto" />
        </div>
        <main className="mx-auto w-full max-w-[1600px] flex-1 px-4 py-5 sm:px-5 sm:py-7 lg:py-8">{children}</main>
        {/* bottom tab bar covers the footer's last rows on phones — pad for it (incl. iOS home-bar inset) */}
        <div className="pb-[calc(3.5rem+env(safe-area-inset-bottom))] md:pb-0 print:hidden">
          <Footer />
        </div>
        <MobileTabBar />
        <BackToTop />
        <PwaSetup />
        <ReadingPrefsSetup />
        <ImageRetry />
      </body>
    </html>
  );
}
