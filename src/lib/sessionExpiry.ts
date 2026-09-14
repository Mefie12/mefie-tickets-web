import { ApiError } from "@/lib/authApi";

/**
 * Global "your session ended while the tab was open" handling.
 *
 * Server Components already bounce an unauthenticated visitor to the
 * right sign-in screen via each route group's layout guard
 * (src/lib/session.ts, src/lib/consumerSession.ts). But once the app is
 * hydrated and the user just leaves the tab open, the Sanctum / consumer
 * cookie can lapse with no navigation — every subsequent query/mutation
 * then 401s and the UI silently goes stale until a manual reload.
 *
 * This module is the client-side backstop: wired into the QueryCache /
 * MutationCache in providers.tsx, it turns any session-ended 401 into a
 * hard redirect to the correct sign-in screen (which also wipes the
 * in-memory query cache and re-runs the server guards), carrying a
 * `?expired=1` flag so that screen can explain why, and `next=` so the
 * organizer lands back where they were.
 */

// Screens that ARE the sign-in flow — never redirect away from these
// (prevents a loop, and a wrong password there is a 422 anyway).
const AUTH_PATHS = [
  "/login",
  "/organizers/login",
  "/organizers/register",
  "/register",
  "/forgot-password",
  "/reset-password",
  "/verify-email",
  "/tickets/verify",
  "/invitations/accept",
  "/t", // raw locator entry (/t/{token})
];

// The Admin Console has its own MFA/re-auth redirect logic
// (adminAuthErrorRedirect.ts) and is out of scope here.
const OUT_OF_SCOPE = ["/admin"];

const isUnder = (path: string, base: string) => path === base || path.startsWith(`${base}/`);

let redirecting = false;

/**
 * A 401 that means "the session is gone", as opposed to a step-up / MFA
 * / not-yet-verified gate (those carry their own codes and screens).
 */
export function isSessionExpiryError(error: unknown): boolean {
  if (!(error instanceof ApiError) || error.status !== 401) return false;
  const code = error.code;
  return (
    code === undefined || // bare Laravel "Unauthenticated." — the idle-timeout case
    code === "SESSION_REVOKED" ||
    code === "CONSUMER_AUTH_REQUIRED"
  );
}

/**
 * If `error` is a session-expiry 401, start a hard redirect to the right
 * sign-in screen and return true. Safe to call from multiple error
 * handlers — only the first one navigates.
 */
export function handleSessionExpiry(error: unknown): boolean {
  if (typeof window === "undefined" || !isSessionExpiryError(error)) return false;
  if (redirecting) return true;

  const path = window.location.pathname;
  if (OUT_OF_SCOPE.some((p) => isUnder(path, p))) return false;
  if (AUTH_PATHS.some((p) => isUnder(path, p))) return true; // already signing in — nothing to do

  redirecting = true;
  const isConsumer = path === "/tickets" || path.startsWith("/tickets/");
  const current = `${window.location.pathname}${window.location.search}`;
  const target = isConsumer
    ? `/login?expired=1&next=${encodeURIComponent(current)}`
    : `/organizers/login?expired=1&next=${encodeURIComponent(current)}`;
  // A full-document navigation on purpose: it discards the in-memory
  // TanStack Query cache built under the dead session and re-runs the
  // server-side layout guards. A soft router.push() would keep the stale
  // cache around and isn't reachable from the QueryClient factory anyway.
  window.location.assign(target);
  return true;
}
