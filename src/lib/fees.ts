/**
 * Buyer-facing cost maths, mirroring the server so the storefront can
 * show the all-in price (mandatory fees + tax included) BEFORE an order
 * exists — instead of revealing fees only at the payment step.
 *
 * The rates below are frozen onto the event at publish
 * (EventPaymentBindingService) and the arithmetic is deterministic
 * integer maths identical to App\Domain\Payments\ValueObjects\Money, so
 * the figure here equals the real order to the penny — it is the actual
 * price, not an estimate.
 *
 * The buyer never sees "card processing fee": the platform fee and the
 * card-processing fee, whichever were passed on, are summed into one
 * "Service fee" (a card-labelled surcharge is prohibited for consumer
 * cards in the UK/EEA).
 *
 * Assumes 2-decimal currencies (matches src/lib/money.ts). Zero-decimal
 * currencies (JPY etc.) are not yet special-cased.
 */

export type FeeBearer = "ATTENDEE" | "ORGANIZER";

export type EventPricing = {
  tax_basis_points: number;
  tax_bearer: FeeBearer;
  platform_fee_basis_points: number;
  platform_fee_bearer: FeeBearer;
  processing_fee_basis_points: number;
  processing_fee_flat_minor: number;
  processing_fee_bearer: FeeBearer;
};

export type BuyerCosts = {
  subtotalMinor: number;
  /** platform fee + card-processing fee, but only the parts passed to the buyer. */
  serviceFeeMinor: number;
  /** tax, only if passed to the buyer. */
  taxMinor: number;
  totalMinor: number;
};

/** Money::percentageOf — integer half-up, no floating point. */
function pctOfMinor(subtotalMinor: number, basisPoints: number): number {
  return Math.floor((subtotalMinor * basisPoints + 5000) / 10000);
}

export function computeBuyerCosts(subtotalMinor: number, p: EventPricing): BuyerCosts {
  const taxMinor = pctOfMinor(subtotalMinor, p.tax_basis_points);
  const platformMinor = pctOfMinor(subtotalMinor, p.platform_fee_basis_points);
  // Never bolt a flat fee onto a free order.
  const processingMinor =
    subtotalMinor > 0
      ? pctOfMinor(subtotalMinor, p.processing_fee_basis_points) + p.processing_fee_flat_minor
      : 0;

  const serviceFeeMinor =
    (p.platform_fee_bearer === "ATTENDEE" ? platformMinor : 0) +
    (p.processing_fee_bearer === "ATTENDEE" ? processingMinor : 0);
  const taxToBuyerMinor = p.tax_bearer === "ATTENDEE" ? taxMinor : 0;

  return {
    subtotalMinor,
    serviceFeeMinor,
    taxMinor: taxToBuyerMinor,
    totalMinor: subtotalMinor + serviceFeeMinor + taxToBuyerMinor,
  };
}
