import { ApiError } from "@/lib/authApi";

/**
 * A long-lived session can get gated mid-session, not just at page load
 * — e.g. right after changing email (EMAIL_NOT_VERIFIED) or from another
 * tab/device changing it first (SESSION_REVOKED). Call this first in a
 * mutation's onError; if it returns true, the redirect is already
 * underway and the generic error toast should be skipped.
 */
export function redirectOnAuthError(error: unknown, router: { push: (href: string) => void }): boolean {
  if (!(error instanceof ApiError)) return false;

  if (error.code === "EMAIL_NOT_VERIFIED") {
    router.push("/verify-email");
    return true;
  }

  if (error.code === "SESSION_REVOKED") {
    router.push("/login");
    return true;
  }

  return false;
}
