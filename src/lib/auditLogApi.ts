import { ApiError } from "@/lib/authApi";
import type { PageMeta } from "@/lib/platformOrganizationApi";

/**
 * Client-side helper for the Mefie Admin Console's audit log — a global
 * feed by default, or scoped to a single organization/user's history
 * (an organization/user detail page's Activity tab).
 */

export type AuditLogEntry = {
  id: number;
  log_name: "platform_admin" | "platform_security";
  description: string;
  subject_type: string | null;
  subject_id: string | null;
  causer_type: string | null;
  causer_id: string | null;
  properties: {
    actor_platform_role: string | null;
    reason: string | null;
    before: Record<string, unknown> | null;
    after: Record<string, unknown> | null;
    metadata: Record<string, unknown>;
  };
  causer: { id: number; first_name: string; last_name: string } | null;
  created_at: string;
};

async function request<T>(path: string): Promise<T> {
  const res = await fetch(path, { headers: { "Content-Type": "application/json" } });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new ApiError(data?.message ?? "Something went wrong.", res.status, data?.errors, data?.code);
  }
  return data as T;
}

export function listAuditLog(
  params: { log_name?: "platform_admin" | "platform_security"; organization_id?: string; user_id?: number; page?: number } = {},
) {
  const query = new URLSearchParams();
  if (params.log_name) query.set("log_name", params.log_name);
  if (params.organization_id) query.set("organization_id", params.organization_id);
  if (params.user_id) query.set("user_id", String(params.user_id));
  if (params.page) query.set("page", String(params.page));
  const qs = query.toString();
  return request<{ entries: AuditLogEntry[]; meta: PageMeta }>(`/api/admin/audit-log${qs ? `?${qs}` : ""}`);
}
