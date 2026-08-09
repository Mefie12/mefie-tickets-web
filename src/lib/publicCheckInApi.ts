import { ApiError } from "@/lib/authApi";

export type CheckInAttendee = {
  short_id: string;
  first_name: string;
  last_name: string;
  email: string;
  product_title: string;
  is_checked_in: boolean;
  active_check_in: { short_id: string; created_at: string } | null;
};

export type CheckInStats = { total: number; checked_in: number; remaining: number };

export type RecentCheckIn = {
  short_id: string;
  attendee_short_id: string;
  attendee_name: string;
  created_at: string;
};

export type CheckInListPayload = {
  check_in_list: { short_id: string; name: string; event_title: string; event_timezone: string };
  stats: CheckInStats;
  attendees: CheckInAttendee[];
  recent_check_ins: RecentCheckIn[];
};

export type CheckInResult = {
  check_in: { short_id: string; created_at: string };
  attendee: CheckInAttendee;
  stats: CheckInStats;
};

export type UndoResult = { attendee: CheckInAttendee; stats: CheckInStats };

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

export function getPublicCheckInList(shortId: string) {
  return request<CheckInListPayload>(`/api/public/check-in-lists/${shortId}`);
}

export function checkInByToken(shortId: string, lookupToken: string) {
  return request<CheckInResult>(`/api/public/check-in-lists/${shortId}/check-ins`, {
    method: "POST",
    body: { lookup_token: lookupToken },
  });
}

export function checkInByAttendee(shortId: string, attendeeShortId: string) {
  return request<CheckInResult>(`/api/public/check-in-lists/${shortId}/check-ins`, {
    method: "POST",
    body: { attendee_short_id: attendeeShortId },
  });
}

export function undoCheckIn(shortId: string, checkInShortId: string) {
  return request<UndoResult>(`/api/public/check-in-lists/${shortId}/check-ins/${checkInShortId}`, {
    method: "DELETE",
  });
}
