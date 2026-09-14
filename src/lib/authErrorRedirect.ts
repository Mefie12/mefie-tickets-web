import { ApiError } from "@/lib/authApi";
import { handleSessionExpiry } from "@/lib/sessionExpiry";

/**
 * A long-lived session can get gated mid-session, not just at page load
 * — e.g. right after changing email (EMAIL_NOT_VERIFIED) or from another
 * tab/device changing it first (SESSION_REVOKED), or simply an idle
 * timeout. Call this first in a mutation's onError; if it returns true,
 * a redirect is already underway and the generic error toast should be
 * skipped.
 */
export function redirectOnAuthError(error: unknown, router: { push: (href: string) => void }): boolean {
  // Session-ended 401s (idle timeout, SESSION_REVOKED, consumer auth) get
  // a hard redirect to the right sign-in screen via the shared handler,
  // which also carries the `?expired=1` notice and `next=` return path.
  if (handleSessionExpiry(error)) return true;

  if (error instanceof ApiError && error.code === "EMAIL_NOT_VERIFIED") {
    router.push("/verify-email");
    return true;
  }

  return false;
}
