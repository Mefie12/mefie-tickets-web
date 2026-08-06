/**
 * Client-side helpers for the checkout Route Handlers under
 * /api/public/events/{id}/order[...]. Same-origin calls, same
 * ApiError/request<T> shape as authApi.ts/organizerApi.ts.
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
  quantity: number;
};

export type AttendeeInput = {
  product_id: number;
  first_name: string;
  last_name: string;
  email: string;
  answers?: AnswerInput[];
};

export type CreateOrderInput = {
  first_name: string;
  last_name: string;
  email: string;
  items: CartItemInput[];
  order_answers?: AnswerInput[];
  attendees?: AttendeeInput[];
};

export type OrderStatus = "RESERVED" | "COMPLETED" | "CANCELLED" | "AWAITING_OFFLINE_PAYMENT" | "ABANDONED";

export type OrderItemSummary = {
  product_title: string;
  tier_name: string | null;
  price: string;
  quantity: number;
  item_total: string;
};

export type OrderAttendeeSummary = {
  short_id: string;
  first_name: string;
  last_name: string;
  product_title: string;
};

export type Order = {
  short_id: string;
  status: OrderStatus;
  first_name: string;
  last_name: string;
  email: string;
  subtotal: string;
  tax_amount: string;
  platform_fee: string;
  total_amount: string;
  currency: string;
  items: OrderItemSummary[];
  attendees: OrderAttendeeSummary[];
};

async function request<T>(path: string, options: { method?: "GET" | "POST"; body?: unknown } = {}): Promise<T> {
  const res = await fetch(path, {
    method: options.method ?? "GET",
    headers: { "Content-Type": "application/json" },
    body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
  });

  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    throw new ApiError(data?.message ?? "Something went wrong.", res.status, data?.errors);
  }

  return data as T;
}

export function createOrder(eventId: number, input: CreateOrderInput) {
  return request<{ order: Order }>(`/api/public/events/${eventId}/order`, { method: "POST", body: input });
}

export function createPaymentIntent(eventId: number, shortId: string) {
  return request<{ client_secret: string }>(
    `/api/public/events/${eventId}/order/${encodeURIComponent(shortId)}/stripe/payment-intent`,
    { method: "POST" },
  );
}
