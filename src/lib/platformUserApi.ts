import { ApiError, type UserStatus } from "@/lib/authApi";
import type { PageMeta } from "@/lib/platformOrganizationApi";

/**
 * Client-side helpers for the Users tab of the Mefie Admin Console.
 */

export type AdminUser = {
  id: number;
  first_name: string;
  last_name: string;
  email: string;
  phone: string | null;
  status: UserStatus;
  suspended_at: string | null;
  suspended_reason: string | null;
  email_verified_at: string | null;
  created_at: string;
  deleted_at: string | null;
};

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

export function listAdminUsers(params: { q?: string; status?: string; page?: number } = {}) {
  const query = new URLSearchParams();
  if (params.q) query.set("q", params.q);
  if (params.status) query.set("status", params.status);
  if (params.page) query.set("page", String(params.page));
  const qs = query.toString();
  return request<{ users: AdminUser[]; meta: PageMeta }>(`/api/admin/users${qs ? `?${qs}` : ""}`);
}

export function fetchAdminUser(id: number) {
  return request<{ user: AdminUser }>(`/api/admin/users/${id}`);
}

export function suspendUser(id: number, reason: string) {
  return request<{ user: AdminUser }>(`/api/admin/users/${id}/suspend`, { method: "PATCH", body: { reason } });
}

export function restoreUser(id: number, reason: string) {
  return request<{ user: AdminUser }>(`/api/admin/users/${id}/restore`, { method: "PATCH", body: { reason } });
}
