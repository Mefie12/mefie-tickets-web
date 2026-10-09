import { ApiError } from "@/lib/authApi";

/**
 * Client-side helpers for venue agents (docs/25): read-only, per-event,
 * cross-organization inspectors. Organizer management lives under
 * /api/events/{id}/venue-access, the agent's own surface under /api/venue/*,
 * both proxied through this app's Route Handlers.
 */

export type VenueGrantStatus = "INVITED" | "ACTIVE" | "REVOKED";
export type VenueGrantDisplayStatus = VenueGrantStatus | "EXPIRED";

export type VenueGrant = {
  id: string;
  name: string;
  email: string;
  status: VenueGrantStatus;
  display_status: VenueGrantDisplayStatus;
  accepted_at: string | null;
  revoked_at: string | null;
  last_invited_at: string | null;
  invitation_expires_at: string | null;
  /** The venue named on the event when this agent was invited (null if the event had none). */
  venue_name_at_invite: string | null;
  current_venue_name: string | null;
  /** The event has moved to a different venue since the invitation. Access is NOT removed; the organizer decides. */
  venue_changed: boolean;
};

export type VenueGrantList = {
  grants: VenueGrant[];
  limits: { max_live: number; access_grace_days: number };
};

export type VenuePhase = "UPCOMING" | "LIVE_NOW" | "PAST";

export type VenueEventRow = {
  id: number;
  title: string;
  organizer: string;
  venue_name: string | null;
  start_date: string | null;
  end_date: string | null;
  doors_open_at: string | null;
  timezone: string;
  phase: VenuePhase;
};

export type VenueCategory = {
  name: string;
  ticket_sales: number;
  registrations: number;
  complimentary: number;
  checked_in: number;
};

export type VenueEventSummary = {
  event: {
    id: number;
    title: string;
    organizer: string;
    venue_name: string | null;
    city: string | null;
    timezone: string;
    start_date: string | null;
    end_date: string | null;
    doors_open_at: string | null;
    status: string;
  };
  ticket_sales: number;
  registrations: number;
  complimentary: number;
  expected_attendance: number;
  checked_in: number;
  still_expected: number;
  allocated_not_issued: number;
  by_category: VenueCategory[];
  generated_at: string;
};

export type VenueInvitationPreview = {
  requires_login: boolean;
  invitation: { name: string; email: string; event_title: string; venue_name: string | null; organizer: string; start_date: string | null; timezone: string; expires_at: string };
};

async function request<T>(path: string, options: { method?: "GET" | "POST"; body?: unknown } = {}): Promise<T> {
  const res = await fetch(path, {
    method: options.method ?? "GET",
    headers: { "Content-Type": "application/json" },
    cache: "no-store",
    body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(data?.message ?? "Something went wrong.", res.status, data?.errors, data?.code);

  return data as T;
}

export function listVenueGrants(eventId: number) {
  return request<VenueGrantList>(`/api/events/${eventId}/venue-access`);
}

export function inviteVenueAgent(eventId: number, input: { name: string; email: string }) {
  return request<{ grant: VenueGrant }>(`/api/events/${eventId}/venue-access`, { method: "POST", body: input });
}

export function manageVenueGrant(eventId: number, grantId: string, action: "resend" | "revoke" | "keep-venue") {
  return request<{ grant: VenueGrant }>(`/api/events/${eventId}/venue-access/${encodeURIComponent(grantId)}/${action}`, { method: "POST", body: {} });
}

export function listVenueEvents() {
  return request<{ events: VenueEventRow[] }>("/api/venue/events");
}

export function getVenueEventSummary(eventId: number | string) {
  return request<VenueEventSummary>(`/api/venue/events/${eventId}`);
}

/** Badge colour and label for a grant row; an INVITED grant whose link lapsed reads "Invite expired". */
export function grantStatusPresentation(status: VenueGrantDisplayStatus): { label: string; color: string } {
  switch (status) {
    case "ACTIVE":
      return { label: "Active", color: "teal" };
    case "INVITED":
      return { label: "Invited", color: "blue" };
    case "EXPIRED":
      return { label: "Invite expired", color: "orange" };
    case "REVOKED":
      return { label: "Revoked", color: "gray" };
  }
}

/** Groups the agent's event list for display; past events collapse under their own heading. */
export function groupVenueEvents(events: VenueEventRow[]): { live: VenueEventRow[]; upcoming: VenueEventRow[]; past: VenueEventRow[] } {
  const byStart = (a: VenueEventRow, b: VenueEventRow) => (a.start_date ?? "").localeCompare(b.start_date ?? "");

  return {
    live: events.filter((e) => e.phase === "LIVE_NOW").sort(byStart),
    upcoming: events.filter((e) => e.phase === "UPCOMING").sort(byStart),
    past: events.filter((e) => e.phase === "PAST").sort((a, b) => byStart(b, a)),
  };
}

/** A date-time in the EVENT's zone (not the viewer's), e.g. "Sat, 12 Oct, 18:00". */
export function formatInZone(iso: string | null, timezone: string): string {
  if (!iso) return "—";
  try {
    return new Intl.DateTimeFormat("en-GB", { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", hour12: false, timeZone: timezone }).format(new Date(iso));
  } catch {
    return new Intl.DateTimeFormat("en-GB", { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "UTC" }).format(new Date(iso)) + " UTC";
  }
}

/** Just the time of day in the event's zone, for "Updated at". */
export function timeInZone(iso: string, timezone: string): string {
  try {
    return new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false, timeZone: timezone }).format(new Date(iso));
  } catch {
    return new Date(iso).toISOString().slice(11, 19) + " UTC";
  }
}

/** Preset choices for "doors open before start"; null means not set. */
export const DOORS_PRESETS = [15, 30, 45, 60, 90, 120] as const;
