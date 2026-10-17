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
    return `${currencyCode} ${value.toFixed(currencyExponent(currencyCode))}`;
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
    return `${currencyCode} ${Number(amount).toFixed(currencyExponent(currencyCode))}`;
  }
}

/**
 * ISO 4217 currencies with no minor unit: 5000 XOF is 5000 minor units, not 500000. This list is EXACTLY the API's
 * CurrencyMetadata::ZERO_DECIMAL (and StripePaymentService's), which decides how every `_minor` amount is stored and
 * charged. It is not taken from Intl, whose CLDR data differs for a few codes (e.g. ISK, IQD). Change both together;
 * money.test.ts pins this copy so a change here is always deliberate.
 */
export const ZERO_DECIMAL_CURRENCIES: readonly string[] = [
  "BIF", "CLP", "DJF", "GNF", "JPY", "KMF", "KRW", "MGA", "PYG", "RWF", "UGX", "VND", "VUV", "XAF", "XOF", "XPF",
];

/** Decimal places of a currency's minor unit, as the API stores it: 0 for zero-decimal currencies, otherwise 2. */
export function currencyExponent(currencyCode: string | null | undefined): number {
  // Tolerates a missing code (older or partial payloads): formatting then falls back like it always did,
  // instead of a money helper throwing and taking the whole page down.
  return ZERO_DECIMAL_CURRENCIES.includes(String(currencyCode ?? "").toUpperCase()) ? 0 : 2;
}

/**
 * A major amount (e.g. "19.99" or a typed price) as integer minor units of that currency, rounded half-up like the
 * API: 19.99 GBP -> 1999, 5000 XOF -> 5000. The one place the web turns major into minor; never multiply by 100.
 */
export function toMinorUnits(amount: string | number | null | undefined, currencyCode: string): number {
  return Math.round(Number(amount ?? 0) * 10 ** currencyExponent(currencyCode));
}

/** Integer minor units as a major amount: 1999 GBP -> 19.99, 5000 XOF -> 5000. Never divide by 100. */
export function toMajorUnits(amountMinor: number, currencyCode: string): number {
  return amountMinor / 10 ** currencyExponent(currencyCode);
}

/** Props for a money NumberInput: whole numbers only for zero-decimal currencies, two decimals otherwise. */
export function moneyInputProps(currencyCode: string): { decimalScale: number; fixedDecimalScale: boolean; min: number } {
  const exponent = currencyExponent(currencyCode);
  return { decimalScale: exponent, fixedDecimalScale: exponent > 0, min: 1 / 10 ** exponent };
}

/** For `_minor` integer fields (the payments domain's unit — see the API's Money value object), in any currency. */
export function formatMinorAmount(amountMinor: number, currencyCode: string): string {
  return formatAmount(toMajorUnits(amountMinor, currencyCode), currencyCode);
}

/** Basis points as a percent string, trimmed to at most 2 decimals with no trailing zeros — e.g. 300 -> "3%", 875 -> "8.75%". */
export function formatBasisPointsAsPercent(basisPoints: number): string {
  return `${Number((basisPoints / 100).toFixed(2))}%`;
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
