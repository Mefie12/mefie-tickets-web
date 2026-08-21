import { ApiError } from "@/lib/authApi";

export type PaymentAccount = {
  id: number;
  provider: "STRIPE" | "PAYSTACK";
  legal_country: string;
  default_currency: string;
  environment: "TEST" | "LIVE";
  routing_status: "PROVISIONING" | "ACTIVE_ROUTING" | "DRAINING" | "HISTORICAL";
  account_status: "ONBOARDING" | "ACTIVE" | "ACTION_REQUIRED" | "RESTRICTED" | "DISCONNECTED" | "PROVISIONING_REVIEW_REQUIRED";
  onboarding_status: string;
  payments_enabled: boolean;
  /** Held-funds policy's real readiness signal — see ShowPaymentsAction. Distinct from payments_enabled, which Mefie's own platform account makes irrelevant to checkout. */
  transfers_enabled: boolean;
  settlements_enabled: boolean;
  requirements_status: string;
  last_synced_at: string | null;
  /** Only meaningfully populated when routing_status is HISTORICAL — see PaymentAccountService::provision()'s rejection handling. */
  provider_metadata: { rejection_reason?: string; rejected_at?: string } | null;
};

/** GET /api/organization/payments's pending_earnings block — null until a payment account exists. */
export type PendingEarnings = {
  held_minor: number;
  release_eligible_minor: number;
  transferred_minor: number;
  currency: string | null;
};

export type OrganizerTransfer = {
  id: number;
  amount_minor: number;
  currency: string;
  status: "PENDING" | "PROCESSING" | "SUCCEEDED" | "FAILED";
  requested_at: string;
  completed_at: string | null;
};

async function request<T>(path: string, options: { method?: "GET" | "POST"; body?: unknown } = {}): Promise<T> {
  const response = await fetch(path, {
    method: options.method ?? "GET",
    headers: { "Content-Type": "application/json" },
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new ApiError(data?.message ?? "Payment setup failed.", response.status, data?.errors, data?.code);
  return data as T;
}

export function provisionPaymentAccount(legalCountry: string, currency: string) {
  return request<{ payment_account: PaymentAccount }>("/api/organization/payments/onboarding", {
    method: "POST", body: { legal_country: legalCountry, currency },
  });
}

export async function createPaymentManagementSession(): Promise<string> {
  const result = await request<{ client_secret: string }>("/api/organization/payments/management-session", { method: "POST" });
  return result.client_secret;
}

export async function listOrganizerTransfers(): Promise<OrganizerTransfer[]> {
  const result = await request<{ organizer_transfers: OrganizerTransfer[] }>("/api/organization/payments/transfers");
  return result.organizer_transfers;
}
