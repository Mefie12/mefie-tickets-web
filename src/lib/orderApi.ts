import { ApiError } from "@/lib/authApi";

export type OrderStatus = "RESERVED" | "COMPLETED" | "CANCELLED" | "AWAITING_OFFLINE_PAYMENT" | "ABANDONED";

/** The organizer-facing Orders list row — one per order, no attendee/item detail. */
export type OrderListItem = {
  id: number;
  event_id: number;
  short_id: string;
  first_name: string;
  last_name: string;
  email: string;
  phone: string | null;
  status: OrderStatus;
  subtotal: string;
  total_amount: string;
  currency: string;
  cancelled_at: string | null;
  cancellation_reason: string | null;
  ticket_delivery_batch_id: string | null;
  created_at: string;
  attendees_count: number;
};

export type OrderQuestionAnswer = {
  id: number;
  question_id: number;
  answer: string | string[] | boolean | Record<string, string>;
  question: { id: number; title: string; type: string };
};

export type OrderAttendee = {
  id: number;
  product_id: number;
  short_id: string;
  first_name: string;
  last_name: string;
  email: string;
  phone: string | null;
  is_buyer: boolean;
  is_checked_in: boolean;
  ticket_pdf_path: string | null;
  ticket_generated_at: string | null;
  voided_at: string | null;
  product: { id: number; title: string };
  answers: OrderQuestionAnswer[];
};

export type OrderItemDetail = {
  id: number;
  product_id: number;
  product_price_tier_id: number | null;
  ticket_group_name: string;
  ticket_option_name: string | null;
  ticket_display_name: string;
  currency_code: string;
  price: string;
  quantity: number;
  item_total: string;
  product: { id: number; title: string };
  priceTier: { id: number; name: string } | null;
};

export type OrderDetail = OrderListItem & {
  items: OrderItemDetail[];
  attendees: OrderAttendee[];
  answers: OrderQuestionAnswer[];
};

export type OrderListResponse = {
  orders: OrderListItem[];
  meta: { current_page: number; last_page: number; per_page: number; total: number };
};

async function request<T>(path: string, options: { method?: "GET" | "PATCH"; body?: unknown } = {}): Promise<T> {
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

export function listOrders(eventId: number, page = 1) {
  return request<OrderListResponse>(`/api/events/${eventId}/orders?page=${page}`);
}

export function getOrder(eventId: number, orderId: number) {
  return request<{ order: OrderDetail }>(`/api/events/${eventId}/orders/${orderId}`);
}

export function cancelOrder(eventId: number, orderId: number, reason?: string) {
  return request<{ order: OrderDetail }>(`/api/events/${eventId}/orders/${orderId}/cancel`, {
    method: "PATCH",
    body: { reason },
  });
}
