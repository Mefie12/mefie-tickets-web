/**
 * OTP request/verify for the order-locator flow. The raw locator token
 * is never passed — the backend reads it from the HttpOnly
 * `mefie_locator_flow` cookie set by the `/t/{token}` entry handler.
 * `verifyOtp` starts the `mefie_consumer_session` on success.
 */
import { buildApiError } from "@/lib/authApi";

/** `expires_in` / `resend_in` are seconds from now — see lib/otpTiming.ts. */
export type OtpSent = { status: "sent"; masked_email: string; expires_in?: number; resend_in?: number };

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

export const requestOtp = () =>
  request<OtpSent>("/api/public/consumer/otp/request", {});

export const verifyOtp = (code: string) =>
  request<{ status: "verified"; profile: { email: string; first_name: string; last_name: string } }>(
    "/api/public/consumer/otp/verify",
    { code },
  );
