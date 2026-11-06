/**
 * OTP request/verify for the personalized event-invitation "magic link"
 * flow. The raw invite token is never passed — the backend reads it
 * from the HttpOnly `mefie_invite_flow` cookie set by the `/invite/
 * {token}` entry handler. `verifyOtp` starts the
 * `mefie_consumer_session` on success, same as locatorApi's pair.
 */
import { buildApiError } from "@/lib/authApi";
import type { OtpSent } from "@/lib/locatorApi";

async function request<T>(path: string, body?: unknown): Promise<T> {
  const res = await fetch(path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw buildApiError(res, data);
  }
  return data as T;
}

export const requestInviteOtp = () =>
  request<OtpSent>("/api/public/event-invitations/otp/request", {});

export const verifyInviteOtp = (code: string) =>
  request<{ status: "verified"; profile: { email: string; first_name: string; last_name: string } }>(
    "/api/public/event-invitations/otp/verify",
    { code },
  );
