import worldCountries from "world-countries";

/**
 * Thin local adapter over `world-countries` (already a dependency, used
 * by countries.ts) — each country entry embeds its currencies' code,
 * name, and symbol, so no separate currency-data package is needed.
 * Deduping across all countries yields every real-world ISO 4217
 * currency code. `code` is always the three-letter code — the only
 * value that should ever be stored (Stripe, orders, payouts, tax all
 * need this, never a symbol — see App\Rules\ValidIsoCurrencyCode on
 * the backend for the matching validation list).
 */
export type Currency = {
  code: string;
  name: string;
  symbol: string;
  /** Lowercased informal names (e.g. "dollar", "pound") — matched against when searching. Most currencies have none. */
  aliases: string[];
};

/** Hand-curated informal names for the currencies worth searching by nickname, not full name. */
const ALIASES: Record<string, string[]> = {
  GBP: ["pound", "sterling"],
  USD: ["dollar", "buck"],
  EUR: ["euro"],
  JPY: ["yen"],
  CNY: ["yuan", "renminbi"],
  INR: ["rupee"],
  AUD: ["dollar", "aussie dollar"],
  CAD: ["dollar", "loonie"],
  CHF: ["franc"],
  GHS: ["cedi"],
};

function buildCurrencies(): Currency[] {
  const byCode = new Map<string, Currency>();
  for (const country of worldCountries) {
    if (!country.currencies) continue;
    for (const [code, info] of Object.entries(country.currencies)) {
      if (byCode.has(code)) continue;
      byCode.set(code, { code, name: info.name, symbol: info.symbol ?? code, aliases: ALIASES[code] ?? [] });
    }
  }
  return [...byCode.values()].sort((a, b) => a.name.localeCompare(b.name));
}

export const CURRENCIES: Currency[] = buildCurrencies();

export const CURRENCIES_BY_CODE: Map<string, Currency> = new Map(CURRENCIES.map((c) => [c.code, c]));

/** Country's cca2 -> its primary currency code, or null if unknown/online (no country). */
export function suggestCurrencyForCountryCode(countryCode: string | null | undefined): string | null {
  if (!countryCode) return null;
  const country = worldCountries.find((c) => c.cca2 === countryCode);
  if (!country?.currencies) return null;
  return Object.keys(country.currencies)[0] ?? null;
}
