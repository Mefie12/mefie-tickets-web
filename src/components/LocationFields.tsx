"use client";

import { Group, SegmentedControl, Textarea, TextInput } from "@mantine/core";
import { CountrySelector } from "@/components/CountrySelector";
import { LocationAutocomplete } from "@/components/LocationAutocomplete";
import { mapboxTokenConfigured, type MapboxSuggestion } from "@/lib/mapbox";
import type { LocationType } from "@/lib/eventApi";

export const LOCATION_TYPE_OPTIONS: { label: string; value: LocationType }[] = [
  { label: "In-person", value: "IN_PERSON" },
  { label: "Online", value: "ONLINE" },
  { label: "Hybrid", value: "HYBRID" },
];

export function needsVenue(locationType: LocationType) {
  return locationType === "IN_PERSON" || locationType === "HYBRID";
}
export function needsOnline(locationType: LocationType) {
  return locationType === "ONLINE" || locationType === "HYBRID";
}

/** Matches the initialValues shape both callers build their form/state from — controlled inputs need non-null strings, unlike EventLocationInput's nullable fields. */
export type LocationFieldValues = {
  location_type: LocationType;
  venue_name: string;
  address_line1: string;
  address_line2: string;
  city: string;
  state: string;
  postal_code: string;
  country: string;
  latitude: number | null;
  longitude: number | null;
  online_url: string;
  platform_name: string;
  access_instructions: string;
};

/**
 * Presentational only — owns no form state, no mutation, no save button.
 * Callers keep their own useForm/useState + save endpoint (Event vs
 * EventSeries PATCH different resources) and delegate field rendering here.
 */
export function LocationFields({
  values,
  onChange,
  errors,
  disabled,
  onAddressSelect,
}: {
  values: LocationFieldValues;
  onChange: <K extends keyof LocationFieldValues>(field: K, value: LocationFieldValues[K]) => void;
  errors: Partial<Record<keyof LocationFieldValues, React.ReactNode>>;
  disabled?: boolean;
  onAddressSelect: (suggestion: MapboxSuggestion) => void;
}) {
  const hasMapbox = mapboxTokenConfigured();
  const showVenue = needsVenue(values.location_type);
  const showOnline = needsOnline(values.location_type);

  return (
    <>
      <SegmentedControl
        data={LOCATION_TYPE_OPTIONS}
        value={values.location_type}
        onChange={(v) => onChange("location_type", v as LocationType)}
      />

      {showVenue && (
        <>
          <CountrySelector
            label="Country"
            required
            value={values.country}
            onChange={(v) => onChange("country", v ?? "")}
            error={errors.country}
          />
          <TextInput
            label="Venue name"
            required
            value={values.venue_name}
            onChange={(e) => onChange("venue_name", e.currentTarget.value)}
            error={errors.venue_name}
          />
          {hasMapbox ? (
            <LocationAutocomplete
              label="Address"
              required
              error={errors.address_line1}
              disabled={disabled}
              value={values.address_line1}
              onChange={(v) => onChange("address_line1", v)}
              onSelect={onAddressSelect}
              countryIso2={values.country || null}
            />
          ) : (
            <TextInput
              label="Address"
              required
              value={values.address_line1}
              onChange={(e) => onChange("address_line1", e.currentTarget.value)}
              error={errors.address_line1}
            />
          )}
          <Group grow>
            <TextInput
              label="City"
              required
              value={values.city}
              onChange={(e) => onChange("city", e.currentTarget.value)}
              error={errors.city}
            />
            <TextInput
              label="State / Region"
              value={values.state}
              onChange={(e) => onChange("state", e.currentTarget.value)}
            />
          </Group>
          <TextInput
            label="Postal code"
            value={values.postal_code}
            onChange={(e) => onChange("postal_code", e.currentTarget.value)}
          />
          <TextInput
            label="Address line 2"
            value={values.address_line2}
            onChange={(e) => onChange("address_line2", e.currentTarget.value)}
          />
        </>
      )}

      {showOnline && (
        <>
          <TextInput
            label="Join link / URL"
            placeholder="https://zoom.us/j/..."
            value={values.online_url}
            onChange={(e) => onChange("online_url", e.currentTarget.value)}
            error={errors.online_url}
          />
          <TextInput
            label="Platform"
            placeholder="Zoom"
            value={values.platform_name}
            onChange={(e) => onChange("platform_name", e.currentTarget.value)}
          />
          <Textarea
            label="Access instructions"
            placeholder="Meeting ID, passcode, or other notes for attendees"
            autosize
            minRows={2}
            value={values.access_instructions}
            onChange={(e) => onChange("access_instructions", e.currentTarget.value)}
          />
        </>
      )}
    </>
  );
}
