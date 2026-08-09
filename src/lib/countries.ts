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
};

/** Regional-indicator-symbol trick: no image/SVG asset needed, computed straight from the ISO code. */
function flagEmoji(alpha2: string): string {
  return alpha2
    .toUpperCase()
    .split("")
    .map((letter) => String.fromCodePoint(127397 + letter.charCodeAt(0)))
    .join("");
}

export const COUNTRIES: Country[] = worldCountries
  .map((country) => ({
    code: country.cca2,
    name: country.name.common,
    aliases: (country.altSpellings ?? []).map((alias) => alias.toLowerCase()),
    flag: flagEmoji(country.cca2),
  }))
  .sort((a, b) => a.name.localeCompare(b.name));

export const COUNTRIES_BY_CODE: Map<string, Country> = new Map(COUNTRIES.map((c) => [c.code, c]));
