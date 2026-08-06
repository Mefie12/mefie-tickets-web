/**
 * Types matching the backend's app/Http/Resources/Public/* Resource
 * classes — see PublicEventResource, PublicProductResource,
 * PublicQuestionResource, PublicOrganizerResource. Checkout mutations
 * (Milestone 6) live in checkoutApi.ts.
 */

export type QuestionType = "TEXT" | "PARAGRAPH" | "SINGLE_SELECT" | "MULTI_SELECT" | "RADIO" | "ADDRESS" | "AGREEMENT";
export type QuestionScope = "ORDER" | "ATTENDEE";

/** Product.type — a pricing model, not the TICKET/GENERAL product_type (not exposed publicly). */
export type PricingType = "FREE" | "PAID" | "DONATION" | "TIERED" | "REGISTRATION";

export type PublicOrganizer = {
  name: string;
  slug: string;
  description: string | null;
  logo_url: string | null;
  cover_image_url: string | null;
};

export type PublicProductTier = {
  id: number;
  name: string;
  price: string;
  is_available: boolean;
};

export type PublicProduct = {
  id: number;
  title: string;
  type: PricingType;
  current_price: string | null;
  is_sold_out: boolean;
  quantity_remaining: number | null;
  tiers?: PublicProductTier[];
  active_tier_id?: number | null;
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

export type EventLocation = {
  venue_name: string | null;
  address_line1: string | null;
  city: string | null;
  state: string | null;
  postal_code: string | null;
  country: string | null;
  is_online: boolean;
  online_url: string | null;
};

export type PublicEvent = {
  id: number;
  title: string;
  slug: string;
  start_date: string;
  end_date: string;
  location: EventLocation;
  organizer: PublicOrganizer;
  products: PublicProduct[];
  questions: PublicQuestion[];
};
