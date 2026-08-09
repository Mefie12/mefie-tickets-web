/**
 * Shared money-formatting helpers, replacing the hardcoded `$`
 * previously duplicated across Checkout.tsx/TicketSelector.tsx and
 * re-invented ad hoc elsewhere. `Intl.NumberFormat` handles symbol,
 * decimal places, and locale formatting correctly for every ISO 4217
 * code out of the box — including zero-decimal currencies like JPY —
 * so no manual symbol map is needed.
 *
 * A fixed locale, not `undefined` — same reasoning as LOCALE in
 * eventDateTime.ts: `undefined` resolves to the runtime's locale, which
 * for a component server-rendered once (Node's locale) and hydrated in
 * the browser (the viewer's locale) can differ, e.g. USD renders as
 * "$50.00" under en-US but "US$50.00" under en-GB — a real hydration
 * mismatch, not a cosmetic one.
 */
const LOCALE = "en-GB";

export function formatMoney(amount: string | number | null, currencyCode: string): string {
  if (amount === null) return "Free";
  const value = Number(amount);
  if (value === 0) return "Free";
  try {
    return new Intl.NumberFormat(LOCALE, { style: "currency", currency: currencyCode }).format(value);
  } catch {
    return `${currencyCode} ${value.toFixed(2)}`;
  }
}

/**
 * Same formatting as formatMoney, but a zero amount renders as a real
 * "0.00", not "Free" — for ledger/balance figures (payouts) where zero
 * is a legitimate amount, not the absence of a price.
 */
export function formatAmount(amount: string | number, currencyCode: string): string {
  try {
    return new Intl.NumberFormat(LOCALE, { style: "currency", currency: currencyCode }).format(Number(amount));
  } catch {
    return `${currencyCode} ${Number(amount).toFixed(2)}`;
  }
}

/** The bare currency symbol (e.g. "£" for GBP) — for use as an input prefix, not for formatted totals. */
export function currencySymbol(currencyCode: string): string {
  try {
    const part = new Intl.NumberFormat(LOCALE, {
      style: "currency",
      currency: currencyCode,
      currencyDisplay: "narrowSymbol",
    })
      .formatToParts(0)
      .find((p) => p.type === "currency");
    return part?.value ?? currencyCode;
  } catch {
    return currencyCode;
  }
}
