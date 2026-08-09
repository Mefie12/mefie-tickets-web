import { ApiError } from "@/lib/authApi";

export type CheckInList = {
  id: number;
  event_id: number;
  short_id: string;
  name: string;
  product_ids: number[] | null;
  created_at: string;
};

export type ShareLinks = { public_url: string; qr_code_data_uri: string };

export type CheckInListWithLinks = CheckInList & { share_links: ShareLinks };

async function request<T>(path: string, options: { method?: "GET" | "POST"; body?: unknown } = {}): Promise<T> {
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

export function listCheckInLists(eventId: number) {
  return request<{ check_in_lists: CheckInListWithLinks[] }>(`/api/events/${eventId}/check-in-lists`);
}

export function createCheckInList(eventId: number, data: { name: string; product_ids?: number[] | null }) {
  return request<{ check_in_list: CheckInList; share_links: ShareLinks }>(`/api/events/${eventId}/check-in-lists`, {
    method: "POST",
    body: data,
  });
}

export function getCheckInList(eventId: number, checkInListId: number) {
  return request<{ check_in_list: CheckInList; share_links: ShareLinks }>(
    `/api/events/${eventId}/check-in-lists/${checkInListId}`,
  );
}
