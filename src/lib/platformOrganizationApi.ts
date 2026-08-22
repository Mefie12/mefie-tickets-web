import { ApiError } from "@/lib/authApi";

/**
 * Client-side helpers for the Organizations tab of the Mefie Admin
 * Console — GET /api/admin/organizations and friends on the Laravel
 * side, proxied through this app's own /api/admin/organizations Route
 * Handlers.
 */

export type OrganizationStatus = "PENDING_VERIFICATION" | "ACTIVE" | "SUSPENDED" | "ARCHIVED";

export type AdminOrganization = {
  id: string;
  slug: string;
  name: string;
  display_name: string | null;
  email: string;
  timezone: string;
  currency: string;
  status: OrganizationStatus;
  payout_restricted_at: string | null;
  payout_restricted_reason: string | null;
  suspended_at: string | null;
  suspended_reason: string | null;
  created_at: string;
  deleted_at: string | null;
};

export type PageMeta = { current_page: number; last_page: number; total: number };

async function request<T>(
  path: string,
  options: { method?: "GET" | "POST" | "PATCH" | "DELETE"; body?: unknown } = {},
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

export function listOrganizations(params: { q?: string; status?: string; page?: number } = {}) {
  const query = new URLSearchParams();
  if (params.q) query.set("q", params.q);
  if (params.status) query.set("status", params.status);
  if (params.page) query.set("page", String(params.page));
  const qs = query.toString();
  return request<{ organizations: AdminOrganization[]; meta: PageMeta }>(
    `/api/admin/organizations${qs ? `?${qs}` : ""}`,
  );
}

export function fetchOrganization(id: string) {
  return request<{ organization: AdminOrganization }>(`/api/admin/organizations/${id}`);
}

export function suspendOrganization(id: string, reason: string) {
  return request<{ organization: AdminOrganization }>(`/api/admin/organizations/${id}/suspend`, {
    method: "PATCH",
    body: { reason },
  });
}

export function restoreOrganization(id: string, reason: string) {
  return request<{ organization: AdminOrganization }>(`/api/admin/organizations/${id}/restore`, {
    method: "PATCH",
    body: { reason },
  });
}

export function setPayoutRestriction(id: string, reason: string) {
  return request<{ organization: AdminOrganization }>(`/api/admin/organizations/${id}/payout-restriction`, {
    method: "PATCH",
    body: { reason },
  });
}

export function clearPayoutRestriction(id: string, reason: string) {
  return request<{ organization: AdminOrganization }>(`/api/admin/organizations/${id}/payout-restriction`, {
    method: "DELETE",
    body: { reason },
  });
}

export type OrganizationNote = {
  id: number;
  organization_id: string;
  author_id: number;
  body: string;
  created_at: string;
  author: { id: number; first_name: string; last_name: string } | null;
};

export function listOrganizationNotes(organizationId: string) {
  return request<{ notes: OrganizationNote[] }>(`/api/admin/organizations/${organizationId}/notes`);
}

export function createOrganizationNote(organizationId: string, body: string) {
  return request<{ note: OrganizationNote }>(`/api/admin/organizations/${organizationId}/notes`, {
    method: "POST",
    body: { body },
  });
}

export type MoneySummary = { currency: string; orders: number; gross_sales: string; platform_fees: string; organizer_entitlement: string; refunded: string; released: string; outstanding: string };
export type WorkspacePage<T> = { meta: PageMeta & { per_page: number } } & T;

export function fetchOrganizationWorkspace<T>(id: string, path: string, params: Record<string, string | number | undefined> = {}) {
  const query = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => { if (value !== undefined && value !== '') query.set(key, String(value)); });
  return request<T>(`/api/admin/organizations/${id}/workspace/${path}${query.size ? `?${query}` : ''}`);
}

export function revealOrganizationOrder(id: string, orderId: number, reason: string) {
  return request<{ order: Record<string, unknown> }>(`/api/admin/organizations/${id}/workspace/orders/${orderId}/reveal`, { method: 'POST', body: { reason } });
}
