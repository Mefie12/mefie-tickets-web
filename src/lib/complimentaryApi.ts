import { ApiError } from "@/lib/authApi";
import type { Product, TicketOption } from "@/lib/productApi";
import type { AnswerValue } from "@/lib/checkoutApi";

export type ComplimentaryStatus = "DISABLED" | "ACTIVE" | "CLOSED";
export type DeadlineMode = "EVENT_START" | "EVENT_END" | "CUSTOM";

export type ComplimentaryPoolLine = {
  id: number;
  product_id: number;
  product_price_tier_id: number | null;
  quantity_reserved: number;
  quantity_issued_direct: number;
  quantity_issued_distributed: number;
  quantity_allocated: number;
  quantity_available: number;
  product: Product;
  price_tier: TicketOption | null;
};

export type ComplimentaryProgram = {
  id: number;
  event_id: number;
  status: ComplimentaryStatus;
  deadline_mode: DeadlineMode;
  custom_deadline_at: string | null;
  issuance_deadline_at: string | null;
  maximum_tickets_per_recipient: number;
  notify_on_distributor_acceptance: boolean;
  notify_on_each_issuance: boolean;
  notify_when_nearly_exhausted: boolean;
  notify_on_bulk_failure: boolean;
  recipient_message: string | null;
  pool_lines: ComplimentaryPoolLine[];
};

type ProgramInput = Omit<ComplimentaryProgram, "id" | "event_id" | "pool_lines" | "issuance_deadline_at"> & {
  lines: Array<{ product_id: number; product_price_tier_id: number | null; quantity_reserved: number }>;
};

async function request<T>(path: string, options: { method?: "GET" | "POST" | "PUT"; body?: unknown } = {}): Promise<T> {
  const response = await fetch(path, {
    method: options.method ?? "GET",
    headers: { "Content-Type": "application/json" },
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new ApiError(data?.message ?? "Something went wrong.", response.status, data?.errors, data?.code);
  return data as T;
}

export function updateComplimentaryProgram(eventId: number, input: ProgramInput) {
  return request<{ program: ComplimentaryProgram }>(`/api/events/${eventId}/complimentary-program`, { method: "PUT", body: input });
}

export function issueComplimentaryTickets(eventId: number, input: {
  idempotency_key: string;
  email_tickets: boolean;
  attendees: Array<{
    product_id: number;
    product_price_tier_id: number | null;
    first_name: string;
    last_name: string;
    email: string;
    phone: string | null;
    answers: Array<{ question_id: number; answer: AnswerValue }>;
  }>;
}) {
  return request<{ order: { id: number; short_id: string } }>(`/api/events/${eventId}/complimentary-issues`, { method: "POST", body: input });
}

export type DirectComplimentaryIssue = {
  id: number;
  short_id: string;
  created_at: string;
  notify_attendees: boolean;
  ticket_assignments_count: number;
  issued_by: { id: number; first_name: string; last_name: string } | null;
  items: Array<{ id: number; ticket_display_name: string; quantity: number }>;
  ticket_deliveries: Array<{ id: number; workflow_status: string; provider_status: string }>;
  delivery_summary_status: "EMAIL_OFF" | "EMAIL_QUEUED" | "WAITING_FOR_WORKER" | "SENT" | "DELIVERED" | "NEEDS_ATTENTION";
};

export function listDirectComplimentaryIssues(eventId: number) {
  return request<{ orders: DirectComplimentaryIssue[] }>(`/api/events/${eventId}/complimentary-issues`).then((result) => result.orders);
}

export type AllocationStatus = "PENDING" | "ACTIVE" | "SUSPENDED" | "EXHAUSTED" | "RETURNED" | "EXPIRED" | "REVOKED" | "CLOSED";
export type ComplimentaryAllocation = {
  id: number; uuid: string; status: AllocationStatus; distribution_deadline_at: string; accepted_at: string | null;
  distributor: { id: number; name: string; email: string; phone: string | null; company: string | null; status: "INVITED" | "ACTIVE" | "SUSPENDED" };
  lines: Array<{ id: number; product_id: number; product_price_tier_id: number | null; quantity_allocated: number; quantity_issued: number; quantity_returned: number; quantity_available: number; product: { id: number; title: string }; price_tier: TicketOption | null }>;
  program?: { maximum_tickets_per_recipient: number; event: { id: number; title: string; start_date: string; organization: { name: string } } };
};

export function listComplimentaryAllocations(eventId: number) {
  return request<{ allocations: ComplimentaryAllocation[] }>(`/api/events/${eventId}/complimentary-allocations`).then((r) => r.allocations);
}
export function createComplimentaryAllocation(eventId: number, input: { name: string; email: string; phone: string | null; company: string | null; lines: Array<{ product_id: number; product_price_tier_id: number | null; quantity: number }> }) {
  return request<{ allocation: ComplimentaryAllocation }>(`/api/events/${eventId}/complimentary-allocations`, { method: "POST", body: input });
}
export function manageComplimentaryAllocation(eventId: number, allocationId: number, action: "resend" | "revoke" | "suspend" | "resume" | "close") {
  return request<{ allocation: ComplimentaryAllocation }>(`/api/events/${eventId}/complimentary-allocations/${allocationId}/${action}`, { method: "POST" });
}
