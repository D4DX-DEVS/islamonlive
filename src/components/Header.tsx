import Link from "next/link";
import { SOCIAL, SocialIcon } from "@/components/social";

type NavItem = { label: string; href: string; external?: boolean; children?: { label: string; href: string }[] };

// mirrors the live site's menu: Read (mega), Infographics, Watch, Listen, Hajj & Umrah
const NAV: NavItem[] = [
  { label: "Home", href: "/" },
  {
    label: "Read", href: "/category/opinion", children: [
      { label: "Opinion", href: "/category/opinion" },
      { label: "Shari'ah", href: "/category/shariah" },
      { label: "Culture", href: "/category/culture" },
      { label: "Columns", href: "/category/columns" },
    ],
  },
  { label: "Infographics", href: "/category/infographics" },
  { label: "Watch", href: "/watch-videos" },
  { label: "Listen", href: "/listen" },
  { label: "Hajj & Umrah", href: "https://hajj.islamonlive.in/", external: true },
];

export default function Header() {
  const today = new Date().toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" });
  return (
    <header className="sticky top-0 z-50 bg-white shadow">
      {/* top bar: date | centered logo | socials + search + support — mirrors live site */}
      <div className="mx-auto grid max-w-7xl grid-cols-[1fr_auto_1fr] items-center gap-2 px-4 py-2.5">
        <time className="hidden text-xs text-zinc-500 sm:block">{today}</time>
        <Link href="/" className="justify-self-center sm:col-start-2">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo.png" alt="islamonlive" className="h-9 w-auto" />
        </Link>
        <div className="flex items-center justify-end gap-3">
          <div className="hidden items-center gap-3 text-zinc-500 lg:flex">
            {SOCIAL.map((s) => (
              <a key={s.label} href={s.href} target="_blank" rel="noopener noreferrer" aria-label={s.label} title={s.label} className="hover:text-purple-800">
                <SocialIcon path={s.path} />
              </a>
            ))}
          </div>
          <form action="/search" className="hidden items-center md:flex">
            <input
              type="search" name="q" placeholder="Search…" aria-label="Search"
              className="w-24 rounded-full border border-zinc-300 px-3 py-1 text-xs outline-none transition-[width] focus:w-44 focus:border-purple-700"
            />
          </form>
          <a href="https://rzp.io/rzp/5bOM6U7A" target="_blank" rel="noopener noreferrer" className="whitespace-nowrap rounded-full bg-purple-800 px-3 py-1.5 text-xs font-semibold text-white hover:bg-purple-700">
            Support Us
          </a>
        </div>
      </div>
      <nav className="bg-purple-950">
        <div className="mx-auto hidden max-w-7xl justify-center gap-1 px-4 md:flex">
          {NAV.map((item) => (
            <div key={item.label} className="group relative">
              {item.external ? (
                <a href={item.href} target="_blank" rel="noopener noreferrer" className="flex items-center whitespace-nowrap px-4 py-3 text-sm font-medium text-purple-100 hover:bg-purple-800 hover:text-white">
                  {item.label}
                </a>
              ) : (
                <Link href={item.href} className="flex items-center gap-1 whitespace-nowrap px-4 py-3 text-sm font-medium text-purple-100 hover:bg-purple-800 hover:text-white">
                  {item.label}
                  {item.children && <span className="text-[10px]">▾</span>}
                </Link>
              )}
              {item.children && (
                <div className="invisible absolute left-0 top-full z-50 min-w-48 rounded-b-lg bg-white opacity-0 shadow-lg transition group-hover:visible group-hover:opacity-100">
                  {item.children.map((c) => (
                    <Link key={c.href} href={c.href} className="block px-4 py-2 text-sm text-zinc-700 hover:bg-purple-50 hover:text-purple-900">
                      {c.label}
                    </Link>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
        <details className="md:hidden">
          <summary className="cursor-pointer list-none px-4 py-2.5 text-sm font-medium text-purple-100">☰ Menu</summary>
          <div className="grid grid-cols-2 gap-x-2 bg-purple-950 px-4 pb-3">
            {NAV.flatMap((i) => [i, ...(i.children ?? [])]).map((l) => (
              <Link key={l.label + l.href} href={l.href} className="py-1.5 text-sm text-purple-100 hover:text-white">
                {l.label}
              </Link>
            ))}
          </div>
        </details>
      </nav>
    </header>
  );
}
