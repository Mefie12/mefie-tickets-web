import type { Quote } from "@/lib/offersApi";

/**
 * The buyer-visible cost rows for a quote, shaped for OrderCostBreakdown:
 * platform + processing fees collapse into one "service fee" (only the
 * parts passed to the buyer), tax only if passed to the buyer. The totals
 * themselves are the server's — never recomputed here.
 */
export function amountsFromQuote(q: Quote) {
  return {
    currency: q.currency,
    subtotalMinor: q.gross_subtotal_minor,
    discountMinor: q.discount_total_minor,
    serviceFeeMinor:
      (q.platform_fee_bearer === "ATTENDEE" ? q.platform_fee_minor : 0) +
      (q.processing_fee_bearer === "ATTENDEE" ? q.processing_fee_minor : 0),
    taxMinor: q.tax_bearer === "ATTENDEE" ? q.tax_minor : 0,
    totalMinor: q.total_minor,
  };
}
