/**
 * Pure helpers for the admin "early payout" (partial payout / advance)
 * dialog. The server is the only authority on how much may be paid — it
 * re-derives the reserve floor on every call — so nothing here decides
 * what is allowed; these just turn what an admin types into integer minor
 * units and back, and phrase the server's outcomes.
 *
 * Currency-aware: a zero-decimal currency (XOF, UGX, ...) takes whole
 * numbers only, everything else up to two decimals (see currencyExponent).
 */
import { currencyExponent } from "@/lib/money";

/**
 * "12.34" GBP → 1234; "5000" XOF → 5000. Exact (no floating point). Null for empty, malformed, negative input, or
 * more decimals than the currency has (any decimals at all for a zero-decimal currency).
 */
export function majorStringToMinor(input: string, currencyCode: string): number | null {
  const trimmed = input.trim();
  const exponent = currencyExponent(currencyCode);
  const pattern = exponent === 0 ? /^\d+$/ : new RegExp(`^\\d+(\\.\\d{1,${exponent}})?$`);
  if (!pattern.test(trimmed)) return null;
  const [whole, fraction = ""] = trimmed.split(".");
  return Number(whole) * 10 ** exponent + Number(fraction.padEnd(exponent, "0") || "0");
}

/** 1234 GBP → "12.34"; 5000 XOF → "5000" (plain, for an input's value — not a formatted currency string). */
export function minorToMajorString(minor: number, currencyCode: string): string {
  const exponent = currencyExponent(currencyCode);
  if (exponent === 0) return String(minor);
  const scale = 10 ** exponent;
  const whole = Math.floor(minor / scale);
  const fraction = String(minor % scale).padStart(exponent, "0");
  return `${whole}.${fraction}`;
}

/** A percentage of the maximum, rounded DOWN so a percentage chip can never exceed the cap. */
export function percentOfMax(maxMinor: number, percent: number): number {
  return Math.floor((maxMinor * percent) / 100);
}

export type AdvanceSummary = {
  event_id: number;
  currency: string;
  base_minor: number;
  reserve_bp: number;
  floor_minor: number;
  outstanding_minor: number;
  max_advance_minor: number;
  state: string;
};

/** What the server's non-success outcomes / blocking states mean to an admin. */
export function advanceOutcomeCopy(outcome: string, accountStatus?: string): string {
  switch (outcome) {
    case "DISABLED":
      return "Early payouts are not enabled on this platform.";
    case "DRAFT_EVENT":
      return "This event is still a draft.";
    case "PAYOUT_RESTRICTED":
    case "ORG_RESTRICTED":
      return "This organization's payouts are restricted — clear the restriction first.";
    case "NOTHING_ABOVE_FLOOR":
      return "Everything above the reserve has already been paid out. More becomes available as new tickets sell.";
    case "USE_ROUTINE_RELEASE":
      return "This event's earnings have passed their hold period — use “Release eligible funds” instead; no reserve applies any more.";
    case "INVALID_AMOUNT":
      return "Enter an amount greater than zero.";
    case "BELOW_MINIMUM":
      return "That is below the minimum early payout.";
    case "EXCEEDS_AVAILABLE":
      return "That is more than can be paid out right now without dipping into the reserve.";
    case "INSUFFICIENT_PROVIDER_BALANCE":
      return "The platform's available balance with the payment provider can't cover this yet — recent sales may still be pending. Try a smaller amount or wait for funds to settle.";
    case "PROVIDER_BALANCE_UNAVAILABLE":
      return "Couldn't check the platform's balance with the payment provider. Try again shortly.";
    case "ACCOUNT_NOT_CONNECTED":
      return "There is no connected payment account holding this event's earnings.";
    case "ACCOUNT_NOT_READY":
      return accountStatus === "DISCONNECTED"
        ? "The account holding this money has lost its connection to the payment provider and needs to be reconnected first."
        : "The organizer hasn't finished payment setup with the provider yet, so nothing can be sent.";
    case "MULTIPLE_ACCOUNTS_ELIGIBLE":
      return "This event's earnings sit on more than one payment account — it needs manual review.";
    case "PREVIEW_STALE":
      return "Earnings or earlier payouts changed since you reviewed this. Review the refreshed figures and confirm again.";
    default:
      return "This action isn't available right now.";
  }
}
