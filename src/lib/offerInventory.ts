import type { Product } from "@/lib/productApi";
import type { OfferScopeRow } from "@/lib/offersApi";

export type OfferTicketOption = { id: number; name: string; priceMinor: number };
export type OfferTicketType = { productId: number; title: string; tiered: boolean; priceMinor: number | null; options: OfferTicketOption[] };

const toMinor = (price: string | null | undefined) => Math.round(Number(price ?? 0) * 100);

/** The ticket types an offer can target, with their option prices (for previews). */
export function offerInventory(products: Product[]): OfferTicketType[] {
  return products
    .filter((p) => p.product_type === "TICKET" && !p.disabled_at)
    .map((p) => ({
      productId: p.id,
      title: p.title,
      tiered: p.type === "TIERED",
      priceMinor: p.type === "TIERED" ? null : toMinor(p.price),
      options: p.type === "TIERED" ? p.price_tiers.filter((t) => t.is_enabled).map((t) => ({ id: t.id, name: t.name, priceMinor: toMinor(t.price) })) : [],
    }));
}

/** Human labels for a scope, e.g. ["VIP", "General — Regular"]. */
export function scopeLabels(scope: OfferScopeRow[], inventory: OfferTicketType[]): string[] {
  return scope.map((row) => {
    const type = inventory.find((t) => t.productId === row.product_id);
    if (!type) return `Ticket #${row.product_id}`;
    if (row.ticket_option_id === null) return type.tiered ? `${type.title} — all options` : type.title;
    return `${type.title} — ${type.options.find((o) => o.id === row.ticket_option_id)?.name ?? `option #${row.ticket_option_id}`}`;
  });
}

/** The unit price (minor) of the first in-scope ticket, for previews. */
export function samplePriceMinor(scope: OfferScopeRow[], inventory: OfferTicketType[]): number | null {
  for (const row of scope) {
    const type = inventory.find((t) => t.productId === row.product_id);
    if (!type) continue;
    if (row.ticket_option_id !== null) {
      const option = type.options.find((o) => o.id === row.ticket_option_id);
      if (option) return option.priceMinor;
    } else if (type.priceMinor !== null) {
      return type.priceMinor;
    } else if (type.options[0]) {
      return type.options[0].priceMinor;
    }
  }
  return null;
}
