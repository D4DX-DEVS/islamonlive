import Image from "next/image";
import Link from "next/link";
import BankPanel from "@/components/support/BankPanel";
import CopyButton from "@/components/support/CopyButton";
import DonatePanel from "@/components/support/DonatePanel";
import StickyDonate from "@/components/support/StickyDonate";
import JsonLd from "@/components/JsonLd";
import { siteUrl } from "@/lib/env";
import { UPI_ID } from "@/lib/support";
import { breadcrumbSchema, graph, ORG_ID, siteNodes, webPageSchema } from "@/lib/schema";

/* Static: nothing here comes from WordPress, so there is no revalidation to do.
   The page has no WP twin either, which is why it declares its own canonical —
   the [category] catch-all never sees /support-us. */
export const metadata = {
  title: "Support Us",
  description:
    "Support Islamonlive.in — donate by card, UPI or net banking through Razorpay, scan the UPI QR, or transfer to the bank account directly.",
  alternates: { canonical: "/support-us/" },
};

/* the three things a reader is being asked to back, under the hero */
const TRUST: { title: string; hint: string; icon: React.ReactNode }[] = [
  {
    title: "Trusted Islamic Content",
    hint: "Free for everyone",
    icon: (
      <>
        <path d="M4 5.5A1.5 1.5 0 0 1 5.5 4h4A2.5 2.5 0 0 1 12 6.5v13A2 2 0 0 0 10 18H5.5A1.5 1.5 0 0 1 4 16.5z" />
        <path d="M20 5.5A1.5 1.5 0 0 0 18.5 4h-4A2.5 2.5 0 0 0 12 6.5v13a2 2 0 0 1 2-1.5h4.5a1.5 1.5 0 0 0 1.5-1.5z" />
      </>
    ),
  },
  {
    title: "Millions of Readers",
    hint: "Around the world",
    icon: (
      <>
        <circle cx="9" cy="8.5" r="3.2" />
        <path d="M3 19.5a6 6 0 0 1 12 0M16 6.2a3.2 3.2 0 0 1 0 6M17.5 19.5a5.6 5.6 0 0 0-2.2-4.4" />
      </>
    ),
  },
  {
    title: "A Stronger Ummah",
    hint: "Through knowledge",
    icon: <path d="M12 20s-7.2-4.5-8.9-8.6A5 5 0 0 1 12 6.9a5 5 0 0 1 8.9 4.5C19.2 15.5 12 20 12 20Z" />,
  },
];

/* what the money does */
const IMPACT: { title: string; body: string; icon: React.ReactNode }[] = [
  {
    title: "Keeps Knowledge Free",
    body: "Keeps every article free to read, for everyone.",
    icon: (
      <>
        <path d="M4 6.2A1.7 1.7 0 0 1 5.7 4.5h4.1A2.2 2.2 0 0 1 12 6.7v12.8a1.9 1.9 0 0 0-1.9-1.4H5.7A1.7 1.7 0 0 1 4 16.4z" />
        <path d="M20 6.2a1.7 1.7 0 0 0-1.7-1.7h-4.1A2.2 2.2 0 0 0 12 6.7v12.8a1.9 1.9 0 0 1 1.9-1.4h4.4A1.7 1.7 0 0 0 20 16.4z" />
      </>
    ),
  },
  {
    title: "No Disruptive Ads",
    body: "Keeps the portal running without ads interrupting the reading.",
    icon: (
      <>
        <circle cx="12" cy="12" r="8.5" />
        <path d="m6 6 12 12" />
      </>
    ),
  },
  {
    title: "Supports Islamic Scholarship",
    body: "Funds serious Islamic study and analysis.",
    icon: (
      <>
        <circle cx="9" cy="8.5" r="3.2" />
        <path d="M3 19.5a6 6 0 0 1 12 0M16 6.2a3.2 3.2 0 0 1 0 6M17.5 19.5a5.6 5.6 0 0 0-2.2-4.4" />
      </>
    ),
  },
  {
    title: "Supports New Contributors",
    body: "Helps new writers and translators.",
    icon: <path d="M20 4.5c-6.5.6-11 4-13.4 8.2L4 19.5M4.5 14.5c3.6-2.8 8-4.2 13-4.2" />,
  },
];

export default function SupportPage() {
  const url = siteUrl("/support-us/");

  return (
    <div className="support mx-auto max-w-[1200px]">
      <JsonLd
        data={graph(
          webPageSchema(url, "Support Us", { description: metadata.description, mainEntity: { "@id": ORG_ID } }),
          breadcrumbSchema([{ name: "Home", path: "/" }, { name: "Support Us" }], url),
          ...siteNodes()
        )}
      />

      <nav className="mb-2.5 hidden text-xs text-zinc-500 sm:block">
        <Link href="/" className="hover:text-purple-800">Home</Link>
        <span className="px-1.5">/</span>
        <span className="text-zinc-700">Support Us</span>
      </nav>

      {/* ---- hero ----------------------------------------------------------
          Short on purpose. Its job is to name the page and hand the reader to
          the donation panel directly below, so it carries the title, one line
          of copy and the three trust chips — nothing else. The mosque is a
          faded decoration on the right with clear ground between it and the
          text, never a full-bleed backdrop. */}
      <section className="support-hero relative overflow-hidden rounded-2xl border border-[color:var(--line)] px-4 py-6 sm:px-7 sm:py-8">
        {/* aria-hidden with an empty alt: it carries nothing a reader needs */}
        <Image src="/mosque.webp" alt="" aria-hidden width={1000} height={667} priority className="support-mosque" />

        <div className="rise relative max-w-xl lg:max-w-[60%]" style={{ "--d": "40ms" } as React.CSSProperties}>
          <p className="pill inline-flex items-center gap-1.5 rounded-full bg-white/85 px-2.5 py-1 text-[10.5px] font-bold uppercase tracking-[0.16em] text-[color:var(--brand)] ring-1 ring-[color:var(--line)]">
            <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden className="h-3 w-3">
              <path d="M12 21s-7.5-4.7-9.3-9A5.2 5.2 0 0 1 12 6.6a5.2 5.2 0 0 1 9.3 5.4C19.5 16.3 12 21 12 21Z" />
            </svg>
            Support Us
          </p>
          <h1 className="mt-3 text-[1.95rem] font-extrabold leading-[1.15] text-[color:var(--ink)] sm:text-[2.6rem]">
            Support <span className="text-[color:var(--brand)]">Islamonlive</span>
          </h1>
          <p className="mt-2.5 max-w-lg text-[14.5px] leading-[1.65] text-zinc-600">
            Every article on this site is free to read, and reader support is what keeps it that way. Give by any
            of the methods below — card, UPI, or a direct bank transfer.
          </p>

          <ul className="mt-5 grid gap-2 sm:grid-cols-3">
            {TRUST.map((t, i) => (
              <li
                key={t.title}
                className="rise lift flex items-center gap-2.5 rounded-xl border border-[color:var(--line)] bg-white/85 px-3 py-2.5 backdrop-blur-sm"
                style={{ "--d": `${130 + i * 65}ms` } as React.CSSProperties}
              >
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[color:var(--lav)] text-[color:var(--brand)]">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden className="h-[17px] w-[17px]">
                    {t.icon}
                  </svg>
                </span>
                <span className="min-w-0">
                  <span className="block text-[12.5px] font-bold leading-tight text-[color:var(--ink)]">{t.title}</span>
                  <span className="block text-[11px] leading-tight text-zinc-500">{t.hint}</span>
                </span>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* ---- donation area, 65 / 35 ----------------------------------------
          Both column wrappers are display:contents on a phone, so the six cards
          inside them are laid out by this one container and can be ordered
          across the column boundary. That matters here: on a phone the reader
          wants donate → QR → bank → why, which interleaves the two desktop
          columns. From lg the wrappers become real columns and the orders
          reset.

          The two columns are meant to finish at roughly the same depth: the
          gateway card is laid out wide rather than tall, and "Why your support
          matters" sits under it precisely so the left column reaches the bottom
          of the QR-and-bank stack instead of stopping halfway and leaving a
          field of empty white. */}
      <div className="mt-4 flex flex-col gap-4 lg:grid lg:grid-cols-12 lg:items-start">
        <div className="contents lg:col-span-7 lg:flex lg:flex-col lg:gap-4 xl:col-span-8">
          <div id="donate" className="rise order-1 scroll-mt-28 lg:order-none" style={{ "--d": "200ms" } as React.CSSProperties}>
            <DonatePanel />
          </div>

          <section
            className="rise order-5 rounded-2xl border border-[color:var(--line)] bg-white p-4 sm:p-5 lg:order-none lg:py-7"
            style={{ "--d": "340ms" } as React.CSSProperties}
          >
            <h2 className="text-[1.15rem] font-extrabold text-[color:var(--ink)] sm:text-[1.3rem]">Why your support matters</h2>
            <p className="mt-0.5 text-[13.5px] text-zinc-500">Your contribution helps us continue, and do more.</p>

            <ul className="mt-6 grid grid-cols-2 gap-x-4 gap-y-6 lg:mt-7 xl:grid-cols-4">
              {IMPACT.map((f) => (
                <li key={f.title} className="text-center xl:border-l xl:border-[color:var(--line)] xl:px-3 xl:first:border-0">
                  <span className="mx-auto flex h-11 w-11 items-center justify-center rounded-full bg-[color:var(--lav)] text-[color:var(--brand)]">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden className="h-5 w-5">
                      {f.icon}
                    </svg>
                  </span>
                  <h3 className="mt-2.5 text-[13.5px] font-extrabold leading-snug text-[color:var(--ink)]">{f.title}</h3>
                  <p className="mt-1.5 text-[12.5px] leading-relaxed text-zinc-500">{f.body}</p>
                </li>
              ))}
            </ul>
          </section>
        </div>

        {/* the details the gateway doesn't cover, stacked tight */}
        <div className="contents lg:col-span-5 lg:block lg:space-y-4 xl:col-span-4">
          <section
            id="upi-panel"
            className="rise order-2 scroll-mt-28 rounded-2xl border border-[color:var(--line)] bg-white p-4 sm:p-5 lg:order-none"
            style={{ "--d": "260ms" } as React.CSSProperties}
          >
            <div className="flex items-center gap-2.5">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[color:var(--lav)] text-[color:var(--brand)]">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden className="h-[17px] w-[17px]">
                  <rect x="3.5" y="3.5" width="7" height="7" rx="1.6" />
                  <rect x="13.5" y="3.5" width="7" height="7" rx="1.6" />
                  <rect x="3.5" y="13.5" width="7" height="7" rx="1.6" />
                  <path d="M13.5 13.5h3v3M20.5 17v3.5H17" />
                </svg>
              </span>
              <span className="min-w-0">
                <h2 className="text-[14.5px] font-extrabold leading-tight text-[color:var(--ink)]">Scan &amp; Pay via UPI</h2>
                <p className="text-[12px] leading-tight text-zinc-500">Open any UPI app and scan the code below.</p>
              </span>
            </div>

            <div className="qr-frame mt-3 flex justify-center rounded-xl bg-[color:var(--lav)] p-4">
              <Image
                src="/upi-qr.jpg"
                alt="UPI QR code for D4DX Innovations LLP"
                width={465}
                height={465}
                priority
                className="h-auto w-full max-w-[172px] rounded-lg bg-white p-1.5 shadow-[0_8px_20px_-14px_rgba(36,16,66,0.5)]"
              />
            </div>
            <p className="pill mt-2 text-center text-[12px] text-zinc-500">
              Open any UPI app, tap <strong className="font-bold text-[color:var(--ink)]">Scan QR</strong>, and donate
            </p>

            {/* label and button share the top line so the id gets the whole
                width below it — set beside the button it broke mid-word on a
                phone ("…@hdfcba / nk") */}
            <div className="mt-2.5 rounded-xl border border-[color:var(--line)] px-3 py-2">
              <div className="flex items-center justify-between gap-2">
                <span className="pill text-[10.5px] font-semibold uppercase tracking-wide text-zinc-500">UPI ID</span>
                <CopyButton value={UPI_ID} label="UPI ID" />
              </div>
              <p className="pill mt-0.5 break-all text-[13px] font-bold text-[color:var(--ink)]">{UPI_ID}</p>
            </div>
          </section>

          <BankPanel />
        </div>
      </div>

      {/* ---- the ayah, a thin band rather than a card ------------------------
          It closes the page rather than competing with it: one line of Arabic,
          one of translation, the reference set out to the right. */}
      <figure
        className="rise relative mt-4 overflow-hidden rounded-xl bg-[color:var(--lav)] py-3.5 pl-5 pr-4 sm:flex sm:items-center sm:gap-5"
        style={{ "--d": "400ms" } as React.CSSProperties}
      >
        <span className="absolute inset-y-3 left-0 w-[3px] rounded-full bg-[color:var(--brand)]" />
        <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden className="hidden h-6 w-6 shrink-0 text-[color:var(--brand)]/25 sm:block">
          <path d="M9.5 5.5C6.4 7 4.5 9.8 4.5 13.2c0 3.2 1.9 5.3 4.4 5.3 2.1 0 3.7-1.5 3.7-3.5 0-2-1.4-3.4-3.3-3.4-.4 0-.8.1-1 .2.3-1.7 1.7-3.4 3.6-4.4zm9 0C15.4 7 13.5 9.8 13.5 13.2c0 3.2 1.9 5.3 4.4 5.3 2.1 0 3.7-1.5 3.7-3.5 0-2-1.4-3.4-3.3-3.4-.4 0-.8.1-1 .2.3-1.7 1.7-3.4 3.6-4.4z" />
        </svg>
        <blockquote className="min-w-0 flex-1">
          <p dir="rtl" lang="ar" className="text-right text-[1.05rem] leading-[1.9] text-[color:var(--ink)] sm:text-left sm:text-[1.1rem]">
            مَنْ ذَا الَّذِي يُقْرِضُ اللَّهَ قَرْضًا حَسَنًا فَيُضَاعِفَهُ لَهُ وَلَهُ أَجْرٌ كَرِيمٌ
          </p>
          <p className="mt-1 text-[13px] italic leading-snug text-zinc-600">
            &ldquo;Who is it that would loan Allah a goodly loan, so He may multiply it for him many times over? And
            for him is a noble reward.&rdquo;
          </p>
          <p className="mt-1.5 text-[12.5px] leading-snug text-zinc-500">
            Your support is a <strong className="font-bold text-[color:var(--ink)]">sadaqah jariyah</strong> — a charity
            that keeps on giving.
          </p>
        </blockquote>
        <figcaption className="pill mt-2 shrink-0 text-[11.5px] font-bold text-[color:var(--brand)] sm:mt-0">
          Surah Al-Hadid 57:11
        </figcaption>
      </figure>

      {/* ---- contact, one line ----------------------------------------------- */}
      <section
        className="rise mt-4 mb-1 flex flex-col items-center gap-2.5 rounded-xl border border-[color:var(--line)] bg-white px-4 py-3.5 text-center sm:flex-row sm:justify-between sm:text-left"
        style={{ "--d": "440ms" } as React.CSSProperties}
      >
        <span className="flex items-center gap-2.5">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden className="h-5 w-5 shrink-0 text-[color:var(--brand)]">
            <rect x="3" y="5" width="18" height="14" rx="3" />
            <path d="m3.8 7.6 7 4.8a2.2 2.2 0 0 0 2.4 0l7-4.8" />
          </svg>
          <span className="text-[14px] font-bold text-[color:var(--ink)]">
            Questions about donating? <span className="font-normal text-zinc-500">We&rsquo;re here to help.</span>
          </span>
        </span>
        <Link
          href="/contact"
          className="pill inline-flex min-h-10 items-center gap-1.5 rounded-lg bg-[color:var(--lav)] px-4 text-[13px] font-bold text-[color:var(--brand)] transition hover:bg-[color:var(--lav-2)]"
        >
          Get in touch
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden className="h-3.5 w-3.5">
            <path d="M5 12h13M13 6l6 6-6 6" />
          </svg>
        </Link>
      </section>

      {/* phone only — appears once the real Donate button leaves the screen */}
      <StickyDonate watch="donate" />
    </div>
  );
}
