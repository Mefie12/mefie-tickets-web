import { ApiError } from "@/lib/authApi";

export type GateOperationsDashboard = {
  operations_status: "OPEN" | "CLOSED";
  summary: {
    devices_online: number;
    devices_degraded: number;
    devices_not_ready: number;
    pending_operations: number;
    conflicts: number;
    canonical_admitted: number;
    oldest_last_sync_at: string | null;
  };
  devices: Array<{
    device_registration_id: string;
    label: string;
    gate_id: number;
    lane_id: number;
    status: "ACTIVE" | "PAUSED" | "RETIRED";
    checked_in: number;
    readiness: string | null;
    last_sync_at: string | null;
    snapshot_id: string | null;
    pending: number;
    conflicts: number;
    grant_expiry: string | null;
    app_version: string | null;
    offline_schema_version: number | null;
  }>;
  conflicts: Array<{ id: number; operation_id: number; canonical_admission_id: number | null; status: string; created_at: string }>;
};

export type GateAdmissionListItem = {
  id: number;
  attendee: { id: number; first_name: string; last_name: string; email: string };
  ticket: { id: number; reference: string; name: string };
  order: { id: number; reference: string };
  gate: { id: number | null; name: string | null };
  lane: { id: number | null; name: string | null };
  device: { id: string | null; label: string | null };
  admitted_at: string;
  status: "ADMITTED" | "REVERSED";
  reversal_reason: string | null;
  reversed_by_device_label: string | null;
};

export type GateAdmissionListResponse = {
  admissions: GateAdmissionListItem[];
  meta: { current_page: number; last_page: number; per_page: number; total: number };
};

async function request<T>(path: string, method: "GET" | "POST" | "PATCH" = "GET", body?: unknown): Promise<T> {
  const response = await fetch(path, {
    method,
    headers: { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new ApiError(data?.message ?? "Something went wrong.", response.status, data?.errors);
  return data as T;
}

export const getGateOperations = (eventId: number) => request<GateOperationsDashboard>(`/api/events/${eventId}/gate-operations`);
export const updateGateDevice = (eventId: number, deviceId: string, status: "ACTIVE" | "PAUSED" | "RETIRED") =>
  request<{ status: string }>(`/api/events/${eventId}/gate-operations/devices/${encodeURIComponent(deviceId)}`, "PATCH", { status });
export const reviewGateConflict = (eventId: number, conflictId: number) =>
  request<{ status: string }>(`/api/events/${eventId}/gate-operations/conflicts/${conflictId}/review`, "POST");
export const closeGateOperations = (eventId: number) =>
  request<{ status: string; closed_at: string }>(`/api/events/${eventId}/gate-operations/close`, "POST");
export const listGateAdmissions = (eventId: number, params: URLSearchParams) =>
  request<GateAdmissionListResponse>(`/api/events/${eventId}/gate-operations/admissions?${params}`);
export const exportGateAdmissionsUrl = (eventId: number, params: URLSearchParams) =>
  `/api/events/${eventId}/gate-operations/admissions/export?${params}`;
