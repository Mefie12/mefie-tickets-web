import worldCountries from "world-countries";

/**
 * Thin local adapter over the `world-countries` npm package — the rest
 * of the app (and CountrySelector) depends on this small stable shape
 * rather than the npm package's full schema. `code` is always the ISO
 * 3166-1 alpha-2 code — the only value that should ever be stored
 * anywhere (payments, addresses, tax, analytics, Mapbox all need this,
 * not a free-text name).
 */
export type Country = {
  code: string;
  name: string;
  /** Lowercased common abbreviations/alt names (e.g. "uk", "u.k." for GB) — matched against when searching. */
  aliases: string[];
  flag: string;
  /**
   * ISO 4217 code of the country's common currency, straight from
   * `world-countries`' own data (not a hand-maintained table) — a
   * convenience default for pre-filling a currency picker, never a
   * claim about what any payment provider actually supports for that
   * country. Null for the rare country the package reports none for.
   */
  defaultCurrency: string | null;
};

/** Regional-indicator-symbol trick: no image/SVG asset needed, computed straight from the ISO code. */
function flagEmoji(alpha2: string): string {
  return alpha2
    .toUpperCase()
    .split("")
    .map((letter) => String.fromCodePoint(127397 + letter.charCodeAt(0)))
    .join("");
}

/**
 * `world-countries`' own currency-key ordering is wrong for one real
 * case: Cuba (CU) lists CUC first, a currency discontinued in January
 * 2021 — see the same correction (and rationale) applied to the
 * backend's independently-generated country map in
 * config/payment_provider_currency_matrix.php on the API. Keep both
 * in sync if this ever needs another entry.
 */
const DEFAULT_CURRENCY_OVERRIDES: Record<string, string> = { CU: "CUP" };

export const COUNTRIES: Country[] = worldCountries
  .map((country) => ({
    code: country.cca2,
    name: country.name.common,
    aliases: (country.altSpellings ?? []).map((alias) => alias.toLowerCase()),
    flag: flagEmoji(country.cca2),
    defaultCurrency: DEFAULT_CURRENCY_OVERRIDES[country.cca2] ?? Object.keys(country.currencies ?? {})[0] ?? null,
  }))
  .sort((a, b) => a.name.localeCompare(b.name));

export const COUNTRIES_BY_CODE: Map<string, Country> = new Map(COUNTRIES.map((c) => [c.code, c]));
