import Link from "next/link";
import { notFound } from "next/navigation";
import { getStaticPage } from "@/lib/wpPage";
import { SOCIAL, SocialIcon } from "@/components/social";

export const revalidate = 3600;

export const metadata = { title: "Contact Us" };

const EMAIL = "editor@islamonlive.in";
const PHONE = "+91 9895944006";
const WHATSAPP = "https://wa.me/919895944006";

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-xl bg-white p-5 shadow-sm ring-1 ring-zinc-900/10 sm:p-6">
      <h2 className="mb-3 border-l-4 border-purple-800 pl-3 text-lg font-extrabold text-zinc-900">{title}</h2>
      {children}
    </section>
  );
}

function Row({ icon, label, value, href }: { icon: React.ReactNode; label: string; value: string; href?: string }) {
  return (
    <div className="flex items-start gap-3 py-2">
      <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-purple-50 text-purple-800">{icon}</span>
      <div className="min-w-0">
        <p className="pill text-[11px] font-semibold uppercase tracking-wide text-zinc-500">{label}</p>
        {href ? (
          <a href={href} className="break-words text-sm font-medium text-purple-800 hover:underline">{value}</a>
        ) : (
          <p className="whitespace-pre-line break-words text-sm text-zinc-700">{value}</p>
        )}
      </div>
    </div>
  );
}

export default async function ContactPage() {
  const page = await getStaticPage("contact");
  if (!page) notFound();

  // the address and the two "send your works to" lines are rendered as cards from
  // the constants above — what's left is the Malayalam submission guideline
  const guidelines = page.paragraphs.filter((p) => !/Hira Centre|Send Your Works|WhatsApp Number/i.test(p));

  return (
    <div className="mx-auto max-w-5xl">
      <nav className="mb-3 text-xs text-zinc-500">
        <Link href="/" className="hover:text-purple-800">Home</Link>
        <span className="px-1.5">/</span>
        <span className="text-zinc-700">Contact Us</span>
      </nav>
      <h1 className="mb-6 text-3xl font-extrabold">Contact Us</h1>

      <div className="grid gap-5 lg:grid-cols-3">
        <div className="space-y-5 lg:col-span-1">
          <Card title="Office">
            <Row
              label="Address"
              value={"Hira Centre, Mavoor Road,\nKozhikode, Kerala, India, 673004"}
              icon={
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden className="h-4 w-4">
                  <path d="M12 21s7-5.5 7-11a7 7 0 1 0-14 0c0 5.5 7 11 7 11z" />
                  <circle cx="12" cy="10" r="2.5" />
                </svg>
              }
            />
            <Row
              label="Email"
              value={EMAIL}
              href={`mailto:${EMAIL}`}
              icon={
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden className="h-4 w-4">
                  <rect x="3" y="5" width="18" height="14" rx="2" />
                  <path d="m3 7 9 6 9-6" />
                </svg>
              }
            />
            <Row
              label="Office WhatsApp"
              value={PHONE}
              href={WHATSAPP}
              icon={
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden className="h-4 w-4">
                  <path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a1 1 0 0 1-1.1 1A16 16 0 0 1 4 5.1 1 1 0 0 1 5 4z" />
                </svg>
              }
            />
          </Card>

          <Card title="Follow Us">
            <div className="flex flex-wrap gap-2">
              {SOCIAL.map((s) => (
                <a
                  key={s.label}
                  href={s.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={s.label}
                  title={s.label}
                  className="flex h-9 w-9 items-center justify-center rounded-full bg-purple-50 text-purple-800 transition hover:bg-purple-800 hover:text-white"
                >
                  <SocialIcon path={s.path} size={16} />
                </a>
              ))}
            </div>
          </Card>
        </div>

        <div className="lg:col-span-2">
          <Card title="Send Your Post To">
            <div className="space-y-4 text-[15px] leading-8 text-zinc-800">
              {guidelines.map((p, n) => (
                <p key={n} dangerouslySetInnerHTML={{ __html: p }} />
              ))}
            </div>
            {/* the WP page's feedback form is a JS-only Elementor widget that can't
                run here — a direct mail/WhatsApp handoff replaces it */}
            <div className="mt-6 flex flex-wrap gap-3 border-t border-zinc-100 pt-5">
              <a
                href={`mailto:${EMAIL}?subject=${encodeURIComponent("Article submission — Islamonlive")}`}
                className="pill inline-flex items-center gap-2 rounded-full bg-purple-800 px-4 py-2 text-xs font-semibold text-white hover:bg-purple-700"
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden className="h-3.5 w-3.5">
                  <rect x="3" y="5" width="18" height="14" rx="2" />
                  <path d="m3 7 9 6 9-6" />
                </svg>
                Mail the editor
              </a>
              <a
                href={WHATSAPP}
                target="_blank"
                rel="noopener noreferrer"
                className="pill inline-flex items-center gap-2 rounded-full px-4 py-2 text-xs font-semibold text-purple-800 ring-1 ring-purple-300 hover:bg-purple-50"
              >
                WhatsApp us
              </a>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
