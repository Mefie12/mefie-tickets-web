import type { PublicBundle, PublicProduct, PublicTicketOption } from "@/lib/publicEventApi";
import { bundleLineKey, isBundleAvailable } from "@/lib/bundleCart";
import type { StoredCartItem } from "@/lib/cartStorage";

export const ticketLineKey = (productId: number, optionId: number | null) => `${productId}:${optionId ?? "direct"}`;

/** Is this line something a buyer could pick right now? */
export function isLineAvailable(product: PublicProduct, option: PublicTicketOption | null): boolean {
  return option ? option.is_available : product.is_on_sale && !product.is_sold_out;
}

/**
 * The most tickets a buyer may select for one line: the organizer's
 * per-order cap (10 when unset), further limited by what's left. The one
 * definition shared by the quantity stepper and by cart restoration, so
 * they can't drift.
 */
export function maxQuantityFor(product: PublicProduct, option: PublicTicketOption | null): number {
  const limit = option?.max_attendees_per_registration ?? product.max_attendees_per_registration ?? 10;
  const remaining = option?.quantity_remaining ?? product.quantity_remaining;
  return Math.min(limit, remaining ?? limit);
}

/**
 * Turns a stored selection back into stepper quantities, re-validated
 * against the live event: unknown or unavailable lines are dropped and
 * quantities are clamped to what can still be bought. Anything the buyer
 * can't actually select any more simply isn't restored.
 */
export function restoreQuantities(items: StoredCartItem[], products: PublicProduct[], bundles: PublicBundle[] = []): Record<string, number> {
  const out: Record<string, number> = {};
  for (const item of items) {
    if (typeof item.bundle_id === "number") {
      const bundle = bundles.find((b) => b.id === item.bundle_id);
      if (!bundle || !isBundleAvailable(bundle)) continue;
      const quantity = Math.min(item.quantity, bundle.max_per_order ?? 10, bundle.buyable ?? Infinity);
      if (quantity > 0) out[bundleLineKey(bundle.id)] = quantity;
      continue;
    }
    const product = products.find((p) => p.id === item.product_id);
    if (!product) continue;
    const tiered = product.type === "TIERED";
    const option = tiered ? (product.options ?? []).find((o) => o.id === item.ticket_option_id) ?? null : null;
    if (tiered !== (item.ticket_option_id !== null) || (tiered && option === null)) continue;
    if (!isLineAvailable(product, option)) continue;
    const quantity = Math.min(item.quantity, maxQuantityFor(product, option));
    if (quantity > 0) out[ticketLineKey(product.id, option?.id ?? null)] = quantity;
  }
  return out;
}
