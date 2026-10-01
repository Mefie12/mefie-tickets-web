/**
 * One place for every buyer- and organizer-facing offer message, so the
 * wording can be reviewed together. Keys are the machine codes returned by
 * the API (see OrderService / OfferService on the backend). Copy is plain
 * and avoids internal terms like "redemption" or "capacity".
 */
const MESSAGES: Record<string, string> = {
  OFFER_CODE_INVALID: "This code isn’t valid or is no longer available.",
  OFFER_NOT_APPLICABLE: "This code doesn’t apply to the tickets in your cart.",
  OFFER_CUSTOMER_LIMIT_REACHED: "You’ve already used this offer the maximum number of times.",
  OFFER_CAPACITY_EXHAUSTED: "Sorry, this offer has run out.",
  OFFER_VERIFICATION_REQUIRED: "Verify your email to use this offer.",
  // 409 — the price changed between the quote and the order.
  OFFER_CAPACITY_CHANGED: "This offer just ran out.",
  OFFER_EXPIRED: "This offer has ended.",
  OFFER_NO_LONGER_ELIGIBLE: "This offer is no longer available.",
  OFFER_STATE_CHANGED: "The price for this offer has changed.",
  OFFER_DISCOUNT_TOO_DEEP: "This offer can’t be applied to this order.",
  OFFER_CURRENCY_MISMATCH: "This offer can’t be applied to this event.",
  // organizer management
  OFFER_LOCKED: "Discount, tickets, dates, limits and code can’t be changed after an offer is activated.",
  OFFER_INVALID_TRANSITION: "That change isn’t available for an offer in this state.",
  OFFER_NOT_DELETABLE: "Only draft offers with no activity can be deleted.",
  OFFER_AUTOMATIC_ALREADY_ACTIVE: "Another automatic offer is already active for this event. Pause it first.",
};

export function offerErrorMessage(code: string | null | undefined, fallback = "Something went wrong with this offer."): string {
  return (code && MESSAGES[code]) || fallback;
}

/** The 409s that mean "what you were quoted is no longer true" — the buyer must accept a new price. */
export const STALE_OFFER_CODES = new Set([
  "OFFER_CAPACITY_CHANGED",
  "OFFER_EXPIRED",
  "OFFER_NO_LONGER_ELIGIBLE",
  "OFFER_STATE_CHANGED",
]);

export function isStaleOfferCode(code: string | null | undefined): boolean {
  return !!code && STALE_OFFER_CODES.has(code);
}
