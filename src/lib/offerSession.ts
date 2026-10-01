import type { QuoteStatus } from "@/lib/offersApi";

/**
 * The buyer's applied promo, kept in sessionStorage (per tab, like
 * cartStorage.ts) so it survives a reload and the trip event page ⇄
 * checkout.
 *
 * Principles:
 * - Store the INPUT (typed code or share token), never a price. The
 *   stored `expected_discount_minor` is only the discount the buyer was
 *   last shown, sent to the order endpoint as a staleness assertion — the
 *   server recalculates everything and never trusts it.
 * - Stored data is never trusted on load: every restore is re-quoted, and
 *   a code the server rejects is dropped (offerAfterQuote), so a bad or
 *   since-expired code is not resurrected on every reload.
 * - Versioned envelope + expiry, so a format change or a tab left open for
 *   days can't revive stale state; malformed data is ignored.
 * - Storage failure (private mode, quota) degrades silently to "doesn't
 *   survive navigation".
 */
export type StoredOffer = {
  promo_code?: string | null;
  offer_token?: string | null;
  expected_discount_minor: number;
};

const VERSION = 1;
export const OFFER_TTL_MS = 24 * 60 * 60 * 1000;

type Envelope = { v: number; saved_at: number; offer: StoredOffer };

const key = (eventId: number) => `mefie-offer:${eventId}`;

const hasInput = (o: StoredOffer) => !!o.promo_code || !!o.offer_token;

export function saveOffer(eventId: number, value: StoredOffer | null, now: number = Date.now()): void {
  try {
    if (value === null || (!hasInput(value) && value.expected_discount_minor === 0)) {
      sessionStorage.removeItem(key(eventId));
      return;
    }
    const envelope: Envelope = { v: VERSION, saved_at: now, offer: value };
    sessionStorage.setItem(key(eventId), JSON.stringify(envelope));
  } catch {
    // Private mode / blocked storage: the offer simply doesn't survive navigation.
  }
}

export function loadOffer(eventId: number, now: number = Date.now()): StoredOffer | null {
  try {
    const raw = sessionStorage.getItem(key(eventId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<Envelope>;
    const offer = parsed?.offer;
    const valid =
      parsed?.v === VERSION &&
      typeof parsed.saved_at === "number" &&
      now - parsed.saved_at <= OFFER_TTL_MS &&
      !!offer &&
      typeof offer.expected_discount_minor === "number";
    if (!valid) {
      sessionStorage.removeItem(key(eventId));
      return null;
    }
    return offer;
  } catch {
    return null;
  }
}

export function clearOffer(eventId: number): void {
  saveOffer(eventId, null);
}

/**
 * What to persist once the server has answered for the current input:
 * - REJECTED → "REMOVE" (never resurrect a code the server refused),
 * - a usable code, or one that only needs email verification → save it
 *   together with the discount the buyer is now shown,
 * - anything else (no offer in play) → "KEEP" whatever is stored.
 */
export function offerAfterQuote(
  input: { promo_code?: string | null; offer_token?: string | null },
  quote: { status: QuoteStatus; discount_total_minor: number },
): StoredOffer | "REMOVE" | "KEEP" {
  if (!input.promo_code && !input.offer_token) return "KEEP";
  switch (quote.status) {
    case "REJECTED":
      return "REMOVE";
    case "APPLIED":
      return { promo_code: input.promo_code ?? null, offer_token: input.offer_token ?? null, expected_discount_minor: quote.discount_total_minor };
    case "VERIFICATION_REQUIRED":
      return { promo_code: input.promo_code ?? null, offer_token: input.offer_token ?? null, expected_discount_minor: 0 };
    default:
      return "KEEP";
  }
}
