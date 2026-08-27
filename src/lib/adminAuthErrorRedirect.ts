import { ApiError } from "@/lib/authApi";
import { redirectOnAuthError } from "@/lib/authErrorRedirect";

/**
 * Admin Console variant of redirectOnAuthError — also handles a
 * privileged session lapsing mid-page (the 6-hour TTL, or an explicit
 * revoke from another tab/device — see PlatformSessionService::revoke())
 * by sending the visitor back through /admin/mfa rather than a generic
 * error toast.
 */
export function redirectOnAdminAuthError(error: unknown, router: { push: (href: string) => void }): boolean {
  if (redirectOnAuthError(error, router)) return true;

  if (error instanceof ApiError && error.code === "ADMIN_MFA_REQUIRED") {
    const returnTo = typeof window !== "undefined" ? `${window.location.pathname}${window.location.search}` : "/admin/dashboard";
    router.push(`/admin/mfa?returnTo=${encodeURIComponent(returnTo)}`);
    return true;
  }
  if (error instanceof ApiError && error.code === "ADMIN_RECENT_AUTH_REQUIRED") {
    const returnTo = typeof window !== "undefined" ? `${window.location.pathname}${window.location.search}` : "/admin/dashboard";
    router.push(`/admin/reauthenticate?returnTo=${encodeURIComponent(returnTo)}`);
    return true;
  }

  return false;
}
