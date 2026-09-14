/* Everything the /support-us page pays into, in one place — the page, the
   donate panel, the sticky phone bar and the bank table all read from here, so
   a changed account number is a one-line edit rather than a hunt. */

/* The live Razorpay Payment Page ("Support Islam Onlive", D4DX INNOVATIONS LLP).
   It already collects amount, email and phone and takes card / UPI / net
   banking, and Razorpay sends the receipt — there is nothing to build server
   side, which is why this page links out rather than mounting Checkout.

   The canonical pages.razorpay.com URL, NOT the rzp.io short link: the short
   link 302s to this URL and drops the query string on the way, so an amount
   chosen here would be lost. */
export const RAZORPAY_PAGE = "https://pages.razorpay.com/pl_Qic33jB70iIWlA/view";

/** Preset amounts, in rupees. */
export const AMOUNTS = [100, 250, 500, 1000] as const;

/** the chip a first-time donor lands on */
export const DEFAULT_AMOUNT = 250;

/* `amount` on a Razorpay payment page is in RUPEES, not paise — ?amount=250
   prefills the field as ₹250.00 (verified against the live page). An amount
   that isn't a positive number is simply left off, and the donor types their
   own on Razorpay's side. */
export function donateUrl(amount?: number | null): string {
  if (!amount || !Number.isFinite(amount) || amount <= 0) return RAZORPAY_PAGE;
  return `${RAZORPAY_PAGE}?amount=${Math.round(amount)}`;
}

export const UPI_ID = "vyapar.176971524101@hdfcbank";

export interface Detail {
  label: string;
  value: string;
}

/* Every row is copyable, not just the digits: a bank's own transfer form asks
   for the payee name and the branch verbatim, and a reader retyping
   "D4DX INNOVATIONS LLP" on a phone is a reader who gets it wrong. */
export const BANK: Detail[] = [
  { label: "Account Name", value: "D4DX INNOVATIONS LLP" },
  { label: "Account Number", value: "50200102639272" },
  { label: "IFSC Code", value: "HDFC0002811" },
  { label: "Bank", value: "HDFC SmartHub Vyapar" },
  { label: "Branch", value: "CIVIL STATION" },
];
