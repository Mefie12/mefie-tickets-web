/**
 * Types matching the backend's app/Http/Resources/Public/* Resource
 * classes — see PublicEventResource, PublicProductResource,
 * PublicQuestionResource, PublicOrganizationResource. Checkout mutations
 * (Milestone 6) live in checkoutApi.ts.
 *
 * Note the asymmetry between PublicEvent.organization (this full shape,
 * from PublicEventResource -> PublicOrganizationResource) and
 * PublicEventCard.organizer (a slimmer inline shape, still keyed
 * "organizer" — see PublicEventCardResource on the backend, which wasn't
 * renamed alongside the single-event resource). Both are read verbatim
 * from the backend's actual field names, not a naming choice made here.
 */
import type { EventPricing } from "@/lib/fees";
import { formatMoney } from "@/lib/money";

/** Platform-wide copy, not per-event data — matches the real passwordless/RecipientAccess ticket-delivery flow. Shown on every event page under the organizer's own description. */
export const TICKET_DELIVERY_NOTE =
  "Your purchase includes a QR-coded ticket delivered instantly by email. No account is required, and your ticket can be recovered anytime.";

export type QuestionType = "TEXT" | "PARAGRAPH" | "SINGLE_SELECT" | "MULTI_SELECT" | "RADIO" | "ADDRESS" | "AGREEMENT";
export type QuestionScope = "ORDER" | "ATTENDEE";

/** Product.type — a pricing model, not the TICKET/GENERAL product_type (not exposed publicly). */
export type PricingType = "FREE" | "PAID" | "DONATION" | "TIERED" | "REGISTRATION";

export type PublicLineupItem = {
  id: number;
  display_name: string;
  role: string;
  custom_role: string | null;
  tagline: string | null;
  biography: string | null;
  profile_image_url: string | null;
  social_links: { provider: string; url: string }[] | null;
  description: string | null;
  is_featured: boolean;
  sort_order: number;
  set_time_label: string | null;
};

export type PublicCustomSectionCard = {
  id: number;
  title: string;
  description: string | null;
  image_url: string | null;
  link_url: string | null;
  link_label: string | null;
  sort_order: number;
};

export type PublicContentSection = {
  id: number;
  type: "LINEUP" | "CUSTOM";
  title: string;
  intro: string | null;
  sort_order: number;
  lineup_items: PublicLineupItem[];
  custom_cards: PublicCustomSectionCard[];
};

export type PublicOrganization = {
  name: string;
  slug: string;
  description: string | null;
  email: string;
  logo_url: string | null;
  cover_image_url: string | null;
};

export type PublicTicketOption = {
  id: number;
  name: string;
  price: string;
  is_available: boolean;
  status: "AVAILABLE" | "SOLD_OUT" | "COMING_SOON" | "SALE_ENDED" | "PAUSED";
  quantity_remaining: number;
  max_attendees_per_registration: number | null;
};

export type PublicProduct = {
  id: number;
  title: string;
  type: PricingType;
  current_price: string | null;
  is_sold_out: boolean;
  // Kept separate from is_sold_out — is_on_sale false means "not yet
  // on sale" / "sale ended" / "paused by the organizer", a different
  // reason than "sold out" that deserves different copy.
  is_on_sale: boolean;
  starts_at: string | null;
  ends_at: string | null;
  quantity_remaining: number | null;
  // Only present for non-TIERED products — TIERED carries this per-tier
  // instead (see PublicProductTier), since the cap can differ by tier.
  max_attendees_per_registration?: number | null;
  options?: PublicTicketOption[];
};

/**
 * The lowest currently-purchasable price across an event's products
 * (tiered options counted individually), for the mobile sticky "Buy
 * tickets from $X" bar — not shown anywhere a full price breakdown
 * already exists (TicketSelector shows real per-tier prices).
 */
export function cheapestPriceLabel(event: { products: PublicProduct[]; currency_code: string }): string | null {
  const prices: number[] = [];
  for (const product of event.products) {
    if (product.type === "TIERED") {
      for (const option of product.options ?? []) {
        if (option.is_available) prices.push(Number(option.price));
      }
    } else if (!product.is_sold_out && product.is_on_sale) {
      // A FREE product's current_price is null, not "0" — still a real
      // purchasable option, so it counts as 0 here rather than being
      // skipped (which would wrongly hide a free ticket behind a paid
      // "from" price).
      prices.push(product.current_price !== null ? Number(product.current_price) : 0);
    }
  }
  if (prices.length === 0) return null;
  return formatMoney(Math.min(...prices), event.currency_code);
}

export type PublicQuestion = {
  id: number;
  title: string;
  description: string | null;
  scope: QuestionScope;
  type: QuestionType;
  options: string[] | null;
  is_required: boolean;
  sort_order: number;
};

export type LocationType = "IN_PERSON" | "ONLINE" | "HYBRID";

export type EventLocation = {
  location_type: LocationType;
  venue_name: string | null;
  address_line1: string | null;
  address_line2: string | null;
  city: string | null;
  state: string | null;
  postal_code: string | null;
  country: string | null;
  latitude: number | null;
  longitude: number | null;
  online_url: string | null;
  platform_name: string | null;
  access_instructions: string | null;
};

export type PublicEventTerms = {
  version_id: number;
  version_number: number;
  content_type: "RICH_TEXT" | "PDF";
  /** null for PDF — see the PDF stream route instead. */
  rich_text_content: string | null;
};

export type PublicEventCategoryItem = { id: number; name: string; slug: string };

export type PublicEventCategory = PublicEventCategoryItem & { subcategories: PublicEventCategoryItem[] };

/** GET /api/public/event-taxonomies */
export type PublicEventTaxonomies = { categories: PublicEventCategory[] };

/** Matches PublicEventCardResource — the slim shape for the landing-page grid, not the full PublicEvent. */
export type PublicEventCard = {
  id: number;
  title: string;
  slug: string;
  start_date: string | null;
  end_date: string | null;
  timezone: string;
  currency_code: string;
  cover_image_url: string | null;
  category: PublicEventCategoryItem | null;
  subcategory: PublicEventCategoryItem | null;
  location: { location_type: LocationType | null; city: string | null; country: string | null } | null;
  organizer: { name: string; slug: string; logo_url: string | null };
  /** Cheapest currently-purchasable price, server-computed (see PublicEventCardResource::startsFromPrice()). Null when nothing is currently purchasable. */
  starts_from_price: number | null;
  /** True when starts_from_price is 0 — drives the "Register" vs "Buy Ticket" card CTA. */
  is_free: boolean;
};

export type PaginationMeta = {
  current_page: number;
  last_page: number;
  per_page: number;
  total: number;
};

export type PublicEvent = {
  id: number;
  title: string;
  description: string;
  slug: string;
  /** UTC instants — render via src/lib/eventDateTime.ts in `timezone`. */
  start_date: string | null;
  end_date: string | null;
  /** IANA identifier the organizer scheduled in, e.g. "Europe/London". */
  timezone: string;
  /** ISO 4217 code, e.g. "GBP" — every price on this event/its products is in this currency. */
  currency_code: string;
  /** Fee/tax rates + bearers frozen onto this event at publish — used to show the all-in price before an order exists (see src/lib/fees.ts). */
  pricing: EventPricing;
  /** Null when the event has no category assigned. */
  category: PublicEventCategoryItem | null;
  subcategory: PublicEventCategoryItem | null;
  /** The real, currently-configured reservation hold (backend config/billing.php) — never hardcode this on the frontend, it can change. */
  reservation_hold_minutes: number;
  cover_image_url: string | null;
  /** 1200×630 crop for Open Graph / Twitter link previews. */
  cover_social_url: string | null;
  /** Tiny blurred image for a fast LQIP behind the hero. */
  cover_placeholder_url: string | null;
  gallery: { id: number; url: string; thumbnail_url: string; alt_text: string | null; sort_order: number | null }[];
  /** Server-computed so it can't disagree with the server render (hydration) or with the order endpoint's guard. */
  has_ended: boolean;
  location: EventLocation | null;
  organization: PublicOrganization;
  products: PublicProduct[];
  questions: PublicQuestion[];
  /** null when the organizer hasn't enabled a published version — no acceptance is required at checkout. */
  terms: PublicEventTerms | null;
  /** Hidden sections are already filtered out server-side — see PublicContentSectionResource. */
  content_sections: PublicContentSection[];
  /** Effective buy-now-assign-later gate (per-event flag AND the platform feature flag). When true, checkout may offer "assign later" and send an attendee-less order. */
  deferred_assignment_enabled: boolean;
  /** PURCHASER_GROUP | ATTENDEE_PERSONAL | ATTENDEE_SELF — how admission-terms acceptance is collected. null when the event has no acceptance step. */
  acceptance_policy: string | null;
};
