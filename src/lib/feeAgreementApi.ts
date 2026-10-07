import { ApiError } from "@/lib/authApi";

/**
 * Client-side helpers for an organization's negotiated platform fee
 * (docs/24) — /api/admin/organizations/{id}/fee-agreements on the Laravel
 * side, proxied through this app's own Route Handlers.
 */

export type FeeAgreement = {
  id: number;
  organization_id: string;
  platform_fee_basis_points: number;
  starts_at: string;
  ends_at: string | null;
  ended_at: string | null;
  end_reason: "SUPERSEDED" | "REVOKED" | "EXPIRED" | null;
  reference: string;
  created_at: string;
  creator: { id: number; first_name: string; last_name: string } | null;
  ended_by_user: { id: number; first_name: string; last_name: string } | null;
};

export type FeeAgreementList = {
  fee_agreements: FeeAgreement[];
  standard_platform_fee_basis_points: number;
  max_platform_fee_basis_points: number;
  /** Events that already froze a rate and so will not follow a new agreement. */
  events_with_frozen_rate: number;
};

/** event title -> ticket names that would fall below the fee floor under the proposed rate */
export type FeeAgreementImpact = Record<string, string[]>;

export class FeeAgreementImpactError extends ApiError {
  impact: FeeAgreementImpact;

  constructor(message: string, status: number, impact: FeeAgreementImpact) {
    super(message, status, undefined, "FEE_AGREEMENT_IMPACT_UNACKNOWLEDGED");
    this.impact = impact;
  }
}

async function request<T>(path: string, options: { method?: "GET" | "POST" | "PATCH"; body?: unknown } = {}): Promise<T> {
  const res = await fetch(path, {
    method: options.method ?? "GET",
    headers: { "Content-Type": "application/json" },
    body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
  });
  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    if (data?.code === "FEE_AGREEMENT_IMPACT_UNACKNOWLEDGED") {
      throw new FeeAgreementImpactError(data.message, res.status, data.impact ?? {});
    }
    throw new ApiError(data?.message ?? "Something went wrong.", res.status, data?.errors, data?.code);
  }

  return data as T;
}

export function listFeeAgreements(organizationId: string) {
  return request<FeeAgreementList>(`/api/admin/organizations/${organizationId}/fee-agreements`);
}

export function createFeeAgreement(
  organizationId: string,
  input: { platform_fee_basis_points: number; reference: string; ends_at: string | null; acknowledge_impact?: boolean },
) {
  return request<{ fee_agreement: FeeAgreement }>(`/api/admin/organizations/${organizationId}/fee-agreements`, {
    method: "POST",
    body: input,
  });
}

export function revokeFeeAgreement(organizationId: string, agreementId: number, reason: string, acknowledgeImpact = false) {
  return request<{ fee_agreement: FeeAgreement }>(
    `/api/admin/organizations/${organizationId}/fee-agreements/${agreementId}/revoke`,
    { method: "PATCH", body: { reason, acknowledge_impact: acknowledgeImpact } },
  );
}

/**
 * "2.35" -> 235. Whole basis points only (0.01% steps); anything finer,
 * negative or non-numeric is null so the form can refuse it instead of
 * silently rounding a negotiated rate.
 */
export function percentToBasisPoints(input: string | number): number | null {
  const text = String(input).trim();
  if (!/^\d{1,3}(\.\d{1,2})?$/.test(text)) return null;
  return Math.round(Number(text) * 100);
}

/** The agreement's end date input (YYYY-MM-DD) as the end of that day in the browser's zone, ISO-8601. */
export function endOfDayIso(dateInput: string): string | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateInput)) return null;
  const date = new Date(`${dateInput}T23:59:59`);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

export type FeeAgreementState = "ACTIVE" | "SCHEDULED_END" | "EXPIRED" | "SUPERSEDED" | "REVOKED";

/** What the history table calls a row, judged at `now`. */
export function feeAgreementState(agreement: FeeAgreement, now: Date = new Date()): FeeAgreementState {
  if (agreement.end_reason === "SUPERSEDED" || agreement.end_reason === "REVOKED") return agreement.end_reason;
  const endsAt = agreement.ends_at ? new Date(agreement.ends_at) : null;
  if (agreement.end_reason === "EXPIRED" || (endsAt && endsAt <= now)) return "EXPIRED";
  return endsAt ? "SCHEDULED_END" : "ACTIVE";
}
