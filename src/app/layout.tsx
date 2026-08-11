import type { Metadata } from "next";
import { Anek_Malayalam } from "next/font/google";
import "./globals.css";
import Header from "@/components/Header";
import Footer from "@/components/Footer";

const anek = Anek_Malayalam({ subsets: ["malayalam", "latin"], variable: "--font-anek" });

export const metadata: Metadata = {
  metadataBase: new URL("https://islamonlive.in"),
  title: {
    default: "Islamonlive.in | The one and only Comprehensive Islamic portal in Malayalam",
    template: "%s | Islamonlive.in",
  },
  description: "Comprehensive Islamic portal in Malayalam - news, opinion, columns, Shariah, Quran and more.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ml">
      <body className={`${anek.variable} bg-zinc-50 font-sans text-zinc-900 antialiased`}>
        <Header />
        <main className="mx-auto max-w-7xl px-4 py-6">{children}</main>
        <Footer />
      </body>
    </html>
  );
}
