"use client";

import { useCallback, useEffect, useState } from "react";
import { ApiError } from "@/lib/authApi";
import { resolveApiErrorMessage } from "@/lib/apiErrorMessages";
import { NO_OTP_TIMING, deadlineIn, parseOtpTiming, secondsUntil, withRetryHint, type OtpTiming } from "@/lib/otpTiming";

/**
 * Live timers for a one-time-code screen, driven by the server:
 *  - `expirySeconds`: how long the emailed code is still valid
 *  - `resendSeconds`: how long until another code may be requested
 *  - `blocked`: the last request was rejected with a 429 (cooldown / ceiling / IP limit); its
 *    `retry_after` feeds `resendSeconds`, and `blocked` clears itself when the wait is over.
 *
 * Call `noteSent(response)` after a successful "code sent" and `noteRateLimited(error)` from the
 * failure handler (returns true when the error was a rate limit and is now shown as a countdown).
 */
export function useOtpTimers() {
  const [timing, setTiming] = useState<OtpTiming>(NO_OTP_TIMING);
  const [blockedMessage, setBlockedMessage] = useState<string | null>(null);
  const [now, setNow] = useState(() => Date.now());

  const active = timing.expiresAt !== null || timing.resendAt !== null;
  useEffect(() => {
    if (!active) return;
    const tick = () => setNow(Date.now());
    tick();
    const interval = window.setInterval(tick, 1000);
    // A backgrounded tab throttles intervals — catch up the moment it is visible again.
    document.addEventListener("visibilitychange", tick);
    return () => {
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", tick);
    };
  }, [active]);

  const noteSent = useCallback((data: unknown) => {
    // Refresh `now` with the deadlines: when idle it is as old as the last tick (or the page load).
    setNow(Date.now());
    setBlockedMessage(null);
    setTiming(parseOtpTiming(data));
  }, []);

  const noteRateLimited = useCallback((error: unknown): boolean => {
    if (!(error instanceof ApiError) || error.status !== 429 || !error.retryAfter) return false;
    const resendAt = deadlineIn(error.retryAfter);
    setNow(Date.now());
    setTiming((current) => ({ ...current, resendAt }));
    setBlockedMessage(error.message);
    return true;
  }, []);

  const clear = useCallback(() => {
    setTiming(NO_OTP_TIMING);
    setBlockedMessage(null);
  }, []);

  const expirySeconds = secondsUntil(timing.expiresAt, now);
  const resendSeconds = secondsUntil(timing.resendAt, now);

  return {
    expirySeconds,
    resendSeconds,
    /** The server told us when the code expires (an older API may not) — hide the timer when it didn't. */
    hasExpiry: timing.expiresAt !== null,
    /** A code was sent and its validity has run out. */
    expired: timing.expiresAt !== null && expirySeconds === 0,
    /** The last request was rejected and the wait is not over yet. */
    blocked: blockedMessage !== null && resendSeconds > 0,
    blockedMessage,
    noteSent,
    noteRateLimited,
    clear,
  };
}

/**
 * Error text for a failed code request/verify. A 429 gets "Try again in m:ss." appended — for the
 * places that show a static message (verify rejections) rather than the live OtpBlockedNotice.
 */
export function otpErrorMessage(error: unknown): string {
  const message = resolveApiErrorMessage(error);
  return error instanceof ApiError && error.status === 429 ? withRetryHint(message, error.retryAfter) : message;
}
