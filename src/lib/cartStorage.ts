/**
 * The buyer's ticket selection, kept in sessionStorage (per tab; nothing is
 * sent to the server and no inventory is held until an order is created).
 * It is written on every change on the event page (so a reload restores it),
 * read by the dedicated /checkout page across a real navigation, and cleared
 * once an order completes. Only product/option ids + quantity are stored;
 * titles, prices and availability are re-derived from the live event data,
 * and restored quantities are re-validated against it (see
 * lib/ticketLimits.ts) — price is never trusted from storage.
 *
 * Versioned envelope + expiry: a format change, or a tab left open for days,
 * can't revive stale state; malformed data is ignored. Storage failures
 * (private mode, quota) degrade silently to "doesn't survive navigation".
 */
export type StoredCartItem = { product_id: number; ticket_option_id: number | null; quantity: number };

const VERSION = 1;
export const CART_TTL_MS = 24 * 60 * 60 * 1000;

type Envelope = { v: number; saved_at: number; items: StoredCartItem[] };

function cartStorageKey(eventId: number): string {
  return `mefie-cart:${eventId}`;
}

export function saveCart(eventId: number, items: StoredCartItem[], now: number = Date.now()): void {
  try {
    const envelope: Envelope = { v: VERSION, saved_at: now, items };
    sessionStorage.setItem(cartStorageKey(eventId), JSON.stringify(envelope));
  } catch {
    // Storage unavailable: the selection just won't survive navigation.
  }
}

const isItem = (i: unknown): i is StoredCartItem => {
  const item = i as StoredCartItem;
  return !!item && Number.isInteger(item.product_id) && Number.isInteger(item.quantity) && item.quantity > 0
    && (item.ticket_option_id === null || Number.isInteger(item.ticket_option_id));
};

/** Null when nothing (valid) is stored — callers treat that as "no cart". */
export function loadCart(eventId: number, now: number = Date.now()): StoredCartItem[] | null {
  try {
    const raw = sessionStorage.getItem(cartStorageKey(eventId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<Envelope>;
    const valid = parsed?.v === VERSION && typeof parsed.saved_at === "number" && now - parsed.saved_at <= CART_TTL_MS && Array.isArray(parsed.items);
    if (!valid) {
      sessionStorage.removeItem(cartStorageKey(eventId));
      return null;
    }
    const items = (parsed.items as unknown[]).filter(isItem);
    return items.length > 0 ? items : null;
  } catch {
    return null;
  }
}

export function clearCart(eventId: number): void {
  try {
    sessionStorage.removeItem(cartStorageKey(eventId));
  } catch {
    // ignore
  }
}
