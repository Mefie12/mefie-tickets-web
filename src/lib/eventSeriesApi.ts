import { ApiError } from "@/lib/authApi";
import type { EventLocation, EventLocationInput, EventTaxonomyItem } from "@/lib/eventApi";

export type EventSeriesStatus = "DRAFT" | "LIVE" | "ARCHIVED";
export type RecurrenceFrequency = "DAILY" | "WEEKLY" | "MONTHLY";
export type MonthlyRecurrenceType = "MONTH_DAY" | "ORDINAL_WEEKDAY";

/** Matches App\Domain\EventSeries\DataObjects\RecurrenceRuleData — see docs/13_recurring_events_prd.md §2. */
export type RecurrenceRuleInput = {
  frequency: RecurrenceFrequency;
  interval: number;
  by_weekday?: number[]; // ISO-8601 weekday ints, 1=Mon..7=Sun
  monthly_type?: MonthlyRecurrenceType;
  by_month_day?: number;
  by_set_position?: number; // -1 = "last", 1-4 = "1st".."4th"
  start_time: string; // HH:mm
  end_time: string;
  timezone: string;
  until?: string; // YYYY-MM-DD
  occurrence_count?: number;
};

export type RecurrenceOccurrencePreview = { sequence_number: number; date: string; dst_shifted: boolean };

export type EventSeriesOccurrence = {
  id: number;
  status: "DRAFT" | "LIVE" | "ARCHIVED";
  sequence_number: number;
  occurrence_date: string;
  occurrence_state: "SCHEDULED" | "CANCELLED" | null;
  public_occurrence_id: string | null;
  start_date: string | null;
  end_date: string | null;
};

export type EventSeriesGenerationStatus = "PENDING" | "PROCESSING" | "COMPLETED" | "FAILED";

export type EventSeries = {
  id: number;
  organization_id: string;
  template_event_id: number;
  slug: string;
  status: EventSeriesStatus;
  title: string;
  description: string;
  event_category_id: number | null;
  event_subcategory_id: number | null;
  category: EventTaxonomyItem | null;
  subcategory: EventTaxonomyItem | null;
  timezone: string;
  currency_code: string;
  location_details: EventLocation | null;
  frequency: RecurrenceFrequency;
  interval: number;
  by_weekday: number[] | null;
  monthly_type: MonthlyRecurrenceType | null;
  by_month_day: number | null;
  by_set_position: number | null;
  starts_on: string;
  start_time: string;
  end_time: string;
  until: string | null;
  occurrence_count: number | null;
  occurrences?: EventSeriesOccurrence[];
  /** §4.3 — set while publish()/extend() is generating occurrences in the background; null before the first publish. */
  generation_status?: EventSeriesGenerationStatus | null;
  /** §9 — surfaced by the list/show endpoints so the organizer UI can nudge a renewal. */
  needs_renewal?: boolean;
};

export type AffectedOrderItem = {
  ticket_display_name: string;
  quantity: number;
  item_total: string;
  currency_code: string;
};

/** §6.1/§6.3 — a raw Order dump (organizer-only, not a sanitized public resource) for the read-only affected-orders view. */
export type AffectedOrder = {
  id: number;
  short_id: string;
  status: string;
  first_name: string;
  last_name: string;
  email: string;
  total_amount: string;
  currency: string;
  items: AffectedOrderItem[];
};

async function request<T>(
  path: string,
  options: { method?: "GET" | "POST" | "PATCH"; body?: unknown } = {},
): Promise<T> {
  const res = await fetch(path, {
    method: options.method ?? "GET",
    headers: { "Content-Type": "application/json" },
    body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(data?.message ?? "Something went wrong.", res.status, data?.errors, data?.code);
  return data as T;
}

export function listEventSeries() {
  return request<{ event_series: EventSeries[] }>("/api/event-series");
}

export function getEventSeries(id: number) {
  return request<{ event_series: EventSeries }>(`/api/event-series/${id}`);
}

export function createEventSeries(input: {
  title: string;
  description: string;
  starts_on: string;
  recurrence: RecurrenceRuleInput;
  event_category_id?: number | null;
  event_subcategory_id?: number | null;
  location?: EventLocationInput;
}) {
  return request<{ event_series: EventSeries }>("/api/event-series", { method: "POST", body: input });
}

// Note: timezone is set via recurrence.timezone, not a separate field —
// event_series has one timezone column, and RecurrenceRuleData.timezone
// is its single source of truth (see CreateEventSeriesData's docblock
// on the API for why a duplicate field was a real bug caught live).
export function updateEventSeries(
  id: number,
  input: Partial<{
    title: string;
    description: string;
    starts_on: string;
    recurrence: RecurrenceRuleInput;
    event_category_id: number | null;
    event_subcategory_id: number | null;
    location: EventLocationInput;
  }>,
) {
  return request<{ event_series: EventSeries }>(`/api/event-series/${id}`, { method: "PATCH", body: input });
}

export function publishEventSeries(id: number) {
  return request<{ event_series: EventSeries }>(`/api/event-series/${id}/publish`, { method: "POST" });
}

/** §9 — extends a LIVE series with a fresh batch of occurrences from the current template; backgrounded like publish(). */
export function extendEventSeries(id: number) {
  return request<{ event_series: EventSeries }>(`/api/event-series/${id}/extend`, { method: "POST" });
}

export function listEventSeriesOccurrences(id: number) {
  return request<{ occurrences: EventSeriesOccurrence[] }>(`/api/event-series/${id}/occurrences`);
}

export function previewRecurrence(input: { starts_on: string; recurrence: RecurrenceRuleInput }) {
  return request<{ occurrences: RecurrenceOccurrencePreview[] }>("/api/event-series/recurrence/preview", {
    method: "POST",
    body: input,
  });
}

/** §6.1 — stops sales for one date only; orders/tickets/history are untouched. */
export function cancelOccurrence(seriesId: number, occurrenceId: number, reason?: string) {
  return request<{ occurrence: EventSeriesOccurrence }>(
    `/api/event-series/${seriesId}/occurrences/${occurrenceId}/cancel`,
    { method: "POST", body: reason ? { reason } : {} },
  );
}

/** §6.2 — existing orders/tickets stay valid for the same occurrence at its new date/time. */
export function rescheduleOccurrence(
  seriesId: number,
  occurrenceId: number,
  input: { date: string; start_time?: string; end_time?: string },
) {
  return request<{ occurrence: EventSeriesOccurrence }>(
    `/api/event-series/${seriesId}/occurrences/${occurrenceId}/reschedule`,
    { method: "POST", body: input },
  );
}

/** §6.1/§6.3 — read-only for v1; refunding happens manually outside the platform. */
export function listAffectedOrders(seriesId: number, occurrenceId: number) {
  return request<{ orders: AffectedOrder[] }>(`/api/event-series/${seriesId}/occurrences/${occurrenceId}/affected-orders`);
}

/** §4.5 — hides the series from discovery and freezes the template; existing tickets/check-in are untouched. */
export function archiveEventSeries(id: number) {
  return request<{ event_series: EventSeries }>(`/api/event-series/${id}/archive`, { method: "POST" });
}

/** §4.5 — the only restore path; publishing/extending again requires a fresh pass through the normal checks. */
export function restoreEventSeries(id: number) {
  return request<{ event_series: EventSeries }>(`/api/event-series/${id}/restore`, { method: "POST" });
}

export type RecurrencePatternChangeInput = { recurrence: RecurrenceRuleInput; cutover_date: string };
export type RecurrencePatternChangeEntry = { sequence_number: number; date: string };
export type RecurrencePatternChangeDiff = {
  kept: RecurrencePatternChangeEntry[];
  removed: RecurrencePatternChangeEntry[];
  blocked: RecurrencePatternChangeEntry[];
  added: RecurrencePatternChangeEntry[];
};

/** §5.6 — a read-only diff of what changing the pattern from this cutover would do; nothing is persisted. */
export function previewPatternChange(seriesId: number, input: RecurrencePatternChangeInput) {
  return request<{ diff: RecurrencePatternChangeDiff }>(`/api/event-series/${seriesId}/recurrence-changes/preview`, {
    method: "POST",
    body: input,
  });
}

/** §5.6 — applies the change; backgrounded (§4.3), so the returned series may still show generation_status PENDING/PROCESSING. */
export function changeRecurrencePattern(seriesId: number, input: RecurrencePatternChangeInput) {
  return request<{ event_series: EventSeries }>(`/api/event-series/${seriesId}/recurrence-changes`, {
    method: "POST",
    body: input,
  });
}
