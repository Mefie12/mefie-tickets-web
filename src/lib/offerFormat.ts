import { formatBasisPointsAsPercent, formatMinorAmount } from "@/lib/money";
import type { Offer, OfferPhase, OfferStatus, PublicOffer } from "@/lib/offersApi";

type DiscountShape = Pick<
  Offer | PublicOffer,
  "discount_type" | "discount_value" | "min_ticket_quantity" | "group_size" | "group_price_minor" | "currency_code"
>;

/**
 * "20% off" / "GHS 10.00 off" / "2 for GHS 350.00". A minimum quantity is appended when the offer has one
 * ("20% off when you buy 3 or more") so a buyer is never shown a discount that silently needs more tickets.
 */
export function discountLabel(offer: DiscountShape): string {
  if (offer.discount_type === "GROUP_BUNDLE") {
    return `${offer.group_size} for ${formatMinorAmount(offer.group_price_minor ?? 0, offer.currency_code)}`;
  }
  const value = offer.discount_value ?? 0;
  const base =
    offer.discount_type === "PERCENTAGE"
      ? `${formatBasisPointsAsPercent(value)} off`
      : `${formatMinorAmount(value, offer.currency_code)} off`;
  return offer.min_ticket_quantity ? `${base} when you buy ${offer.min_ticket_quantity} or more` : base;
}

/** How many tickets of one type the offer needs before it applies, or null if there is no condition. */
export function requiredQuantity(offer: Pick<DiscountShape, "discount_type" | "min_ticket_quantity" | "group_size">): number | null {
  return offer.discount_type === "GROUP_BUNDLE" ? offer.group_size : offer.min_ticket_quantity;
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

/** What organizers read: "Active" means usable right now; Scheduled/Expired are told apart from it. */
export const PHASE_LABEL: Record<OfferPhase, string> = {
  DRAFT: "Draft",
  SCHEDULED: "Scheduled",
  LIVE: "Active",
  PAUSED: "Paused",
  EXPIRED: "Expired",
  ENDED: "Ended",
};

export const PHASE_COLOR: Record<OfferPhase, string> = {
  DRAFT: "gray",
  SCHEDULED: "blue",
  LIVE: "teal",
  PAUSED: "yellow",
  EXPIRED: "gray",
  ENDED: "gray",
};

export type OfferTab = "ALL" | "LIVE" | "SCHEDULED" | "DRAFT" | "PAUSED" | "ENDED";

export const OFFER_TABS: { value: OfferTab; label: string }[] = [
  { value: "ALL", label: "All" },
  { value: "LIVE", label: "Active" },
  { value: "SCHEDULED", label: "Scheduled" },
  { value: "DRAFT", label: "Draft" },
  { value: "PAUSED", label: "Paused" },
  { value: "ENDED", label: "Ended" },
];

/** Expired offers (end time passed, not yet stored as ended) belong with the ended ones. */
export const tabOfPhase = (phase: OfferPhase): Exclude<OfferTab, "ALL"> => (phase === "EXPIRED" ? "ENDED" : phase);

export function offersByTab<T extends { phase: OfferPhase }>(offers: T[], tab: OfferTab): T[] {
  return tab === "ALL" ? offers : offers.filter((o) => tabOfPhase(o.phase) === tab);
}

/** Share URL for a code offer, built from the public event URL the page passes in. */
export function shareUrl(eventUrl: string, token: string): string {
  const joiner = eventUrl.includes("?") ? "&" : "?";
  return `${eventUrl}${joiner}offer=${encodeURIComponent(token)}`;
}

/** Applies the discount to a unit price (minor units) the same way the server does, for previews only. */
export function previewDiscountedUnit(unitMinor: number, offer: Pick<Offer, "discount_type" | "discount_value">): number {
  if (offer.discount_type === "GROUP_BUNDLE") return unitMinor;
  const value = offer.discount_value ?? 0;
  const discount = offer.discount_type === "PERCENTAGE" ? Math.floor((unitMinor * value + 5000) / 10000) : value;
  return Math.max(0, unitMinor - Math.min(discount, unitMinor));
}

/**
 * What one full group costs and saves for a unit price, for previews and the storefront. The server never lets a
 * group cost 0 or more than buying separately (a group that wouldn't be cheaper simply isn't discounted), so a
 * non-positive saving means "not a discount at this price".
 */
export function previewBundle(
  unitMinor: number,
  offer: Pick<Offer, "group_size" | "group_price_minor">,
): { normalMinor: number; groupMinor: number; savingMinor: number } | null {
  if (!offer.group_size || !offer.group_price_minor) return null;
  const normalMinor = unitMinor * offer.group_size;
  return { normalMinor, groupMinor: offer.group_price_minor, savingMinor: normalMinor - offer.group_price_minor };
}
