import { ApiError } from "@/lib/authApi";

export type OrderStatus = "RESERVED" | "COMPLETED" | "CANCELLED" | "AWAITING_OFFLINE_PAYMENT" | "ABANDONED";

/** Shared status chip colour + label, used by the orders table and the order-detail page. */
export const ORDER_STATUS: Record<OrderStatus, { c: string; label: string }> = {
  COMPLETED: { c: "teal", label: "Completed" },
  RESERVED: { c: "yellow.7", label: "Reserved" },
  AWAITING_OFFLINE_PAYMENT: { c: "orange", label: "Awaiting payment" },
  CANCELLED: { c: "red", label: "Cancelled" },
  ABANDONED: { c: "gray.6", label: "Abandoned" },
};

/**
 * The order-detail page renders a different layout per lifecycle state.
 * `refunded` and `cancelled` are both `status === "CANCELLED"` underneath —
 * a full refund flips a completed order to CANCELLED
 * (PaymentProjectionService::recordRefund), so a terminal order that was
 * `COMPLETED` with real money on it is a refund; anything else is a plain
 * pre-payment cancellation. Real payout/refund figures get wired when the
 * refund feature is finished.
 */
export type OrderView = "reserved" | "awaiting" | "completed" | "refunded" | "cancelled" | "abandoned";

export function orderView(
  o: Pick<OrderListItem, "status" | "terminated_from_status" | "total_amount" | "complimentary_program_id">,
): OrderView {
  switch (o.status) {
    case "RESERVED":
      return "reserved";
    case "AWAITING_OFFLINE_PAYMENT":
      return "awaiting";
    case "COMPLETED":
      return "completed";
    case "ABANDONED":
      return "abandoned";
    default:
      return o.terminated_from_status === "COMPLETED" && Number(o.total_amount) > 0 && !o.complimentary_program_id
        ? "refunded"
        : "cancelled";
  }
}

export const ORDER_VIEW_META: Record<OrderView, { c: string; label: string }> = {
  reserved: { c: "yellow.7", label: "Reserved" },
  awaiting: { c: "orange", label: "Awaiting payment" },
  completed: { c: "teal", label: "Completed" },
  refunded: { c: "teal", label: "Refunded" },
  cancelled: { c: "red", label: "Cancelled" },
  abandoned: { c: "gray.6", label: "Abandoned" },
};

/** The organizer-facing Orders list row — one per order. */
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
  /** Set when the order came from a complimentary program — such orders are cancellable even when completed. */
  complimentary_program_id: number | null;
  /** When payment completed (only set for orders that actually went through checkout). */
  completed_at: string | null;
  /** The status the order held immediately before it went terminal — `COMPLETED` here means it was refunded, not plain-cancelled. */
  terminated_from_status: OrderStatus | null;
  created_at: string;
  /** Tickets this order created (entitlements). */
  tickets_count: number;
  /** Tickets currently assigned to an attendee (revoked/voided rows excluded). */
  attendees_count: number;
  /** Of the assigned tickets, how many have checked in. */
  checked_in_count: number;
  items_summary: { name: string; quantity: number }[];
};

export type OrderQuestionAnswer = {
  id: number;
  question_id: number;
  answer: string | string[] | boolean | Record<string, string>;
  question: { id: number; title: string; type: string };
};

/** Lifecycle status of a single purchased admission unit (entitlement). */
export type OrderTicketStatus =
  | "UNASSIGNED"
  | "CLAIM_LINK_SENT"
  | "AWAITING_ACCEPTANCE"
  | "ISSUED"
  | "CHECKED_IN"
  | "VOIDED"
  | "REFUNDED"
  | "SUSPENDED";

/** How the buyer/attendee copy of this ticket last got emailed. */
export type OrderTicketDeliveryStatus = "DELIVERED" | "SENT" | "QUEUED" | "FAILED" | "NOT_EMAILED";

export type OrderTicketHistoryEntry = {
  event: "ASSIGNED" | "REVOKED" | "REASSIGNED" | "CLAIMED" | "CORRECTED" | "INVALIDATED";
  at: string | null;
  reason: string | null;
  /** "automatic" | "buyer" | "organizer" | "organizer (Name)". */
  actor_label: string;
  from_name: string | null;
  to_name: string | null;
};

/** The current attendee holding a ticket — `id` is the ticket assignment id (drives /attendees/{id}/ticket + resend). */
export type OrderTicketAssignment = {
  id: number;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  phone: string | null;
  is_buyer: boolean;
  is_checked_in: boolean;
  ticket_pdf_path: string | null;
  answers: OrderQuestionAnswer[];
};

/** One purchased admission unit on the order-detail page. */
export type OrderTicket = {
  entitlement_id: number;
  sequence_number: number;
  ticket_name: string | null;
  status: OrderTicketStatus;
  delivery_status: OrderTicketDeliveryStatus;
  assignment: OrderTicketAssignment | null;
  history: OrderTicketHistoryEntry[];
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

export type OrderTermsAcceptance = {
  accepted: true;
  version_id: number;
  version_number: number;
  accepted_at: string;
  content_type: "RICH_TEXT" | "PDF";
  /** null for PDF — see the version's own PDF stream route instead. */
  rich_text_content: string | null;
};

export type OrderDetail = OrderListItem & {
  tax_amount: string;
  platform_fee: string;
  processing_fee: string;
  organizer_payout_amount: string;
  /** Who each fee was charged to on this order. */
  tax_bearer: "ATTENDEE" | "ORGANIZER" | null;
  platform_fee_bearer: "ATTENDEE" | "ORGANIZER" | null;
  processing_fee_bearer: "ATTENDEE" | "ORGANIZER" | null;
  items: OrderItemDetail[];
  /** One row per purchased admission unit, ordered by sequence_number. Empty before payment completes. */
  tickets: OrderTicket[];
  answers: OrderQuestionAnswer[];
  // Always the version the buyer actually accepted, never the event's
  // current one — see ShowEventOrderAction on the backend.
  terms_acceptance: OrderTermsAcceptance | null;
};

export type OrderListResponse = {
  orders: OrderListItem[];
  meta: { current_page: number; last_page: number; per_page: number; total: number };
};

async function request<T>(path: string, options: { method?: "GET" | "PATCH" | "POST"; body?: unknown } = {}): Promise<T> {
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

export function listOrders(eventId: number, params: URLSearchParams) {
  return request<OrderListResponse>(`/api/events/${eventId}/orders?${params}`);
}

/** Triggers a CSV download in the browser. `params` carries the same filters as the list, plus optional `ids[]`. */
export function exportOrdersUrl(eventId: number, params: URLSearchParams) {
  return `/api/events/${eventId}/orders/export?${params}`;
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

/**
 * Organizer-initiated refund of a paid, completed order. The response is
 * `{ refunded: true }`; the DB side is driven by the Stripe webhook, so
 * callers should re-fetch the order rather than merge this.
 */
export function refundOrder(eventId: number, orderId: number, reason: string) {
  return request<{ data: { refunded: true } }>(`/api/events/${eventId}/orders/${orderId}/refund`, {
    method: "PATCH",
    body: { reason },
  });
}

export type ResendOrderEmailInput = {
  type: "receipt" | "assignment_invite";
  /** Send to this address instead of order.email; blank = use order.email. */
  email?: string;
  /** Also persist `email` as the order's address for future deliveries. */
  update_order_email?: boolean;
  reason: string;
};

export function resendOrderEmail(eventId: number, orderId: number, input: ResendOrderEmailInput) {
  return request<{ data: { queued: true; email_updated: boolean } }>(
    `/api/events/${eventId}/orders/${orderId}/resend-email`,
    { method: "POST", body: input }
  );
}

export function resendOrderTicket(eventId: number, ticketId: number, reason: string) {
  return request<{ data: { delivery_id: number; generation: number } }>(
    `/api/events/${eventId}/tickets/${ticketId}/resend`,
    {
      method: "POST",
      body: { confirmed: true, reason },
    }
  );
}
