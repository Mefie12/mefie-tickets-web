import { cache } from "react";
import { backendRequest } from "@/lib/backend";
import type { CurrentUser, Role } from "@/lib/authApi";
import type { Event } from "@/lib/eventApi";
import type { Organization } from "@/lib/organizationApi";
import type { TeamRow } from "@/lib/teamApi";

/**
 * CurrentUser enriched with this user's role in their current
 * organization. The backend deliberately doesn't put role on the user
 * payload (see CurrentUser's docblock — role lives on
 * OrganizationMembership, not User), so resolving it here means a
 * second call to GET /api/organization/members, matching the row back
 * to this user by email. Only attempted once the session is verified —
 * that endpoint sits behind the `verified` middleware, so an unverified
 * session would just 403 on it.
 */
export type SessionUser = CurrentUser & { role: Role | null };

/**
 * Wrapped in React's cache() so the (organization) layout's auth guard and any
 * page under it that also needs the current user share one Laravel call
 * per request, instead of each Server Component fetching it separately.
 */
export const getCurrentUser = cache(async (): Promise<SessionUser | null> => {
  const result = await backendRequest<{ user: CurrentUser }>("/api/users/me");
  if (result.status !== 200) return null;

  const user = result.data.user;

  if (!user.email_verified_at) {
    // Unverified sessions can't call the members endpoint (verified-only)
    // and don't need a role yet — the (organization) layout redirects these to
    // /verify-email before anything role-gated is ever rendered.
    return { ...user, role: null };
  }

  const membersResult = await backendRequest<{ members: TeamRow[] }>("/api/organization/members");
  const role =
    membersResult.status === 200
      ? (membersResult.data.members.find((row) => row.type === "member" && row.email === user.email)?.role ?? null)
      : null;

  return { ...user, role };
});

/**
 * Cached per request so the event layout's guard and the pages under it
 * (e.g. Overview's "Share this event" card) share one GET /api/events/{id}
 * on the single-process dev API instead of each fetching it separately.
 */
export const getEventById = cache(async (id: string): Promise<Event | null> => {
  const result = await backendRequest<{ event: Event }>(`/api/events/${id}`);
  return result.status === 200 ? result.data.event : null;
});

/** The signed-in organizer's current organization — name + slug + logo for the public navbar. */
export type NavOrganization = { name: string; slug: string; logo_url: string | null };

/**
 * Cached so the public site header (which already resolves getCurrentUser)
 * can add the org's branding without a second uncached round-trip.
 * Returns null for anonymous visitors and distributor-only accounts.
 */
export const getCurrentOrganization = cache(async (): Promise<NavOrganization | null> => {
  const result = await backendRequest<{ organization: Organization | null }>("/api/organization");
  if (result.status !== 200 || !result.data.organization) return null;

  const { name, slug, logo_url } = result.data.organization;

  return { name, slug, logo_url };
});
