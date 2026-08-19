/**
 * Client-side helpers for the checkout Route Handlers under
 * /api/public/events/{id}/order[...]. Same-origin calls, same
 * ApiError/request<T> shape as authApi.ts/organizationApi.ts.
 */

import { ApiError } from "@/lib/authApi";

export type AddressAnswer = {
  address_line1: string;
  city: string;
  state: string;
  postal_code: string;
  country: string;
};

export type AnswerValue = string | string[] | boolean | AddressAnswer;

export type AnswerInput = {
  question_id: number;
  answer: AnswerValue;
};

export type CartItemInput = {
  product_id: number;
  ticket_option_id?: number | null;
  quantity: number;
};

export type AttendeeInput = {
  product_id: number;
  ticket_option_id?: number | null;
  first_name: string;
  last_name: string;
  // Optional — a non-buyer attendee (e.g. a child) may have neither.
  // See DeliverAttendeeTicketEmailJob's null-email guard on the backend.
  email?: string | null;
  phone?: string | null;
  is_buyer?: boolean;
  answers?: AnswerInput[];
};

export type CreateOrderInput = {
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  items: CartItemInput[];
  order_answers?: AnswerInput[];
  attendees?: AttendeeInput[];
  // Buyer-controlled: whether non-buyer attendees get individually
  // emailed their assigned ticket. Never gates the buyer's own ticket.
  notify_attendees?: boolean;
  // Only required when event.terms is present and the cart triggers it
  // (see OrderService::resolveRequiredTermsVersionId on the backend).
  // terms_version_id must be the version_id the buyer was actually shown
  // — a stale value is rejected with code TERMS_VERSION_CHANGED.
  terms_accepted?: boolean;
  terms_version_id?: number;
  checkout_idempotency_key?: string;
};

export type OrderTermsAcceptance = {
  accepted: true;
  version_number: number;
  accepted_at: string;
  content_type: "RICH_TEXT" | "PDF";
  /** null for PDF — the confirmation screen links to the public PDF route instead. */
  rich_text_content: string | null;
};

export type OrderStatus = "RESERVED" | "COMPLETED" | "CANCELLED" | "AWAITING_OFFLINE_PAYMENT" | "ABANDONED";

export type OrderItemSummary = {
  ticket_group_name: string;
  ticket_option_name: string | null;
  ticket_display_name: string;
  price: string;
  quantity: number;
  item_total: string;
  currency_code: string;
};

export type OrderAttendeeSummary = {
  short_id: string;
  first_name: string;
  last_name: string;
  ticket_display_name: string;
};

export type Order = {
  short_id: string;
  status: OrderStatus;
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  subtotal: string;
  tax_amount: string;
  platform_fee: string;
  total_amount: string;
  currency: string;
  items: OrderItemSummary[];
  attendees: OrderAttendeeSummary[];
  terms_acceptance: OrderTermsAcceptance | null;
};

async function request<T>(path: string, options: { method?: "GET" | "POST"; body?: unknown } = {}): Promise<T> {
  const res = await fetch(path, {
    method: options.method ?? "GET",
    headers: { "Content-Type": "application/json" },
    body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
  });

  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    throw new ApiError(data?.message ?? "Something went wrong.", res.status, data?.errors, data?.code);
  }

  return data as T;
}

export function createOrder(eventId: number, input: CreateOrderInput) {
  return request<{ order: Order }>(`/api/public/events/${eventId}/order`, { method: "POST", body: input });
}

export function createPaymentIntent(eventId: number, shortId: string) {
  return request<{ client_secret: string; provider: "STRIPE"; provider_account_id: string }>(
    `/api/public/events/${eventId}/order/${encodeURIComponent(shortId)}/payment`,
    { method: "POST" },
  );
}

export function getOrderPaymentStatus(eventId: number, shortId: string) {
  return request<{ status: OrderStatus; completed_at: string | null }>(
    `/api/public/events/${eventId}/order/${encodeURIComponent(shortId)}/payment-status`,
  );
}
