import Link from "next/link";
import { SOCIAL, SocialIcon } from "@/components/social";

export default function Footer() {
  return (
    <footer className="mt-4 bg-purple-950 text-purple-200">
      {/* phones: whole top block hidden — mobile footer is just the tiny credit bar below */}
      {/* ≥xl the brand track is max-content: the tagline keeps its full sentence on one
          line and the three link columns start after it. A quarter of the grid is far
          too narrow for that sentence, so md/lg stack it under the logo instead —
          forcing the inline row there squeezed the text to one letter per line. */}
      <div className="mx-auto hidden max-w-[1600px] grid-cols-2 gap-x-6 gap-y-8 px-4 py-6 md:grid md:grid-cols-4 md:gap-x-10 md:py-10 xl:grid-cols-[max-content_repeat(3,minmax(0,1fr))] xl:gap-x-14">
        <div className="col-span-2 md:col-span-1 xl:flex xl:items-center xl:gap-4">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo-white.png" alt="islamonlive" className="h-10 w-auto shrink-0" />
          <p className="mt-2 min-w-0 text-sm leading-snug xl:mt-0 xl:whitespace-nowrap xl:border-l xl:border-purple-800 xl:pl-4">The one and only Comprehensive Islamic portal in Malayalam.</p>
        </div>
        <div className="hidden md:block">
          <h3 className="font-semibold text-white">IslamOnlive</h3>
          <ul className="mt-2 space-y-1 text-sm">
            <li><Link href="/about" className="hover:text-white">About Us</Link></li>
            <li><Link href="/contact" className="hover:text-white">Contact Us</Link></li>
            <li><Link href="/privacy-policy" className="hover:text-white">Privacy Policy</Link></li>
            <li><Link href="/terms-of-use" className="hover:text-white">Terms of Use</Link></li>
            <li><a href="https://rzp.io/rzp/5bOM6U7A" target="_blank" rel="noopener noreferrer" className="hover:text-white">Support Us</a></li>
          </ul>
        </div>
        <div className="hidden md:block">
          <h3 className="font-semibold text-white">Subsite</h3>
          <ul className="mt-2 space-y-1 text-sm">
            <li><a href="https://hajj.islamonlive.in/" target="_blank" rel="noopener noreferrer" className="hover:text-white">Hajj &amp; Umra</a></li>
            <li><a href="https://mohammednabi.islamonlive.in/" target="_blank" rel="noopener noreferrer" className="hover:text-white">Muhammed Nabi</a></li>
            <li><a href="https://fatwa.islamonlive.in/" target="_blank" rel="noopener noreferrer" className="hover:text-white">Fatwa</a></li>
            <li><a href="https://ramadan.islamonlive.in/" target="_blank" rel="noopener noreferrer" className="hover:text-white">Ramadan</a></li>
          </ul>
        </div>
        <div className="col-span-2 hidden md:col-span-1 md:block">
          <h3 className="font-semibold text-white">Contact Us</h3>
          <p className="mt-2 text-sm">Hira Centre, Mavoor Road, Kozhikode, 673004</p>
          <p className="text-sm">editor@islamonlive.in</p>
          <p className="text-sm">+91 9895 944 006</p>
        </div>
      </div>
      <div className="bg-black py-2 md:py-4">
        <div className="mx-auto flex max-w-[1600px] flex-col items-center justify-between gap-3 px-4 text-[11px] text-zinc-400 sm:flex-row md:text-xs">
          <p>
            © {new Date().getFullYear()} Islamonlive
            <span className="hidden md:inline"> | All Rights Reserved</span>
            {" "}| Powered by{" "}
            <a href="https://www.d4dx.co" target="_blank" rel="noopener noreferrer" className="font-semibold hover:text-white">D4DX</a>
          </p>
          <div className="hidden gap-4 md:flex">
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
