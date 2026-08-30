/**
 * Client-side helpers for the gate-device Route Handlers under
 * /api/gate/**. Replaces the old publicCheckInApi.ts: same roster /
 * check-in / undo shapes, but every call now rides the isolated
 * `mefie_gate_session` cookie and the backend enforces the
 * check-in / undo capability split (docs/17 §13.1).
 */
import { ApiError } from "@/lib/authApi";

async function request<T>(
  path: string,
  options: { method?: "GET" | "POST" | "DELETE"; body?: unknown } = {},
): Promise<T> {
  const res = await fetch(path, {
    method: options.method ?? "GET",
    headers: { "Content-Type": "application/json" },
    body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new ApiError(data?.message ?? "Something went wrong.", res.status, data?.errors, data?.code);
  }
  return data as T;
}

export type GateCapability = "check-in" | "undo";

export type GateSessionInfo = {
  role: "SCANNER" | "SUPERVISOR";
  capabilities: GateCapability[];
  can_view_contact: boolean;
  event: { id: number; title: string | null };
};

export type GateCheckInAttendee = {
  short_id: string;
  first_name: string;
  last_name: string;
  email: string;
  product_title: string;
  is_checked_in: boolean;
  active_check_in: { short_id: string; created_at: string } | null;
};

export type GateCheckInStats = { total: number; checked_in: number; remaining: number };

export type GateRecentCheckIn = {
  short_id: string;
  attendee_short_id: string;
  attendee_name: string;
  created_at: string;
};

export type GateRosterPayload = {
  check_in_list: { short_id: string; name: string; event_title: string; event_timezone: string };
  stats: GateCheckInStats;
  attendees: GateCheckInAttendee[];
  recent_check_ins: GateRecentCheckIn[];
};

export type GateCheckInResult = {
  check_in: { short_id: string; created_at: string };
  attendee: GateCheckInAttendee;
  stats: GateCheckInStats;
};

export type GateUndoResult = { attendee: GateCheckInAttendee; stats: GateCheckInStats };

export const startGateSession = (body: {
  event_id: number;
  label: string;
  secret: string;
  device_label?: string;
}) => request<GateSessionInfo>("/api/gate/sessions", { method: "POST", body });

export const endGateSession = () => request<{ status: "ended" }>("/api/gate/sessions/current", { method: "DELETE" });

export const getGateRoster = (shortId: string) =>
  request<GateRosterPayload>(`/api/gate/lists/${encodeURIComponent(shortId)}`);

export const gateCheckInByToken = (shortId: string, lookupToken: string) =>
  request<GateCheckInResult>(`/api/gate/lists/${encodeURIComponent(shortId)}/check-ins`, {
    method: "POST",
    body: { lookup_token: lookupToken },
  });

export const gateCheckInByAttendee = (shortId: string, attendeeShortId: string) =>
  request<GateCheckInResult>(`/api/gate/lists/${encodeURIComponent(shortId)}/check-ins`, {
    method: "POST",
    body: { attendee_short_id: attendeeShortId },
  });

export const gateUndoCheckIn = (shortId: string, checkInShortId: string) =>
  request<GateUndoResult>(
    `/api/gate/lists/${encodeURIComponent(shortId)}/check-ins/${encodeURIComponent(checkInShortId)}`,
    { method: "DELETE" },
  );
