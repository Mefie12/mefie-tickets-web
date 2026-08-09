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
export type QuestionType = "TEXT" | "PARAGRAPH" | "SINGLE_SELECT" | "MULTI_SELECT" | "RADIO" | "ADDRESS" | "AGREEMENT";
export type QuestionScope = "ORDER" | "ATTENDEE";

/** Product.type — a pricing model, not the TICKET/GENERAL product_type (not exposed publicly). */
export type PricingType = "FREE" | "PAID" | "DONATION" | "TIERED" | "REGISTRATION";

export type PublicOrganization = {
  name: string;
  slug: string;
  description: string | null;
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
  cover_image_url: string | null;
  gallery: { id: number; url: string; thumbnail_url: string; alt_text: string | null; sort_order: number | null }[];
  /** Server-computed so it can't disagree with the server render (hydration) or with the order endpoint's guard. */
  has_ended: boolean;
  location: EventLocation | null;
  organization: PublicOrganization;
  products: PublicProduct[];
  questions: PublicQuestion[];
};
