import { ApiError } from "@/lib/authApi";

export type ScannerSetupStatus = "AVAILABLE" | "CONSUMED" | "REVOKED" | "EVENT_CLOSED";
export type ScannerCodeStatus = "NONE" | "ACTIVE" | "EXPIRED" | "LOCKED" | "CONSUMED";

export type ScannerSetupCodeState = {
  status: ScannerCodeStatus;
  expires_at: string | null;
  send_status: "PENDING" | "QUEUED" | "SEND_FAILED" | null;
  source: "INITIAL" | "ORGANIZER_RESEND" | "DEVICE_RESEND" | null;
};

export type ScannerSetup = {
  id: string;
  event_gate_id: number;
  gate_lane_id: number;
  role: "SCANNER" | "SUPERVISOR";
  device_label: string | null;
  recipient_email: string | null;
  setup_status: ScannerSetupStatus;
  created_at: string;
  expires_at: string;
  consumed_at: string | null;
  consumed_ip: string | null;
  revoked_at: string | null;
  code: ScannerSetupCodeState;
};

export type CreateScannerSetupResult = {
  scanner_setup: ScannerSetup;
  setup_url: string;
  setup_qr: string;
  recipient_email: string;
  code_expires_at: string;
  code_send_status: "QUEUED" | "SEND_FAILED";
};

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, { ...init, headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) } });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new ApiError(data?.message ?? "Scanner setup request failed.", response.status, data?.errors);
  return data as T;
}

export const listScannerSetups = (eventId: number) =>
  request<{ scanner_setups: ScannerSetup[] }>(`/api/events/${eventId}/scanner-setups`).then((r) => r.scanner_setups);

export const createScannerSetup = (eventId: number, body: {
  event_gate_id: number;
  gate_lane_id: number;
  role: "SCANNER" | "SUPERVISOR";
  recipient_email: string;
  recipient_name?: string;
  device_label?: string;
}) =>
  request<CreateScannerSetupResult>(`/api/events/${eventId}/scanner-setups`, { method: "POST", body: JSON.stringify(body) });

export const sendNewScannerSetupCode = (eventId: number, setupId: string) =>
  request<{ code_expires_at: string; code_send_status: "QUEUED" | "SEND_FAILED" }>(
    `/api/events/${eventId}/scanner-setups/${encodeURIComponent(setupId)}/resend-code`,
    { method: "POST" },
  );

export const revokeScannerSetup = (eventId: number, setupId: string) =>
  request<{ status: "REVOKED" }>(`/api/events/${eventId}/scanner-setups/${encodeURIComponent(setupId)}`, { method: "DELETE" });

/** Human label for the durable setup link's own lifecycle. */
export function scannerSetupLabel(status: ScannerSetupStatus): string {
  switch (status) {
    case "AVAILABLE": return "Ready";
    case "CONSUMED": return "Enrolled";
    case "REVOKED": return "Revoked";
    case "EVENT_CLOSED": return "Event closed";
  }
}
