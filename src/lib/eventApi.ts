import { ApiError } from "@/lib/authApi";

export type EventStatus = "DRAFT" | "LIVE" | "ARCHIVED";

/** Matches App\Domain\Events\DataObjects\EventLocationData exactly. */
export type EventLocationInput = {
  venue_name?: string | null;
  address_line1?: string | null;
  address_line2?: string | null;
  city?: string | null;
  state?: string | null;
  postal_code?: string | null;
  country?: string | null;
  is_online: boolean;
  online_url?: string | null;
};

export type EventLocation = EventLocationInput;

export type Event = {
  id: number;
  account_id: number;
  organizer_id: number;
  title: string;
  slug: string;
  status: EventStatus;
  start_date: string;
  end_date: string;
  location_details: EventLocation | null;
  created_at: string;
  updated_at: string;
};

async function request<T>(
  path: string,
  options: { method?: "GET" | "POST" | "PATCH" | "DELETE"; body?: unknown } = {},
): Promise<T> {
  const res = await fetch(path, {
    method: options.method ?? "GET",
    headers: { "Content-Type": "application/json" },
    body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
  });

  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    throw new ApiError(data?.message ?? "Something went wrong.", res.status, data?.errors);
  }

  return data as T;
}

export function listEvents(organizerId: number) {
  return request<{ events: Event[] }>(`/api/events?organizer_id=${organizerId}`);
}

export function getEvent(id: number) {
  return request<{ event: Event }>(`/api/events/${id}`);
}

export function createEvent(input: {
  organizer_id: number;
  title: string;
  start_date: string;
  end_date: string;
  location?: EventLocationInput;
}) {
  return request<{ event: Event }>("/api/events", { method: "POST", body: input });
}

export function updateEvent(
  id: number,
  input: {
    title?: string;
    start_date?: string;
    end_date?: string;
    location?: EventLocationInput;
  },
) {
  return request<{ event: Event }>(`/api/events/${id}`, { method: "PATCH", body: input });
}

export function updateEventStatus(id: number, status: EventStatus) {
  return request<{ event: Event }>(`/api/events/${id}/status`, { method: "PATCH", body: { status } });
}
