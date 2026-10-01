/**
 * Client helpers for promotions ("offers"): the public quote/share
 * endpoints used by checkout, the organizer's per-event management API,
 * and the platform-admin oversight API. All calls are same-origin Route
 * Handlers (app/api/**), same ApiError/request<T> shape as the other
 * *Api.ts modules.
 */
import { ApiError } from "@/lib/authApi";

export type OfferStatus = "DRAFT" | "ACTIVE" | "PAUSED" | "ENDED";
export type OfferActivation = "CODE" | "AUTOMATIC";
export type OfferDiscountType = "PERCENTAGE" | "FIXED_PER_TICKET";

export type OfferScopeRow = { product_id: number; ticket_option_id: number | null };

/** The management view (organizer + admin). Never used on public pages. */
export type Offer = {
  id: number;
  event_id: number;
  name: string;
  internal_description: string | null;
  status: OfferStatus;
  activation: OfferActivation;
  is_currently_eligible: boolean;
  starts_at: string;
  ends_at: string;
  currency_code: string;
  discount_type: OfferDiscountType;
  /** Basis points for PERCENTAGE (10000 = 100%); minor units per ticket for FIXED_PER_TICKET. */
  discount_value: number;
  global_ticket_limit: number | null;
  per_customer_ticket_limit: number | null;
  per_order_ticket_limit: number | null;
  consumed_ticket_units: number;
  code?: string | null;
  share_token: string | null;
  /** True once activated: economics, tickets, dates, limits and code are immutable. */
  is_locked: boolean;
  scope?: OfferScopeRow[];
  event?: { id: number; title: string; organization_id: string };
  created_at: string;
  activated_at: string | null;
  ended_at: string | null;
};

export type OfferReport = {
  status: OfferStatus;
  currency_code: string;
  redemptions: number;
  discounted_tickets: number;
  in_checkout_tickets: number;
  gross_eligible_minor: number;
  discount_granted_minor: number;
  discounted_net_minor: number;
  refunded_redemptions: number;
  refund_released_units: number;
  expired_or_released_units: number;
  redemption_conversion: number | null;
  consumed_ticket_units: number;
  global_ticket_limit: number | null;
  by_ticket: Array<{
    product_id: number;
    ticket_option_id: number | null;
    name: string;
    discounted_units: number;
    gross_eligible_minor: number;
    discount_granted_minor: number;
    discounted_net_minor: number;
  }>;
};

/** What a buyer is allowed to see of an offer — never limits, codes or tokens. */
export type PublicOffer = {
  name: string;
  activation: OfferActivation;
  discount_type: OfferDiscountType;
  discount_value: number;
  currency_code: string;
  starts_at: string;
  ends_at: string;
  requires_verification: boolean;
  scope: OfferScopeRow[];
};

export type QuoteStatus = "NONE" | "APPLIED" | "VERIFICATION_REQUIRED" | "REJECTED";

export type QuoteLine = {
  product_id: number;
  ticket_option_id: number | null;
  quantity: number;
  unit_price_minor: number;
  discounted_units: number;
  discount_minor: number;
  final_total_minor: number;
};

export type Quote = {
  status: QuoteStatus;
  /** Machine code for REJECTED / VERIFICATION_REQUIRED — map to copy with offerErrorMessage(). */
  code: string | null;
  message: string | null;
  needs_verification: boolean;
  currency: string;
  lines: QuoteLine[];
  gross_subtotal_minor: number;
  discount_total_minor: number;
  subtotal_minor: number;
  tax_minor: number;
  platform_fee_minor: number;
  processing_fee_minor: number;
  total_minor: number;
  tax_bearer: "ATTENDEE" | "ORGANIZER";
  platform_fee_bearer: "ATTENDEE" | "ORGANIZER";
  processing_fee_bearer: "ATTENDEE" | "ORGANIZER";
  offer: {
    name: string;
    source: "code" | "token" | "automatic";
    activation: OfferActivation;
    discount_type: OfferDiscountType;
    discount_value: number;
    discounted_units: number;
    partially_applied: boolean;
  } | null;
};

export type QuoteRequest = {
  items: Array<{ product_id: number; ticket_option_id?: number | null; quantity: number }>;
  promo_code?: string | null;
  offer_token?: string | null;
};

export type OfferInput = {
  name: string;
  internal_description?: string | null;
  activation: OfferActivation;
  starts_at: string;
  ends_at: string;
  discount_type: OfferDiscountType;
  discount_value: number;
  global_ticket_limit?: number | null;
  per_customer_ticket_limit?: number | null;
  per_order_ticket_limit?: number | null;
  code?: string | null;
  scope: OfferScopeRow[];
};

type Method = "GET" | "POST" | "PATCH" | "DELETE";

async function request<T>(path: string, options: { method?: Method; body?: unknown } = {}): Promise<T> {
  const res = await fetch(path, {
    method: options.method ?? "GET",
    headers: { "Content-Type": "application/json" },
    body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(data?.message ?? "Something went wrong.", res.status, data?.errors, data?.code);
  return data as T;
}

// ---- public (checkout) ----------------------------------------------

export function quoteOffers(eventId: number, input: QuoteRequest) {
  return request<{ quote: Quote }>(`/api/public/events/${eventId}/offers/quote`, { method: "POST", body: input });
}

export function getShareOffer(eventId: number, token: string) {
  return request<{ offer: PublicOffer }>(`/api/public/events/${eventId}/offers/share/${encodeURIComponent(token)}`);
}

// ---- organizer -------------------------------------------------------

export function listOffers(eventId: number) {
  return request<{ offers: Offer[] }>(`/api/events/${eventId}/offers`);
}

export function getOffer(eventId: number, offerId: number) {
  return request<{ offer: Offer; report: OfferReport }>(`/api/events/${eventId}/offers/${offerId}`);
}

export function createOffer(eventId: number, input: OfferInput) {
  return request<{ offer: Offer }>(`/api/events/${eventId}/offers`, { method: "POST", body: input });
}

export function updateOffer(eventId: number, offerId: number, input: Partial<OfferInput>) {
  return request<{ offer: Offer }>(`/api/events/${eventId}/offers/${offerId}`, { method: "PATCH", body: input });
}

export function deleteOffer(eventId: number, offerId: number) {
  return request<{ deleted: boolean }>(`/api/events/${eventId}/offers/${offerId}`, { method: "DELETE" });
}

export type OfferAction = "activate" | "pause" | "resume" | "end";

export function offerAction(eventId: number, offerId: number, action: OfferAction, reason?: string) {
  return request<{ offer: Offer }>(`/api/events/${eventId}/offers/${offerId}/${action}`, {
    method: "POST",
    body: reason ? { reason } : {},
  });
}

// ---- platform admin ---------------------------------------------------

export type AdminOfferFilters = { status?: OfferStatus; event_id?: number; organization_id?: string; per_page?: number };

export function adminListOffers(filters: AdminOfferFilters = {}) {
  const query = new URLSearchParams();
  Object.entries(filters).forEach(([key, value]) => {
    if (value !== undefined && value !== "") query.set(key, String(value));
  });
  const suffix = query.toString() ? `?${query}` : "";
  return request<{ offers: Offer[]; meta: { current_page: number; last_page: number; total: number } }>(`/api/admin/offers${suffix}`);
}

export function adminGetOffer(offerId: number) {
  return request<{ offer: Offer; report: OfferReport }>(`/api/admin/offers/${offerId}`);
}

export function adminOfferAction(offerId: number, action: "pause" | "end", reason: string) {
  return request<{ offer: Offer }>(`/api/admin/offers/${offerId}/${action}`, { method: "POST", body: { reason } });
}
