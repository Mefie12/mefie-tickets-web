import type { Order } from "@/lib/checkoutApi";
import { trackCommerce, whenAnalyticsActive } from "@/lib/analytics/runtime";
import type { CommerceEvent, CommerceItem } from "@/lib/analytics/types";

/**
 * Shopping events (docs/26, Phase 2b-2): view_item on a public event page,
 * begin_checkout when an order is created, purchase at confirmation. The
 * builders are pure; sending goes through runtime.ts to whichever tools are
 * started (consent + public page + configured).
 */

/** "12.50" -> 12.5. Null for blank or anything that is not a finite, non-negative amount. */
export function parseMoney(value: unknown): number | null {
  if (typeof value !== "string" && typeof value !== "number") return null;
  // Number("") and Number("  ") are 0: a blank amount must stay "unknown", never become a free purchase.
  if (typeof value === "string" && value.trim() === "") return null;
  const parsed = typeof value === "number" ? value : Number(value.trim());
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
}

function orderItems(order: Order): CommerceItem[] {
  return order.items.map((item) => ({
    name: item.ticket_display_name,
    ...(parseMoney(item.price) !== null ? { price: parseMoney(item.price) as number } : {}),
    quantity: item.quantity,
  }));
}

export function viewItemEvent(event: { title: string; currency_code: string }): CommerceEvent {
  return { type: "view_item", currency: event.currency_code.toUpperCase(), items: [{ name: event.title, quantity: 1 }] };
}

/** Null when the order has no usable total (never send a made-up value). */
export function beginCheckoutEvent(order: Order): CommerceEvent | null {
  const value = parseMoney(order.total_amount);
  if (value === null || !order.currency) return null;
  return { type: "begin_checkout", currency: order.currency.toUpperCase(), value, items: orderItems(order) };
}

/** Only a COMPLETED order is a purchase. Tax is included only when it is a positive amount. */
export function purchaseEvent(order: Order): CommerceEvent | null {
  if (order.status !== "COMPLETED") return null;
  const value = parseMoney(order.total_amount);
  if (value === null || !order.currency || !order.short_id) return null;
  const tax = parseMoney(order.tax_amount);
  return {
    type: "purchase",
    transactionId: order.short_id,
    currency: order.currency.toUpperCase(),
    value,
    ...(tax !== null && tax > 0 ? { tax } : {}),
    items: orderItems(order),
  };
}

// --- purchase de-duplication -------------------------------------------------
// The confirmation screen can be reached more than once for one order (a reload
// re-polls the order status; a 3-D Secure return lands on the same page), so a
// purchase is remembered by order id and sent at most once.
const TRACKED_KEY = "mefie-purchase-tracked";
const MAX_REMEMBERED = 30;
const trackedInMemory = new Set<string>();

function readTracked(): string[] {
  try {
    const parsed = JSON.parse(window.localStorage.getItem(TRACKED_KEY) ?? "[]");
    return Array.isArray(parsed) ? parsed.filter((id): id is string => typeof id === "string") : [];
  } catch {
    return [];
  }
}

export function hasTrackedPurchase(orderId: string): boolean {
  return trackedInMemory.has(orderId) || (typeof window !== "undefined" && readTracked().includes(orderId));
}

function markTrackedPurchase(orderId: string): void {
  trackedInMemory.add(orderId);
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(TRACKED_KEY, JSON.stringify([...readTracked().filter((id) => id !== orderId), orderId].slice(-MAX_REMEMBERED)));
  } catch {
    // Storage blocked: the in-memory set still covers this page load.
  }
}

/**
 * Sends `purchase` once per order. It is remembered only if at least one tool
 * really received it: with no consent nothing is sent and nothing is
 * remembered, but a later reload with consent must not then count an old order
 * as if it were new, so callers invoke this only at the moment of purchase.
 */
export function trackPurchase(order: Order): boolean {
  const event = purchaseEvent(order);
  if (!event || hasTrackedPurchase(order.short_id)) return false;
  const sent = trackCommerce(event) > 0;
  if (sent) markTrackedPurchase(order.short_id);
  return sent;
}

export function trackBeginCheckout(order: Order): boolean {
  const event = beginCheckoutEvent(order);
  return event ? trackCommerce(event) > 0 : false;
}

/** Sends view_item once the tools are started (page components mount before the controller starts them). */
export function trackViewItemWhenReady(event: { title: string; currency_code: string }): () => void {
  return whenAnalyticsActive(() => {
    trackCommerce(viewItemEvent(event));
  });
}
