/**
 * Client-side helpers for the auth Route Handlers under /api/auth and
 * /api/users/me. These are same-origin calls (no cookie/CSRF handling
 * needed here — that's all done server-side in src/lib/backend.ts) so
 * this file can stay a thin, typed fetch wrapper.
 */

export type Role = "SUPERADMIN" | "ADMIN" | "ORGANIZER";

export type CurrentUser = {
  id: number;
  account_id: number;
  first_name: string;
  last_name: string;
  email: string;
  role: Role;
  email_verified_at: string | null;
  /** When the current pending verification code expires — null if none is active. Server-authoritative; drives the live countdown on the verify screen. */
  email_verification_code_expires_at: string | null;
};

export class ApiError extends Error {
  errors?: Record<string, string[]>;
  status: number;
  /** Machine-readable error code (e.g. EMAIL_NOT_VERIFIED, SESSION_REVOKED, RESEND_COOLDOWN) — see app/Exceptions/ApiException.php. Absent for ordinary field-validation errors. */
  code?: string;

  constructor(message: string, status: number, errors?: Record<string, string[]>, code?: string) {
    super(message);
    this.status = status;
    this.errors = errors;
    this.code = code;
  }

  /** First validation message for a field, if any — handy for form field errors. */
  fieldError(field: string): string | undefined {
    return this.errors?.[field]?.[0];
  }
}

async function request<T>(
  path: string,
  options: { method?: "GET" | "POST" | "PATCH"; body?: unknown } = {},
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

export function registerAccount(input: {
  account_name: string;
  first_name: string;
  last_name: string;
  email: string;
  password: string;
  password_confirmation: string;
}) {
  return request<{ user: CurrentUser }>("/api/auth/registration", { method: "POST", body: input });
}

export function login(input: { email: string; password: string }) {
  return request<{ user: CurrentUser }>("/api/auth/login", { method: "POST", body: input });
}

export function logout() {
  return request<{ message: string }>("/api/auth/logout", { method: "POST" });
}

export function verifyEmail(code: string) {
  return request<{ message: string }>("/api/auth/email/verify", { method: "POST", body: { code } });
}

export function resendVerification() {
  return request<{ message: string; user: CurrentUser }>("/api/auth/email/verify/resend", { method: "POST" });
}

export function changeEmail(input: { email: string; current_password: string }) {
  return request<{ user: CurrentUser; message: string }>("/api/auth/email/change", {
    method: "POST",
    body: input,
  });
}

export function acceptInvitation(
  token: string,
  input: { first_name: string; last_name: string; password: string; password_confirmation: string },
) {
  return request<{ user: CurrentUser }>(`/api/auth/invitation/${encodeURIComponent(token)}`, {
    method: "POST",
    body: input,
  });
}

export function fetchCurrentUser() {
  return request<{ user: CurrentUser }>("/api/users/me");
}

export function updateCurrentUser(input: { first_name?: string; last_name?: string }) {
  return request<{ user: CurrentUser }>("/api/users/me", { method: "PATCH", body: input });
}
