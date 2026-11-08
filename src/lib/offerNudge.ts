import { formatBasisPointsAsPercent, formatMinorAmount } from "@/lib/money";
import { previewBundle, requiredQuantity } from "@/lib/offerFormat";
import { ticketLineKey } from "@/lib/ticketLimits";
import type { PublicOffer } from "@/lib/offersApi";

/** One ticket line the buyer has picked: what it costs, how many they hold, and the most they could hold. */
export type NudgeLine = {
  /** ticketLineKey(productId, optionId) */
  key: string;
  title: string;
  unitPriceMinor: number;
  quantity: number;
  /** maxQuantityFor(): the per-order cap further limited by remaining stock. */
  max: number;
  /** A tiered line: only tickets of the very same option count together. */
  tiered: boolean;
};

export type LineNudge = { key: string; message: string };

const plural = (n: number, word: string) => `${n} more ${word}${n === 1 ? "" : "s"}`;

/**
 * "Add 1 more ticket to get 2 for 350.00": a hint for an advertised quantity offer (a minimum, or a group price).
 * It only ever *suggests*; what the buyer really pays is decided by the server quote, and this never recomputes an
 * allocation. A hint appears only when it is true and reachable: the line is in the offer's scope, the buyer already
 * holds at least one, the missing tickets fit under the per-order cap and stock, and the deal really is a saving.
 */
export function offerNudges(
  offer: PublicOffer | null,
  lines: NudgeLine[],
  currency: string,
  /**
   * The server's answer for THIS offer and the current cart: can the order still get another full group? Limits
   * (per order, per customer, total) are never sent to the browser, so "another group" is only suggested once the
   * quote says true. Null = no up-to-date quote for this offer yet: stay quiet rather than risk a false promise.
   */
  nextGroupAvailable: boolean | null = null,
): LineNudge[] {
  const need = offer ? requiredQuantity(offer) : null;
  if (!offer || !need) return [];

  const inScope = new Set(offer.scope.map((row) => ticketLineKey(row.product_id, row.ticket_option_id)));
  const out: LineNudge[] = [];

  for (const line of lines) {
    if (!inScope.has(line.key) || line.quantity < 1 || line.unitPriceMinor <= 0) continue;

    const note = line.tiered ? " Tickets only count together when they are the same option." : "";
    let message: string | null = null;

    if (offer.discount_type === "GROUP_BUNDLE") {
      const bundle = previewBundle(line.unitPriceMinor, offer);
      if (!bundle || bundle.savingMinor <= 0) continue; // at this price the group is not a saving; the server skips it too
      const groups = Math.floor(line.quantity / need);
      const left = line.quantity % need;
      if (left === 0 && groups > 0) continue; // every ticket already sits in a full group
      if (offer.max_groups_per_order !== null && groups >= offer.max_groups_per_order) continue;
      if (groups > 0 && nextGroupAvailable !== true) continue;
      const missing = need - left;
      if (line.quantity + missing > line.max) continue;
      const price = formatMinorAmount(bundle.groupMinor, currency);
      message = groups === 0
        ? `Add ${plural(missing, "ticket")} to get ${need} for ${price} (save ${formatMinorAmount(bundle.savingMinor, currency)}).`
        : `Add ${plural(missing, "ticket")} to get another ${need} for ${price}.`;
    } else {
      if (line.quantity >= need) continue; // already qualifies
      const missing = need - line.quantity;
      if (line.quantity + missing > line.max) continue;
      const value = offer.discount_value ?? 0;
      if (value <= 0) continue;
      const phrase = offer.discount_type === "PERCENTAGE"
        ? `${formatBasisPointsAsPercent(value)} off`
        : `${formatMinorAmount(value, currency)} off each`;
      message = `Add ${plural(missing, "ticket")} to get ${phrase} every ${line.title} ticket.`;
    }

    out.push({ key: line.key, message: `${message}${note}` });
  }

  return out;
}
