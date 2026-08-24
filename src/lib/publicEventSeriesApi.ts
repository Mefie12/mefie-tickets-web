/**
 * Types matching the backend's PublicEventSeriesResource — see
 * docs/13_recurring_events_prd.md §7.2/§7.3. `selected_occurrence` is the
 * exact same shape as PublicEvent (PublicEventResource) since it's the
 * one thing on this page a buyer actually transacts against.
 */
import type { EventLocation, PublicEvent, PublicEventCategoryItem, PublicOrganization } from "@/lib/publicEventApi";

export type PublicEventSeriesOccurrenceAvailability = "available" | "sold_out" | "cancelled";

export type PublicEventSeriesOccurrenceSummary = {
  public_occurrence_id: string;
  /** `YYYY-MM-DD` in the series' own timezone — see occurrence_date on the backend. */
  date: string | null;
  start_date: string | null;
  end_date: string | null;
  is_selected: boolean;
  is_past: boolean;
  availability: PublicEventSeriesOccurrenceAvailability;
};

export type PublicEventSeries = {
  slug: string;
  title: string;
  description: string;
  category: PublicEventCategoryItem | null;
  subcategory: PublicEventCategoryItem | null;
  timezone: string;
  currency_code: string;
  cover_image_url: string | null;
  gallery: PublicEvent["gallery"];
  location: EventLocation | null;
  organization: PublicOrganization;
  occurrences: PublicEventSeriesOccurrenceSummary[];
  selected_occurrence: PublicEvent;
};
