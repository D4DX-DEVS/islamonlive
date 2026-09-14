"use client";

import { useCallback, useState } from "react";
import { AMOUNTS, DEFAULT_AMOUNT, donateUrl } from "@/lib/support";

/* "Choose how you'd like to support" — the page's primary action.

   Three methods, one of them live at a time. Card / Net Banking is the default
   and the only one with a form: it carries the amount chips and hands the
   chosen figure to Razorpay's payment page, which already collects email and
   phone and issues the receipt. UPI and Bank Transfer have nothing to submit,
   so picking them scrolls to the panel that holds their details and flashes it,
   rather than repeating the QR and the account number in a second place.

   The gateway card is laid out wide rather than tall — copy left, button right,
   amounts on one row underneath with the custom box as the fifth cell. Stacked,
   it ran three times the height of the QR panel beside it and left the right
   column sitting over a pit of empty white.

   It is one grid with explicit placement rather than nested rows, because the
   order differs by width: on a phone the reader picks an amount and *then*
   taps Donate, so the button falls below the chips; from sm the button lifts
   into the top-right corner where it reads as the card's primary action.

   Amount is two pieces of state, not one. A single mirrored value would put
   "250" inside the custom box the moment a chip was tapped, which reads as if
   the reader had typed it; keeping the typed string separate lets the chips
   stay chips and the box stay empty until someone wants another figure. The
   box wins whenever it holds anything — typing clears the chips.

   It stays a *string* while being typed: a half-entered "10" must not become
   ten rupees on its way to "100", and the field has to be allowed to be
   empty. */

type Method = "card" | "upi" | "bank";

const METHODS: { key: Method; title: string; hint: string; icon: React.ReactNode }[] = [
  {
    key: "card",
    title: "Card / Net Banking",
    hint: "Instant & Secure",
    icon: (
      <>
        <rect x="2.5" y="5" width="19" height="14" rx="3" />
        <path d="M2.5 10h19" />
      </>
    ),
  },
  { key: "upi", title: "UPI", hint: "Scan & Pay", icon: <path d="m4 12 7-7v14l9-9-7-7" /> },
  {
    key: "bank",
    title: "Bank Transfer",
    hint: "Direct Transfer",
    icon: (
      <>
        <path d="M3.5 9.5 12 4.5l8.5 5" />
        <path d="M5.5 9.5v8M10 9.5v8M14 9.5v8M18.5 9.5v8M3 19.5h18" />
      </>
    ),
  },
];

/** scroll a details panel into view and flash its ring, so the reader can see
    where the tap took them */
function reveal(id: string): void {
  const el = document.getElementById(id);
  if (!el) return;
  el.scrollIntoView({ behavior: "smooth", block: "center" });
  el.classList.remove("flash");
  // reflow, or a second tap on the same card re-adds the class mid-animation
  void el.offsetWidth;
  el.classList.add("flash");
}

export default function DonatePanel() {
  const [method, setMethod] = useState<Method>("card");
  const [preset, setPreset] = useState<number | null>(DEFAULT_AMOUNT);
  const [custom, setCustom] = useState("");

  const typed = custom.trim();
  const chosen = typed ? Number(typed) : preset;
  const valid = typeof chosen === "number" && Number.isFinite(chosen) && chosen > 0;

  const pick = useCallback((m: Method) => {
    setMethod(m);
    if (m === "upi") reveal("upi-panel");
    if (m === "bank") reveal("bank-panel");
  }, []);

  return (
    <section className="rounded-2xl border border-[color:var(--line)] bg-white p-4 sm:p-5">
      <h2 className="text-[1.15rem] font-extrabold text-[color:var(--ink)] sm:text-[1.3rem]">Choose how you&rsquo;d like to support</h2>
      <p className="mt-0.5 text-[13.5px] text-zinc-500">Secure, simple and convenient ways to contribute.</p>

      <div role="tablist" aria-label="Payment method" className="mt-4 grid gap-2 sm:grid-cols-3">
        {METHODS.map((m) => {
          const on = method === m.key;
          return (
            <button
              key={m.key}
              type="button"
              role="tab"
              aria-selected={on}
              onClick={() => pick(m.key)}
              className={`flex items-center gap-2.5 rounded-xl border px-3 py-2.5 text-left transition ${
                on
                  ? "border-transparent bg-[color:var(--brand-deep)] text-white shadow-[0_8px_20px_-12px_rgba(36,16,66,0.9)]"
                  : "border-[color:var(--line)] bg-white text-[color:var(--ink)] hover:border-[color:var(--brand)]/40 hover:bg-[color:var(--lav)]"
              }`}
            >
              <span
                className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${
                  on ? "bg-white/15 text-white" : "bg-[color:var(--lav)] text-[color:var(--brand)]"
                }`}
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden className="h-[17px] w-[17px]">
                  {m.icon}
                </svg>
              </span>
              <span className="min-w-0">
                <span className="pill block text-[13px] font-bold leading-tight">{m.title}</span>
                <span className={`pill block text-[11px] leading-tight ${on ? "text-white/60" : "text-zinc-500"}`}>{m.hint}</span>
              </span>
            </button>
          );
        })}
      </div>

      {method === "card" ? (
        <div className="mt-3 rounded-2xl bg-[color:var(--brand-deep)] p-4 text-white sm:p-5">
          <div className="grid gap-4 sm:grid-cols-[1fr_auto] sm:gap-x-6">
            <div className="min-w-0 sm:col-start-1 sm:row-start-1">
              <h3 className="text-[17px] font-extrabold">Donate via Razorpay</h3>
              <p className="mt-1 max-w-md text-[13px] leading-relaxed text-white/60">
                Support Islamonlive securely through the Razorpay payment gateway. A receipt is sent to your email
                once the payment succeeds.
              </p>
            </div>

            <div className="order-3 shrink-0 sm:order-none sm:col-start-2 sm:row-start-1 sm:self-start sm:text-center">
              <a
                href={donateUrl(valid ? (chosen as number) : null)}
                target="_blank"
                rel="noopener noreferrer"
                className="cta pill flex min-h-[50px] items-center justify-center gap-2 rounded-xl bg-[color:var(--gold)] px-7 text-[15px] font-extrabold text-[color:var(--gold-ink)] shadow-[0_14px_28px_-14px_rgba(243,195,78,0.95)] hover:bg-[color:var(--gold-dark)] sm:min-w-[210px]"
              >
                {valid ? `Donate ₹${(chosen as number).toLocaleString("en-IN")}` : "Donate Now"}
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden className="h-4 w-4">
                  <path d="M5 12h13M13 6l6 6-6 6" />
                </svg>
              </a>
              <p className="pill mt-2 flex items-center justify-center gap-1.5 text-[11px] text-white/45">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden className="h-3.5 w-3.5">
                  <rect x="4.5" y="10.5" width="15" height="9.5" rx="2.5" />
                  <path d="M8 10.5V7.5a4 4 0 0 1 8 0v3" />
                </svg>
                Secured by Razorpay
              </p>
            </div>
            {/* amounts on one row, the custom box as the fifth cell */}
            <div className="order-2 grid grid-cols-2 gap-2 sm:order-none sm:col-span-2 sm:row-start-2 sm:grid-cols-5">
              {AMOUNTS.map((a) => {
                const on = !typed && preset === a;
                return (
                  <button
                    key={a}
                    type="button"
                    onClick={() => { setPreset(a); setCustom(""); }}
                    aria-pressed={on}
                    className={`pill min-h-11 rounded-xl text-[13.5px] font-bold transition active:scale-95 ${
                      on
                        ? "bg-[color:var(--brand)] text-white shadow-[0_8px_18px_-10px_rgba(105,63,226,1)]"
                        : "bg-white/10 text-white/85 hover:bg-white/20"
                    }`}
                  >
                    ₹{a.toLocaleString("en-IN")}
                  </button>
                );
              })}
              <label className="col-span-2 flex min-h-11 items-center gap-1.5 rounded-xl bg-white/10 px-3 focus-within:bg-white/[0.16] sm:col-span-1">
                <span className="pill text-[13px] font-bold text-white/55">₹</span>
                <span className="sr-only">Custom amount in rupees</span>
                <input
                  type="number"
                  inputMode="numeric"
                  min={1}
                  step={1}
                  value={custom}
                  onChange={(e) => { setCustom(e.target.value); if (e.target.value.trim()) setPreset(null); }}
                  placeholder="Custom"
                  className="pill w-full min-w-0 bg-transparent text-[13px] font-semibold text-white outline-none placeholder:font-normal placeholder:text-white/40 [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                />
              </label>
            </div>

            <ul className="pill order-4 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[11px] font-bold uppercase tracking-[0.08em] text-white/35 sm:order-none sm:col-span-2 sm:row-start-3">
              {["Visa", "Mastercard", "RuPay", "UPI", "Net Banking"].map((n) => (
                <li key={n}>{n}</li>
              ))}
            </ul>
          </div>
        </div>
      ) : (
        <div className="mt-3 flex flex-col items-center gap-2.5 rounded-2xl border border-dashed border-[color:var(--line)] bg-[color:var(--lav)] px-4 py-4 text-center sm:flex-row sm:justify-between sm:text-left">
          <p className="text-[13.5px] leading-relaxed text-zinc-600">
            {method === "upi"
              ? "Scan the QR code or copy the UPI ID from the details panel — it takes payment from any UPI app."
              : "The account name, number, IFSC and branch are in the details panel, each one tap from your clipboard."}
          </p>
          <button
            type="button"
            onClick={() => reveal(method === "upi" ? "upi-panel" : "bank-panel")}
            className="pill inline-flex min-h-10 shrink-0 items-center gap-1.5 rounded-lg bg-white px-4 text-[13px] font-bold text-[color:var(--brand)] ring-1 ring-[color:var(--line)] transition hover:bg-[color:var(--lav-2)]"
          >
            Show the details
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden className="h-3.5 w-3.5">
              <path d="M12 5v13M6 12l6 6 6-6" />
            </svg>
          </button>
        </div>
      )}
    </section>
  );
}
