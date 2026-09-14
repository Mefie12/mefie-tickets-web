/**
 * Hands the buyer's ticket selection off from the event page to the
 * dedicated /checkout page across a real navigation — sessionStorage,
 * not React state, since a route change unmounts the whole component
 * tree. Only product/option ids + quantity are stored; everything else
 * (title, price) is re-derived from the live event data the checkout
 * page fetches fresh, same as how the rest of checkout already treats
 * price as authoritative-from-the-server, never cached client-side.
 */
export type StoredCartItem = { product_id: number; ticket_option_id: number | null; quantity: number };

function cartStorageKey(eventId: number): string {
  return `mefie-cart:${eventId}`;
}

export function saveCart(eventId: number, items: StoredCartItem[]): void {
  sessionStorage.setItem(cartStorageKey(eventId), JSON.stringify(items));
}

/** Null when nothing (valid) is stored — callers treat that as "no cart, send the buyer back". */
export function loadCart(eventId: number): StoredCartItem[] | null {
  const raw = sessionStorage.getItem(cartStorageKey(eventId));
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as StoredCartItem[];
    return Array.isArray(parsed) && parsed.length > 0 ? parsed : null;
  } catch {
    return null;
  }
}

export function clearCart(eventId: number): void {
  sessionStorage.removeItem(cartStorageKey(eventId));
}
