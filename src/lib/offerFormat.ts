import { formatBasisPointsAsPercent, formatMinorAmount } from "@/lib/money";
import type { Offer, OfferStatus, PublicOffer } from "@/lib/offersApi";

type DiscountShape = Pick<Offer | PublicOffer, "discount_type" | "discount_value" | "currency_code">;

/** "20% off" / "GHS 10.00 off per ticket". */
export function discountLabel(offer: DiscountShape): string {
  return offer.discount_type === "PERCENTAGE"
    ? `${formatBasisPointsAsPercent(offer.discount_value)} off`
    : `${formatMinorAmount(offer.discount_value, offer.currency_code)} off`;
}

/** "ends Jun 10" — short, in the viewer's locale-independent en-GB format. */
export function endsLabel(endsAt: string, timezone?: string): string {
  try {
    return `ends ${new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", timeZone: timezone }).format(new Date(endsAt))}`;
  } catch {
    return "";
  }
}

export const STATUS_LABEL: Record<OfferStatus, string> = {
  DRAFT: "Draft",
  ACTIVE: "Active",
  PAUSED: "Paused",
  ENDED: "Ended",
};

export const STATUS_COLOR: Record<OfferStatus, string> = {
  DRAFT: "gray",
  ACTIVE: "teal",
  PAUSED: "yellow",
  ENDED: "gray",
};

/** Share URL for a code offer, built from the public event URL the page passes in. */
export function shareUrl(eventUrl: string, token: string): string {
  const joiner = eventUrl.includes("?") ? "&" : "?";
  return `${eventUrl}${joiner}offer=${encodeURIComponent(token)}`;
}

/** Applies the discount to a unit price (minor units) the same way the server does, for previews only. */
export function previewDiscountedUnit(unitMinor: number, offer: Pick<Offer, "discount_type" | "discount_value">): number {
  const discount =
    offer.discount_type === "PERCENTAGE"
      ? Math.floor((unitMinor * offer.discount_value + 5000) / 10000)
      : offer.discount_value;
  return Math.max(0, unitMinor - Math.min(discount, unitMinor));
}
