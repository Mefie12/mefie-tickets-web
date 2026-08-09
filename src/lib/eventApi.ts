import { ApiError } from "@/lib/authApi";

export type EventStatus = "DRAFT" | "LIVE" | "ARCHIVED";

export type LocationType = "IN_PERSON" | "ONLINE" | "HYBRID";

/** Matches App\Domain\Events\DataObjects\EventLocationData exactly. */
export type EventLocationInput = {
  location_type: LocationType;
  venue_name?: string | null;
  address_line1?: string | null;
  address_line2?: string | null;
  city?: string | null;
  state?: string | null;
  postal_code?: string | null;
  country?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  online_url?: string | null;
  platform_name?: string | null;
  access_instructions?: string | null;
};

export type EventLocation = EventLocationInput;

export type GalleryImage = {
  id: number;
  url: string;
  thumbnail_url: string;
  alt_text: string | null;
  sort_order: number | null;
};

export type EventTaxonomyItem = { id: number; name: string; slug: string };
export type EventCategory = EventTaxonomyItem & { subcategories: EventTaxonomyItem[] };
export type EventTaxonomies = {
  categories: EventCategory[];
  audiences: EventTaxonomyItem[];
  attributes: EventTaxonomyItem[];
};

export type Event = {
  id: number;
  organization_id: string;
  title: string;
  description: string;
  event_category_id: number;
  event_subcategory_id: number | null;
  category: EventTaxonomyItem;
  subcategory: EventTaxonomyItem | null;
  audiences: EventTaxonomyItem[];
  attributes: EventTaxonomyItem[];
  slug: string;
  status: EventStatus;
  /** UTC instants. Render them via src/lib/eventDateTime.ts in `timezone`, never in the viewer's or the server's zone. */
  start_date: string | null;
  end_date: string | null;
  /** IANA identifier, e.g. "Europe/London". */
  timezone: string;
  /** ISO 4217 code, e.g. "GBP". Never a symbol — see CurrencySelector. */
  currency_code: string;
  location_details: EventLocation | null;
  cover_image_url: string | null;
  gallery: GalleryImage[];
  created_at: string;
  updated_at: string;
};

/**
 * Note the asymmetry with `Event` above, and it's deliberate: responses
 * carry UTC *instants*, requests carry *wall-clock parts* plus the zone.
 * The server owns the conversion between them — see WallClock.php.
 */
export type EventScheduleInput = {
  start_date: string; // YYYY-MM-DD
  start_time: string; // HH:mm
  end_date: string;
  end_time: string;
  timezone: string;
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
    throw new ApiError(data?.message ?? "Something went wrong.", res.status, data?.errors, data?.code);
  }

  return data as T;
}

export function listEvents() {
  return request<{ events: Event[] }>("/api/events");
}

export function getEvent(id: number) {
  return request<{ event: Event }>(`/api/events/${id}`);
}

export function getEventTaxonomies() {
  return request<EventTaxonomies>("/api/event-taxonomies");
}

export function createEvent(
  input: Partial<EventScheduleInput> & {
    title: string;
    description: string;
    event_category_id: number;
    event_subcategory_id?: number | null;
    audience_ids?: number[];
    attribute_ids?: number[];
    currency_code?: string;
    location?: EventLocationInput;
  },
) {
  return request<{ event: Event }>("/api/events", { method: "POST", body: input });
}

export function updateEvent(
  id: number,
  input: Partial<EventScheduleInput> & {
    title?: string;
    description?: string;
    event_category_id?: number;
    event_subcategory_id?: number | null;
    audience_ids?: number[];
    attribute_ids?: number[];
    currency_code?: string;
    location?: EventLocationInput;
  },
) {
  return request<{ event: Event }>(`/api/events/${id}`, { method: "PATCH", body: input });
}

export function updateEventStatus(id: number, status: EventStatus) {
  return request<{ event: Event }>(`/api/events/${id}/status`, { method: "PATCH", body: { status } });
}
