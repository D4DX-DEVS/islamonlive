import Link from "next/link";
import { SOCIAL, SocialIcon } from "@/components/social";

export default function Footer() {
  return (
    <footer className="mt-10 bg-purple-950 text-purple-200">
      {/* two columns on phones — one stacked column made the footer taller than the page */}
      <div className="mx-auto grid max-w-[1600px] grid-cols-2 gap-x-6 gap-y-8 px-4 py-10 md:grid-cols-4">
        <div className="col-span-2 md:col-span-1">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo-white.png" alt="islamonlive" className="h-10 w-auto" />
          <p className="mt-2 text-sm">The one and only Comprehensive Islamic portal in Malayalam.</p>
        </div>
        <div>
          <h3 className="font-semibold text-white">IslamOnive</h3>
          <ul className="mt-2 space-y-1 text-sm">
            <li><Link href="/about" className="hover:text-white">About Us</Link></li>
            <li><Link href="/contact" className="hover:text-white">Contact Us</Link></li>
            <li><Link href="/privacy-policy" className="hover:text-white">Privacy Policy</Link></li>
            <li><Link href="/terms-of-use" className="hover:text-white">Terms of Use</Link></li>
            <li><a href="https://rzp.io/rzp/5bOM6U7A" target="_blank" rel="noopener noreferrer" className="hover:text-white">Support Us</a></li>
          </ul>
        </div>
        <div>
          <h3 className="font-semibold text-white">Subsite</h3>
          <ul className="mt-2 space-y-1 text-sm">
            <li><a href="https://hajj.islamonlive.in/" target="_blank" rel="noopener noreferrer" className="hover:text-white">Hajj &amp; Umrah</a></li>
            <li><Link href="/category/news" className="hover:text-white">News</Link></li>
            <li><Link href="/category/shariah" className="hover:text-white">Shari&apos;ah</Link></li>
            <li><Link href="/category/shariah/quran" className="hover:text-white">Quran</Link></li>
            <li><Link href="/category/columns" className="hover:text-white">Columns</Link></li>
          </ul>
        </div>
        <div className="col-span-2 md:col-span-1">
          <h3 className="font-semibold text-white">Contact Us</h3>
          <p className="mt-2 text-sm">Hira Centre, Mavoor Road, Kozhikode, 673004</p>
          <p className="text-sm">editor@islamonlive.in</p>
          <p className="text-sm">+91 9895 944 006</p>
        </div>
      </div>
      <div className="bg-black py-4">
        <div className="mx-auto flex max-w-[1600px] flex-col items-center justify-between gap-3 px-4 text-xs text-zinc-400 sm:flex-row">
          <p>© {new Date().getFullYear()} Islamonlive | All Rights Reserved | Powered by D4DX</p>
          <div className="flex gap-4">
            {SOCIAL.map((s) => (
              <a key={s.label} href={s.href} target="_blank" rel="noopener noreferrer" aria-label={s.label} className="hover:text-white">
                <SocialIcon path={s.path} size={14} />
              </a>
            ))}
          </div>
        </div>
      </div>
    </footer>
  );
}
