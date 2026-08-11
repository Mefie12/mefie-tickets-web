import { ApiError, type PlatformRole } from "@/lib/authApi";

/**
 * Client-side helpers for the Admin Users tab (Super-Admin-only staff
 * invitation/management) of the Mefie Admin Console.
 */

export type AdminMembershipStatus = "PENDING" | "ACTIVE" | "SUSPENDED" | "REMOVED";
export type AdminInvitationStatus = "PENDING" | "EXPIRED";

export type AdminUserMemberRow = {
  type: "member";
  id: number;
  first_name: string;
  last_name: string;
  email: string;
  role: PlatformRole;
  status: AdminMembershipStatus;
  date_added: string;
};

export type AdminUserInvitationRow = {
  type: "invitation";
  id: number;
  first_name: string;
  last_name: string;
  email: string;
  role: PlatformRole;
  status: AdminInvitationStatus;
  date_added: string;
};

export type AdminUserRow = AdminUserMemberRow | AdminUserInvitationRow;

export const INVITABLE_PLATFORM_ROLES: { value: PlatformRole; label: string }[] = [
  { value: "PLATFORM_SUPER_ADMIN", label: "Super Admin" },
  { value: "PLATFORM_OPERATIONS", label: "Operations" },
  { value: "PLATFORM_FINANCE", label: "Finance" },
  { value: "PLATFORM_SUPPORT", label: "Support" },
];

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

export function listAdminStaff() {
  return request<{ admin_users: AdminUserRow[] }>("/api/admin/admin-users");
}

export function inviteAdminStaff(input: { first_name: string; last_name: string; email: string; role: PlatformRole }) {
  return request<{
    invitation: { id: number; email: string; first_name: string; last_name: string; role: PlatformRole; expires_at: string };
  }>("/api/admin/admin-users/invitations", { method: "POST", body: input });
}

export function cancelAdminInvitation(invitationId: number) {
  return request<{ cancelled: true }>(`/api/admin/admin-users/invitations/${invitationId}`, { method: "DELETE" });
}

export function updateAdminStaffRole(membershipId: number, role: PlatformRole) {
  return request<{ membership: unknown }>(`/api/admin/admin-users/${membershipId}`, {
    method: "PATCH",
    body: { role },
  });
}

export function removeAdminStaff(membershipId: number) {
  return request<{ removed: true }>(`/api/admin/admin-users/${membershipId}`, { method: "DELETE" });
}

export function suspendAdminStaff(membershipId: number) {
  return request<{ membership: unknown }>(`/api/admin/admin-users/${membershipId}/suspend`, { method: "PATCH" });
}

export function restoreAdminStaff(membershipId: number) {
  return request<{ membership: unknown }>(`/api/admin/admin-users/${membershipId}/restore`, { method: "PATCH" });
}
