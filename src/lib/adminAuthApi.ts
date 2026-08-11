import { ApiError, type PlatformRole } from "@/lib/authApi";

/**
 * Client-side helpers for the Mefie Admin Console's own auth flow —
 * establishing a privileged session on top of the ordinary Sanctum login
 * (see PlatformSessionService on the backend). These are same-origin
 * calls to this app's own Route Handlers under /api/admin/mfa and
 * /api/admin/session; ordinary login itself reuses login() from
 * authApi.ts unchanged, since Platform staff sign in through the exact
 * same /api/auth/login endpoint as everyone else.
 */

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

export function requestAdminMfa() {
  return request<{ message: string }>("/api/admin/mfa/request", { method: "POST" });
}

export function resendAdminMfa() {
  return request<{ message: string }>("/api/admin/mfa/resend", { method: "POST" });
}

export type AdminSession = { role: PlatformRole; permissions: string[] };

export function verifyAdminMfa(code: string) {
  return request<AdminSession>("/api/admin/mfa/verify", { method: "POST", body: { code } });
}

/** 401s with code ADMIN_MFA_REQUIRED if there is no live privileged session. */
export function fetchAdminSession() {
  return request<AdminSession>("/api/admin/session");
}

/** "Steps down" from the console without killing the underlying Sanctum login. */
export function endAdminSession() {
  return request<{ ended: true }>("/api/admin/session/end", { method: "POST" });
}

export type PlatformInvitationPreview = {
  first_name: string;
  last_name: string;
  email: string;
  role: PlatformRole;
  requires_login: boolean;
};

export function previewAdminInvitation(token: string) {
  return request<PlatformInvitationPreview>(`/api/auth/admin-invitation/${encodeURIComponent(token)}`);
}

export function acceptAdminInvitation(token: string, input: { password: string; password_confirmation: string }) {
  return request<{ user: { id: number; email: string } }>(
    `/api/auth/admin-invitation/${encodeURIComponent(token)}`,
    { method: "POST", body: input },
  );
}

/** The "existing user, already logged in as the invited email" acceptance path — no body. */
export function acceptAdminInvitationAsCurrentUser(token: string) {
  return request<{ user: { id: number; email: string } }>(
    `/api/auth/admin-invitation/${encodeURIComponent(token)}`,
    { method: "POST" },
  );
}
