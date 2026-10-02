import { formatBasisPointsAsPercent, formatMinorAmount } from "@/lib/money";
import type { Offer, OfferPhase, OfferStatus, PublicOffer } from "@/lib/offersApi";

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
  const discount =
    offer.discount_type === "PERCENTAGE"
      ? Math.floor((unitMinor * offer.discount_value + 5000) / 10000)
      : offer.discount_value;
  return Math.max(0, unitMinor - Math.min(discount, unitMinor));
}
