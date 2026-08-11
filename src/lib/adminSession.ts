import { cache } from "react";
import { backendRequest } from "@/lib/backend";
import type { CurrentUser, PlatformRole } from "@/lib/authApi";

/**
 * Four distinct states a visitor to /admin/* can be in, resolved from a
 * single GET /api/admin/session call (behind platform.membership +
 * admin.session on the backend):
 *
 *   - unauthenticated: no Sanctum session at all.
 *   - unauthorized: logged in, but no Platform membership — a legitimate
 *     customer-org user with no platform access whatsoever
 *     (EnsurePlatformMembership 403s).
 *   - unprivileged: has a Platform membership, but no live MFA-backed
 *     privileged session yet (EnsurePrivilegedAdminSession 401s with
 *     ADMIN_MFA_REQUIRED) — needs to go through /admin/mfa.
 *   - privileged: a live privileged session; role/permissions are
 *     computed fresh by the backend on every call (decision #15), never
 *     cached here beyond the single request.
 *
 * Wrapped in cache() so a page and its layout share one Laravel round
 * trip per request, matching src/lib/session.ts's getCurrentUser.
 */
export type AdminAuthState =
  | { status: "unauthenticated" }
  | { status: "unverified"; user: CurrentUser }
  | { status: "unauthorized"; user: CurrentUser }
  | { status: "unprivileged"; user: CurrentUser }
  | { status: "privileged"; user: CurrentUser; role: PlatformRole; permissions: string[] };

export const getAdminAuthState = cache(async (): Promise<AdminAuthState> => {
  const userResult = await backendRequest<{ user: CurrentUser }>("/api/users/me");
  if (userResult.status !== 200) {
    return { status: "unauthenticated" };
  }
  const user = userResult.data.user;

  const sessionResult = await backendRequest<{ role: PlatformRole; permissions: string[]; code?: string }>(
    "/api/admin/session",
  );

  if (sessionResult.status === 200) {
    return { status: "privileged", user, role: sessionResult.data.role, permissions: sessionResult.data.permissions };
  }

  if (sessionResult.data?.code === "EMAIL_NOT_VERIFIED") {
    return { status: "unverified", user };
  }

  if (sessionResult.status === 403) {
    return { status: "unauthorized", user };
  }

  return { status: "unprivileged", user };
});
