/**
 * Client-side helpers for the consumer-portal Route Handlers under
 * /api/portal/**. Same-origin calls (cookie/CSRF handled server-side in
 * src/lib/backend.ts), same ApiError/request<T> shape as checkoutApi.ts.
 * Mirrors App\Domain\Consumer\Services\ConsumerDashboardService.
 */
import { ApiError } from "@/lib/authApi";
import type { AnswerInput } from "@/lib/checkoutApi";

async function request<T>(
  path: string,
  options: { method?: "GET" | "POST" | "DELETE"; body?: unknown } = {},
): Promise<T> {
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

export type EntitlementAssignmentStatus =
  | "BUYER_HELD"
  | "PENDING_ACCEPTANCE"
  | "ISSUED"
  | "CHECKED_IN"
  | "REFUNDED"
  | "VOIDED"
  | "SUSPENDED";

export type EntitlementCommercialStatus = "ACTIVE" | "REFUNDED" | "VOIDED" | "SUSPENDED";

export type PortalTicketLabel = { name: string | null; option: string | null };

export type OrderCard = {
  short_id: string;
  status: string;
  currency: string;
  total_amount: string;
  event: { title: string | null; slug: string | null; start_date: string | null; timezone: string | null };
  entitlement_summary: {
    total: number;
    buyer_held: number;
    pending_acceptance: number;
    issued: number;
    checked_in: number;
  };
  locator_active: boolean;
};

export type DashboardPayload = {
  profile: { email: string; first_name: string; last_name: string };
  orders: OrderCard[];
};

export type EntitlementRow = {
  public_id: string;
  sequence_number: number;
  ticket: PortalTicketLabel;
  assignment_status: EntitlementAssignmentStatus;
  commercial_status: EntitlementCommercialStatus;
  reacceptance_required: boolean;
  attendee: { first_name: string; last_name: string } | null;
  credential: { short_id: string; is_checked_in: boolean; credential_generation: number } | null;
  claim_link: {
    status: string;
    delivery_locked: boolean;
    expires_at: string | null;
    hide_inviter_name: boolean;
  } | null;
  delivery: { workflow_status: string | null; provider_status: string | null } | null;
};

export type OrderDetailPayload = {
  order: OrderCard & { admission_closes_at: string | null; acceptance_policy: string | null };
  entitlements: EntitlementRow[];
  refund_request: {
    id: number;
    status: "PENDING" | "APPROVED" | "DENIED" | "WITHDRAWN";
    reason: string | null;
    decision_note: string | null;
    requested_at: string | null;
    decided_at: string | null;
  } | null;
};

export type RegistrationSchema = {
  entitlement: { public_id: string; assignment_status: EntitlementAssignmentStatus };
  event: { acceptance_policy: string | null; admission_closes_at: string | null; past_admission_cutoff: boolean };
  requires_personal_acceptance: boolean;
  delivery_contact_relationships: string[];
  attendee_questions: Array<{
    id: number;
    title: string;
    description: string | null;
    type: string;
    options: string[] | null;
    is_required: boolean;
    is_sensitive: boolean;
  }>;
};

export type DeliveryRow = {
  entitlement_public_id: string | null;
  sequence_number: number | null;
  attendee: { first_name: string; last_name: string } | null;
  credential_short_id: string;
  delivery: {
    id: number;
    generation: number;
    recipient_masked: string;
    workflow_status: string | null;
    provider_status: string | null;
    failure_code: string | null;
    failure_message: string | null;
    updated_at: string | null;
  } | null;
  status_group: "pending" | "failed" | "ok" | "in_progress";
  correctable: boolean;
};

export type DeliveriesPayload = {
  order: { short_id: string };
  deliveries: DeliveryRow[];
  has_failures: boolean;
};

export type DeliveryRelationship = "SELF" | "BUYER" | "GUARDIAN" | "COORDINATOR";

/** One attendee registration — matches App\...\AssignEntitlementData. */
export type AttendeeRegistration = {
  first_name: string;
  last_name: string;
  email?: string | null;
  phone?: string | null;
  answers?: AnswerInput[];
  delivery_relationship?: DeliveryRelationship;
  delivery_name?: string | null;
  delivery_email?: string | null;
  delivery_phone?: string | null;
  guardian_attestation?: string | null;
};

// --- reads ---------------------------------------------------------------

export const getConsumerState = () =>
  request<{
    profile: { email: string; first_name: string; last_name: string };
    step_up_fresh: boolean;
    session_absolute_expires_at: string;
  }>("/api/portal/consumer/state");

export const getDashboard = () => request<DashboardPayload>("/api/portal/dashboard");
export const getOrder = (orderShortId: string) =>
  request<OrderDetailPayload>(`/api/portal/orders/${encodeURIComponent(orderShortId)}`);
export const getOrderDeliveries = (orderShortId: string) =>
  request<DeliveriesPayload>(`/api/portal/orders/${encodeURIComponent(orderShortId)}/deliveries`);
export const getRegistrationSchema = (entitlementPublicId: string) =>
  request<RegistrationSchema>(
    `/api/portal/entitlements/${encodeURIComponent(entitlementPublicId)}/registration-schema`,
  );

// --- assignment --------------------------------------------------------

export const assignSelf = (entitlementPublicId: string, requestKey: string) =>
  request<{ entitlement: EntitlementRow }>(
    `/api/portal/entitlements/${encodeURIComponent(entitlementPublicId)}/assign`,
    { method: "POST", body: { self: true, request_key: requestKey } },
  );

export const assignAttendee = (
  entitlementPublicId: string,
  attendee: AttendeeRegistration,
  requestKey: string,
) =>
  request<{ entitlement: EntitlementRow }>(
    `/api/portal/entitlements/${encodeURIComponent(entitlementPublicId)}/assign`,
    { method: "POST", body: { self: false, request_key: requestKey, ...attendee } },
  );

export type BulkAssignResult = {
  results: Array<
    | { entitlement_public_id: string; status: "assigned"; entitlement: EntitlementRow }
    | { entitlement_public_id: string; status: "rejected"; code: string; message: string }
    | { entitlement_public_id: string; status: "not_found" }
  >;
};

export const assignBulk = (body: {
  items: Array<{ entitlement_public_id: string } & Partial<AttendeeRegistration> & { self?: boolean }>;
  shared_answers?: AnswerInput[];
  request_key: string;
}) => request<BulkAssignResult>("/api/portal/entitlements/assign-bulk", { method: "POST", body });

// --- revoke / reassign (step-up) -------------------------------------

export const revokeEntitlement = (entitlementPublicId: string, body: { reason?: string }) =>
  request<{ entitlement: EntitlementRow }>(
    `/api/portal/entitlements/${encodeURIComponent(entitlementPublicId)}/revoke`,
    { method: "POST", body },
  );

export const reassignEntitlement = (
  entitlementPublicId: string,
  attendee: AttendeeRegistration,
  requestKey: string,
) =>
  request<{ entitlement: EntitlementRow }>(
    `/api/portal/entitlements/${encodeURIComponent(entitlementPublicId)}/reassign`,
    { method: "POST", body: { self: false, request_key: requestKey, ...attendee } },
  );

// --- reschedule / correction ---------------------------------------

export const confirmUpdatedTerms = (entitlementPublicId: string) =>
  request(`/api/portal/entitlements/${encodeURIComponent(entitlementPublicId)}/confirm-updated-terms`, {
    method: "POST",
  });

export const correctAttendee = (
  entitlementPublicId: string,
  body: Partial<Pick<AttendeeRegistration, "first_name" | "last_name" | "email" | "phone">> & {
    answers?: AnswerInput[];
  },
) => request(`/api/portal/entitlements/${encodeURIComponent(entitlementPublicId)}/attendee`, { method: "POST", body });

// --- claim links ------------------------------------------------------

export type ClaimLinkResult = {
  claim_link: {
    id: number;
    url: string;
    status: string;
    expires_at: string | null;
    delivery_locked: boolean;
    hide_inviter_name: boolean;
  };
};

export const createClaimLink = (
  entitlementPublicId: string,
  body: { expires_at?: string | null; hide_inviter_name?: boolean; delivery_lock_email?: string | null },
) =>
  request<ClaimLinkResult>(`/api/portal/entitlements/${encodeURIComponent(entitlementPublicId)}/claim-links`, {
    method: "POST",
    body,
  });

export const batchClaimLinks = (body: {
  entitlement_public_ids: string[];
  hide_inviter_name?: boolean;
  expires_at?: string | null;
}) =>
  request<{ claim_links: Array<ClaimLinkResult["claim_link"] & { entitlement_public_id: string }> }>(
    "/api/portal/entitlements/claim-links/batch",
    { method: "POST", body },
  );

export const rotateClaimLink = (claimLinkId: number) =>
  request<ClaimLinkResult>(`/api/portal/claim-links/${claimLinkId}/rotate`, { method: "POST" });

export const revokeClaimLink = (claimLinkId: number) =>
  request(`/api/portal/claim-links/${claimLinkId}`, { method: "DELETE" });

// --- deliveries -----------------------------------------------------

export const correctAndResendDelivery = (deliveryId: number, body: { email: string }) =>
  request(`/api/portal/deliveries/${deliveryId}/correct-and-resend`, { method: "POST", body });

// --- refund requests (step-up) ------------------------------------

export const openRefundRequest = (orderShortId: string, body: { reason?: string }) =>
  request(`/api/portal/orders/${encodeURIComponent(orderShortId)}/refund-requests`, { method: "POST", body });

export const withdrawRefundRequest = (orderShortId: string, refundRequestId: number) =>
  request(`/api/portal/orders/${encodeURIComponent(orderShortId)}/refund-requests/${refundRequestId}`, {
    method: "DELETE",
  });

// --- step-up + session --------------------------------------------

export const requestStepUp = () => request("/api/portal/consumer/step-up/request", { method: "POST" });
export const verifyStepUp = (code: string) =>
  request("/api/portal/consumer/step-up/verify", { method: "POST", body: { code } });

export const portalLogout = () => request("/api/portal/consumer/logout", { method: "POST" });
export const portalLogoutAll = () => request("/api/portal/consumer/logout-all", { method: "POST" });
