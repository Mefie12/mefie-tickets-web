/**
 * Organizer gate-pass management (docs/17 §13.1). Behind the Sanctum
 * organizer session + role:ADMIN. The secret is returned once — on
 * create and on rotate.
 */
import { ApiError } from "@/lib/authApi";

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
  if (!res.ok) throw new ApiError(data?.message ?? "Something went wrong.", res.status, data?.errors, data?.code);
  return data as T;
}

export type GatePass = {
  id: number;
  label: string;
  role: "SCANNER" | "SUPERVISOR";
  can_view_contact: boolean;
  expires_at: string | null;
  revoked_at: string | null;
  last_used_at: string | null;
  created_at: string | null;
};

export const listGatePasses = (eventId: number | string) =>
  request<{ gate_passes: GatePass[] }>(`/api/events/${eventId}/gate-passes`);

export const createGatePass = (
  eventId: number | string,
  body: { label: string; role: "SCANNER" | "SUPERVISOR"; can_view_contact?: boolean; expires_at?: string | null },
) => request<{ gate_pass: GatePass; secret: string }>(`/api/events/${eventId}/gate-passes`, { method: "POST", body });

export const rotateGatePassSecret = (gatePassId: number) =>
  request<{ secret: string }>(`/api/gate-passes/${gatePassId}/rotate-secret`, { method: "POST" });

export const revokeGatePass = (gatePassId: number) =>
  request<{ status: "revoked" }>(`/api/gate-passes/${gatePassId}`, { method: "DELETE" });
