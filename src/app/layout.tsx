import type { Metadata } from "next";
import { Noto_Sans_Malayalam, Anek_Malayalam } from "next/font/google";
import "./globals.css";
import Header, { NavPreviewItem } from "@/components/Header";
import Footer from "@/components/Footer";
import { getPosts, featuredImage, postPath, primaryCategory, formatDate } from "@/lib/wordpress";

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

export const metadata: Metadata = {
  metadataBase: new URL("https://islamonlive.in"),
  title: {
    default: "Islamonlive.in | The one and only Comprehensive Islamic portal in Malayalam",
    template: "%s | Islamonlive.in",
  },
  description: "Comprehensive Islamic portal in Malayalam - news, opinion, columns, Shariah, Quran and more.",
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const previews = await navPreviews();
  return (
    <html lang="ml">
      <body className={`${notoMalayalam.variable} ${anekMalayalam.variable} bg-zinc-50 font-sans text-zinc-900 antialiased`}>
        <Header previews={previews} />
        <main className="mx-auto max-w-[1600px] px-3 py-6 sm:px-5">{children}</main>
        <Footer />
      </body>
    </html>
  );
}
