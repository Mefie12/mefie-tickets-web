/**
 * Shared server-side fetchers for the public event/series routes —
 * previously duplicated locally in each page.tsx. Used by the event
 * detail pages and their sibling /checkout routes alike.
 */
import { backendRequest } from "@/lib/backend";
import type { PublicEvent } from "@/lib/publicEventApi";
import type { PublicEventSeries } from "@/lib/publicEventSeriesApi";

export function getPublicEvent(organizationSlug: string, eventSlug: string) {
  return backendRequest<{ event: PublicEvent }>(
    `/api/public/organizations/${encodeURIComponent(organizationSlug)}/events/${encodeURIComponent(eventSlug)}`,
  );
}

/**
 * §7.2 — a series' public URL is the same flat shape as a standalone
 * event's (`/{organizationSlug}/{slug}`), so callers try an event
 * lookup first and fall back to a series lookup on 404 rather than
 * needing a second top-level route. generateUniqueSlug() on both the
 * event and series sides (backend) guarantees the two never collide
 * under one organization.
 */
export function getPublicSeries(organizationSlug: string, seriesSlug: string) {
  return backendRequest<{ event_series: PublicEventSeries }>(
    `/api/public/organizations/${encodeURIComponent(organizationSlug)}/series/${encodeURIComponent(seriesSlug)}`,
  );
}

/** A specific series occurrence, independently bookmarkable and shareable — see PublicEventSeriesOccurrencePage. */
export function getPublicSeriesOccurrence(organizationSlug: string, seriesSlug: string, publicOccurrenceId: string) {
  return backendRequest<{ event_series: PublicEventSeries }>(
    `/api/public/organizations/${encodeURIComponent(organizationSlug)}/series/${encodeURIComponent(seriesSlug)}/occurrences/${encodeURIComponent(publicOccurrenceId)}`,
  );
}
