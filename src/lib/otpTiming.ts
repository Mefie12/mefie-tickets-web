/**
 * Pure helpers for one-time-code timers (code expiry + resend wait).
 *
 * The server sends "seconds from now" (`expires_in`, `resend_in`, and
 * `retry_after` on a 429). We turn those into absolute client-clock
 * deadlines the moment the response arrives, so a skewed device clock
 * never changes the countdown and a throttled/backgrounded tab can't
 * drift (each tick recomputes from `Date.now()`).
 */

export type OtpTiming = { expiresAt: number | null; resendAt: number | null };

export const NO_OTP_TIMING: OtpTiming = { expiresAt: null, resendAt: null };

/** Whole seconds left until `deadline` (rounded up, never negative); 0 when there is no deadline. */
export function secondsUntil(deadline: number | null, now: number = Date.now()): number {
  if (deadline === null) return 0;
  return Math.max(0, Math.ceil((deadline - now) / 1000));
}

export function formatMMSS(totalSeconds: number): string {
  const seconds = Math.max(0, Math.floor(totalSeconds));
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
}

export function deadlineIn(seconds: number, now: number = Date.now()): number {
  return now + seconds * 1000;
}

function positiveNumber(value: unknown): number | null {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n : null;
}

/** Reads `expires_in` / `resend_in` off a successful "code sent" response. */
export function parseOtpTiming(data: unknown, now: number = Date.now()): OtpTiming {
  const body = (data ?? {}) as Record<string, unknown>;
  const expiresIn = positiveNumber(body.expires_in);
  const resendIn = positiveNumber(body.resend_in);
  return {
    expiresAt: expiresIn === null ? null : deadlineIn(expiresIn, now),
    resendAt: resendIn === null ? null : deadlineIn(resendIn, now),
  };
}

/** Label for a resend button: counts down, then reads `readyLabel`. */
export function resendLabel(secondsLeft: number, readyLabel = "Resend code"): string {
  return secondsLeft > 0 ? `Resend in ${formatMMSS(secondsLeft)}` : readyLabel;
}

/** Appends "Try again in m:ss." to a rate-limit message — for static error text where a live timer isn't shown. */
export function withRetryHint(message: string, retryAfterSeconds: number | undefined): string {
  return retryAfterSeconds && retryAfterSeconds > 0 ? `${message} Try again in ${formatMMSS(retryAfterSeconds)}.` : message;
}
