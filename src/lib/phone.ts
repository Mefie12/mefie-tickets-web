import { parsePhoneNumberFromString } from "libphonenumber-js";
import type { CountryCode } from "libphonenumber-js";

/**
 * Converts a locally entered number into the only wire format the API
 * accepts: a valid E.164 number. A national prefix is handled by the
 * selected country (for example GB + 07429 395467 becomes +447429395467).
 */
export function normalizePhoneNumber(value: string, country?: CountryCode | null): string {
  const phone = parsePhoneNumberFromString(value.trim(), country ?? undefined);
  return phone?.isValid() ? phone.number : "";
}

/** Validates the E.164 values emitted by PhoneInput and stored by the API. */
export function isValidInternationalPhoneNumber(value: string | null | undefined): boolean {
  return Boolean(value && parsePhoneNumberFromString(value)?.isValid());
}

/** Uses browser language preferences only; never location or IP inference. */
export function browserCountryCode(availableCountries: ReadonlySet<string>): CountryCode | null {
  if (typeof navigator === "undefined") return null;

  const languages = navigator.languages?.length ? navigator.languages : [navigator.language];
  for (const language of languages) {
    try {
      const country = new Intl.Locale(language).region?.toUpperCase();
      if (country && availableCountries.has(country)) return country as CountryCode;
    } catch {
      // A malformed browser language preference simply falls through to
      // the next preference, then to the user-selectable empty state.
    }
  }

  return null;
}
