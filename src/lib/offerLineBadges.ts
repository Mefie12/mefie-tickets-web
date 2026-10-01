import { discountLabel, endsLabel } from "@/lib/offerFormat";
import { ticketLineKey } from "@/components/TicketSelector";
import { formatMinorAmount } from "@/lib/money";
import type { PublicOffer, Quote } from "@/lib/offersApi";

export type LineDiscount = { badge: string };

/**
 * What to show on each ticket row. With a quote that applied an offer, the
 * badge reflects the server's allocation for that exact line ("Save £20.00",
 * "Save £10.00 · 1 of 3 tickets"). Without one, rows an advertised offer
 * covers get a plain "20% off · ends Jun 10" badge so the sale is visible
 * before anything is selected. Never recomputes an allocation client-side.
 */
export function lineDiscounts(args: {
  quote?: Quote;
  advertised?: PublicOffer | null;
  timezone?: string;
}): Record<string, LineDiscount> {
  const { quote, advertised, timezone } = args;
  const out: Record<string, LineDiscount> = {};

  if (quote?.status === "APPLIED" && quote.offer) {
    for (const line of quote.lines) {
      if (line.discounted_units <= 0) continue;
      const partial = line.discounted_units < line.quantity;
      out[ticketLineKey(line.product_id, line.ticket_option_id)] = {
        badge: `Save ${formatMinorAmount(line.discount_minor, quote.currency)}${partial ? ` · ${line.discounted_units} of ${line.quantity} tickets` : ""}`,
      };
    }
    return out;
  }

  if (advertised) {
    for (const row of advertised.scope) {
      // A whole-product row covers every option of that product; the
      // selector builds keys per option, so cover both shapes.
      const label = `${discountLabel(advertised)} · ${endsLabel(advertised.ends_at, timezone)}`.trim();
      out[ticketLineKey(row.product_id, row.ticket_option_id)] = { badge: label };
    }
  }
  return out;
}

/** Whole-product scope rows have no option id; expand them over a product's options so tiered rows match. */
export function expandScope(
  offer: PublicOffer,
  products: Array<{ id: number; options?: Array<{ id: number }> | null }>,
): PublicOffer {
  const scope = offer.scope.flatMap((row) => {
    if (row.ticket_option_id !== null) return [row];
    const product = products.find((p) => p.id === row.product_id);
    const options = product?.options ?? [];
    return options.length > 0 ? options.map((o) => ({ product_id: row.product_id, ticket_option_id: o.id })) : [row];
  });
  return { ...offer, scope };
}
