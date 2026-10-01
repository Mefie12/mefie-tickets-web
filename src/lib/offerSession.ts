/**
 * The buyer's applied promo, carried from the event page into /checkout
 * (and across a refresh) in sessionStorage, next to cartStorage.ts.
 *
 * Only the *input* (typed code or share token) and the discount the buyer
 * was last shown are stored. `expected_discount_minor` is sent to the
 * order endpoint purely as a staleness assertion — the server never
 * trusts it as a price.
 */
export type StoredOffer = {
  promo_code?: string | null;
  offer_token?: string | null;
  expected_discount_minor: number;
};

const key = (eventId: number) => `mefie-offer:${eventId}`;

export function saveOffer(eventId: number, value: StoredOffer | null): void {
  try {
    if (value === null || (!value.promo_code && !value.offer_token && value.expected_discount_minor === 0)) {
      sessionStorage.removeItem(key(eventId));
    } else {
      sessionStorage.setItem(key(eventId), JSON.stringify(value));
    }
  } catch {
    // Private mode / blocked storage: the offer simply doesn't survive navigation.
  }
}

export function loadOffer(eventId: number): StoredOffer | null {
  try {
    const raw = sessionStorage.getItem(key(eventId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as StoredOffer;
    return typeof parsed?.expected_discount_minor === "number" ? parsed : null;
  } catch {
    return null;
  }
}

export function clearOffer(eventId: number): void {
  saveOffer(eventId, null);
}
