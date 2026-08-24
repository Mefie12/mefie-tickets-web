import { ApiError, type CurrentUser, type PlatformRole } from "@/lib/authApi";

async function request<T>(path: string, options: { method?: "GET" | "POST" | "DELETE"; body?: unknown } = {}): Promise<T> {
  const res = await fetch(path, { method: options.method ?? "GET", headers: { "Content-Type": "application/json" },
    body: options.body !== undefined ? JSON.stringify(options.body) : undefined });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(data?.message ?? "Something went wrong.", res.status, data?.errors, data?.code);
  return data as T;
}

export type AdminChallenge = { id: string; purpose: "login" | "step_up"; masked_email: string; expires_at: string;
  resend_available_at: string | null; attempts_remaining: number; status: "pending" | "expired" };
export type AdminDeviceSession = { id: string; device_name: string; ip_address: string | null; created_at: string;
  last_used_at: string; expires_at: string; idle_expires_at: string; current: boolean };
export type AdminSession = { role: PlatformRole; permissions: string[]; session?: AdminDeviceSession };
export type AdminAuthReason = "active" | "expired" | "idle_timeout" | "revoked" | "membership_changed" | "authentication_required" | "unauthorized" | "service_error";
export type AdminAuthStateResponse = { status: AdminAuthReason; challenge: AdminChallenge | null; role?: PlatformRole;
  permissions?: string[]; session?: AdminDeviceSession };

export function adminLogin(input: { email: string; password: string; remember?: boolean }) {
  return request<{ user: CurrentUser; challenge: AdminChallenge }>("/api/auth/admin/login", { method: "POST", body: input });
}
export function reauthenticateAdmin(password: string, purpose: "login" | "step_up") {
  return request<{ challenge: AdminChallenge }>("/api/admin/reauthenticate", { method: "POST", body: { password, purpose } });
}
export function fetchAdminAuthState() { return request<AdminAuthStateResponse>("/api/admin/auth-state"); }
export function fetchAdminChallenge(id: string) { return request<{ challenge: AdminChallenge }>(`/api/admin/mfa/challenges/${encodeURIComponent(id)}`); }
export function resendAdminMfa(id: string) { return request<{ challenge: AdminChallenge }>(`/api/admin/mfa/challenges/${encodeURIComponent(id)}/resend`, { method: "POST" }); }
export function verifyAdminMfa(id: string, code: string) {
  return request<AdminSession & { verified: true; purpose: "login" | "step_up" }>(`/api/admin/mfa/challenges/${encodeURIComponent(id)}/verify`, { method: "POST", body: { code } });
}
export function fetchAdminSession() { return request<AdminSession>("/api/admin/session"); }
export function endAdminSession() { return request<{ ended: true }>("/api/admin/session/end", { method: "POST" }); }
export function listAdminSessions() { return request<{ sessions: AdminDeviceSession[]; max_sessions: number }>("/api/admin/sessions"); }
export function revokeAdminSession(id: string) { return request<{ revoked: true }>(`/api/admin/sessions/${encodeURIComponent(id)}`, { method: "DELETE" }); }
export function endOtherAdminSessions() { return request<{ ended: true }>("/api/admin/sessions/end-others", { method: "POST" }); }

export type PlatformInvitationPreview = { first_name: string; last_name: string; email: string; role: PlatformRole; requires_login: boolean };
export function previewAdminInvitation(token: string) { return request<PlatformInvitationPreview>(`/api/auth/admin-invitation/${encodeURIComponent(token)}`); }
export function acceptAdminInvitation(token: string, input: { password: string; password_confirmation: string }) {
  return request<{ user: { id: number; email: string } }>(`/api/auth/admin-invitation/${encodeURIComponent(token)}`, { method: "POST", body: input });
}
export function acceptAdminInvitationAsCurrentUser(token: string) {
  return request<{ user: { id: number; email: string } }>(`/api/auth/admin-invitation/${encodeURIComponent(token)}`, { method: "POST" });
}
