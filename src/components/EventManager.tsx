"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useForm } from "@mantine/form";
import {
  Alert,
  Badge,
  Button,
  Card,
  Group,
  MultiSelect,
  SegmentedControl,
  Select,
  Stack,
  Tabs,
  Text,
  Textarea,
  TextInput,
  Title,
} from "@mantine/core";
import { IconArrowLeft, IconQrcode, IconReceipt } from "@tabler/icons-react";
import { notifications } from "@mantine/notifications";
import { TimezoneSelector } from "@/components/TimezoneSelector";
import { RichTextDescription } from "@/components/RichTextDescription";
import { CountrySelector } from "@/components/CountrySelector";
import { COUNTRIES_BY_CODE } from "@/lib/countries";
import { CurrencySelector } from "@/components/CurrencySelector";
import { LocationAutocomplete } from "@/components/LocationAutocomplete";
import { ApiError } from "@/lib/authApi";
import { redirectOnAuthError } from "@/lib/authErrorRedirect";
import { utcIsoToZonedParts } from "@/lib/eventDateTime";
import { browserTimezone } from "@/lib/timezones";
import { CURRENCIES_BY_CODE, suggestCurrencyForCountryCode } from "@/lib/currencies";
import { mapboxTokenConfigured, type MapboxSuggestion } from "@/lib/mapbox";
import {
  getEventTaxonomies,
  type Event,
  type EventCategory,
  type EventLocationInput,
  type EventStatus,
  type EventTaxonomies,
  type EventTaxonomyItem,
  type LocationType,
  updateEvent,
  updateEventStatus,
} from "@/lib/eventApi";
import type { Product } from "@/lib/productApi";
import type { Question } from "@/lib/questionApi";
import { ProductsEditor } from "@/components/ProductsEditor";
import { QuestionsEditor } from "@/components/QuestionsEditor";
import { EventMediaEditor } from "@/components/EventMediaEditor";
import { EventTermsEditor } from "@/components/EventTermsEditor";

const VALID_TABS = ["details", "date-time", "location", "media", "tickets", "questions", "terms"];

const STATUS_COLOR: Record<EventStatus, string> = {
  DRAFT: "gray",
  LIVE: "teal",
  ARCHIVED: "dark",
};

export function EventManager({
  initialEvent,
  initialProducts,
  initialQuestions,
}: {
  initialEvent: Event;
  initialProducts: Product[];
  initialQuestions: Question[];
}) {
  const [event, setEvent] = useState(initialEvent);
  const archived = event.status === "ARCHIVED";
  const router = useRouter();
  const searchParams = useSearchParams();

  const statusMutation = useMutation({
    mutationFn: (status: EventStatus) => updateEventStatus(event.id, status),
    onSuccess: (data: { event: Event }) => {
      setEvent(data.event);
      notifications.show({ color: "teal", message: `Event is now ${data.event.status}.` });
    },
    onError: (error: Error) => {
      if (redirectOnAuthError(error, router)) return;
      notifications.show({
        color: "red",
        message: error instanceof ApiError ? (error.fieldError("status") ?? error.message) : "Something went wrong.",
      });
    },
  });

  return (
    <Stack gap="xl">
      <Stack gap="xs">
        <Button
          component={Link}
          href="/events"
          variant="subtle"
          size="compact-sm"
          leftSection={<IconArrowLeft size={14} />}
          style={{ alignSelf: "flex-start" }}
        >
          Back to events
        </Button>
        <Group justify="space-between">
          <Title order={2} fz={28}>
            {event.title}
          </Title>
          <Group gap="sm">
            <Button
              component={Link}
              href={`/events/${event.id}/orders`}
              variant="light"
              size="compact-sm"
              leftSection={<IconReceipt size={14} />}
            >
              Orders
            </Button>
            <Button
              component={Link}
              href={`/events/${event.id}/check-in-lists`}
              variant="light"
              size="compact-sm"
              leftSection={<IconQrcode size={14} />}
            >
              Check-In Lists
            </Button>
            <Badge color={STATUS_COLOR[event.status]} variant="light">
              {event.status}
            </Badge>
          </Group>
        </Group>
        {archived ? (
          <Text size="sm" c="dimmed">
            This event is archived. Its status cannot be changed.
          </Text>
        ) : (
          <Group gap="xs">
            <Text size="sm" c="dimmed">
              Status:
            </Text>
            <SegmentedControl
              size="xs"
              data={["DRAFT", "LIVE", "ARCHIVED"]}
              value={event.status}
              onChange={(value) => statusMutation.mutate(value as EventStatus)}
              disabled={statusMutation.isPending}
            />
          </Group>
        )}
      </Stack>

      <Tabs defaultValue={VALID_TABS.includes(searchParams.get("tab") ?? "") ? searchParams.get("tab")! : "details"}>
        <Tabs.List>
          <Tabs.Tab value="details">Details</Tabs.Tab>
          <Tabs.Tab value="date-time">Date &amp; Time</Tabs.Tab>
          <Tabs.Tab value="location">Location &amp; Access</Tabs.Tab>
          <Tabs.Tab value="media">Media</Tabs.Tab>
          <Tabs.Tab value="tickets">Tickets &amp; Pricing</Tabs.Tab>
          <Tabs.Tab value="questions">Questions</Tabs.Tab>
          <Tabs.Tab value="terms">Terms &amp; Conditions</Tabs.Tab>
        </Tabs.List>

        <Tabs.Panel value="details" pt="lg">
          <EventDetailsForm event={event} onUpdated={setEvent} disabled={archived} />
        </Tabs.Panel>
        <Tabs.Panel value="date-time" pt="lg">
          <EventDateTimeForm event={event} onUpdated={setEvent} disabled={archived} />
        </Tabs.Panel>
        <Tabs.Panel value="location" pt="lg">
          <EventLocationForm event={event} onUpdated={setEvent} disabled={archived} />
        </Tabs.Panel>
        <Tabs.Panel value="media" pt="lg">
          <EventMediaEditor eventId={event.id} initialEvent={event} disabled={archived} />
        </Tabs.Panel>
        <Tabs.Panel value="tickets" pt="lg">
          <ProductsEditor
            eventId={event.id}
            eventTimezone={event.timezone}
            eventCurrency={event.currency_code}
            initialProducts={initialProducts}
            disabled={archived}
          />
        </Tabs.Panel>
        <Tabs.Panel value="questions" pt="lg">
          <QuestionsEditor eventId={event.id} initialQuestions={initialQuestions} disabled={archived} />
        </Tabs.Panel>
        <Tabs.Panel value="terms" pt="lg">
          <EventTermsEditor eventId={event.id} disabled={archived} />
        </Tabs.Panel>
      </Tabs>
    </Stack>
  );
}

function EventDetailsForm({
  event,
  onUpdated,
  disabled,
}: {
  event: Event;
  onUpdated: (event: Event) => void;
  disabled: boolean;
}) {
  const router = useRouter();
  const taxonomies = useQuery<EventTaxonomies>({ queryKey: ["event-taxonomies"], queryFn: getEventTaxonomies });

  const form = useForm({
    initialValues: {
      title: event.title,
      description: event.description ?? "",
      event_category_id: event.event_category_id ? String(event.event_category_id) : "",
      event_subcategory_id: event.event_subcategory_id ? String(event.event_subcategory_id) : "",
      audience_ids: event.audiences.map((item) => String(item.id)),
      attribute_ids: event.attributes.map((item) => String(item.id)),
      currency_code: event.currency_code,
    },
    validate: {
      title: (v) => (v.trim().length === 0 ? "Title is required" : null),
      description: (v) => (v.replace(/<[^>]*>/g, "").trim().length === 0 ? "Description is required" : null),
      event_category_id: (v) => (!v ? "Category is required" : null),
      currency_code: (v) => (!v ? "Currency is required" : null),
    },
  });
  const category = taxonomies.data?.categories.find((item: EventCategory) => String(item.id) === form.values.event_category_id);

  // Suggested from the event's already-saved location (not live Location-tab
  // typing — that's a separate form/tab). Dismissible, never auto-applied.
  const suggestedCurrency = suggestCurrencyForCountryCode(event.location_details?.country);
  const [dismissedSuggestion, setDismissedSuggestion] = useState(false);
  useEffect(() => setDismissedSuggestion(false), [suggestedCurrency]);
  const showCurrencySuggestion =
    !!suggestedCurrency && suggestedCurrency !== form.values.currency_code && !dismissedSuggestion;
  const suggestedCountryName = event.location_details?.country
    ? (COUNTRIES_BY_CODE.get(event.location_details.country)?.name ?? event.location_details.country)
    : "";

  const updateMutation = useMutation({
    mutationFn: (values: typeof form.values) => updateEvent(event.id, {
      title: values.title,
      description: values.description,
      event_category_id: Number(values.event_category_id),
      event_subcategory_id: values.event_subcategory_id ? Number(values.event_subcategory_id) : null,
      audience_ids: values.audience_ids.map(Number),
      attribute_ids: values.attribute_ids.map(Number),
      currency_code: values.currency_code,
    }),
    onSuccess: (data: { event: Event }) => { onUpdated(data.event); notifications.show({ color: "teal", message: "Event details updated." }); },
    onError: (error: Error) => handleFormError(error, form.setErrors, router),
  });

  return (
    <Card withBorder radius="lg" p="xl">
      <form onSubmit={form.onSubmit((values) => updateMutation.mutate(values))}>
        <fieldset disabled={disabled} style={{ border: 0, padding: 0, margin: 0 }}>
          <Stack>
            <TextInput required label="Event title" {...form.getInputProps("title")} />
            <RichTextDescription disabled={disabled} value={form.values.description} onChange={(value) => form.setFieldValue("description", value)} error={form.errors.description} />
            <CurrencySelector
              label="Currency"
              required
              description="Every price on this event — tickets, tiers, checkout — is quoted in this currency."
              {...form.getInputProps("currency_code")}
            />
            {showCurrencySuggestion && (
              <Alert color="blue" variant="light">
                This event is in {suggestedCountryName} — switch currency to{" "}
                {CURRENCIES_BY_CODE.get(suggestedCurrency!)?.name ?? suggestedCurrency}?{" "}
                <Button
                  variant="subtle"
                  size="compact-xs"
                  onClick={() => form.setFieldValue("currency_code", suggestedCurrency!)}
                >
                  Switch to {suggestedCurrency}
                </Button>
                <Button variant="subtle" size="compact-xs" color="gray" onClick={() => setDismissedSuggestion(true)}>
                  Dismiss
                </Button>
              </Alert>
            )}
            <Select required searchable allowDeselect={false} label="Category"
              data={(taxonomies.data?.categories ?? []).map((item: EventCategory) => ({ value: String(item.id), label: item.name }))}
              {...form.getInputProps("event_category_id")}
              onChange={(value) => { form.setFieldValue("event_category_id", value ?? ""); form.setFieldValue("event_subcategory_id", ""); }} />
            <Select searchable clearable disabled={disabled || !category} label="Subcategory (optional)"
              data={(category?.subcategories ?? []).map((item: EventTaxonomyItem) => ({ value: String(item.id), label: item.name }))}
              {...form.getInputProps("event_subcategory_id")} />
            <MultiSelect searchable clearable label="Audience (optional)" description="Helps attendees discover events intended for them."
              data={(taxonomies.data?.audiences ?? []).map((item: EventTaxonomyItem) => ({ value: String(item.id), label: item.name }))} {...form.getInputProps("audience_ids")} />
            <MultiSelect searchable clearable label="Accessibility & event attributes (optional)" description="Highlight accessibility, facilities, format, and special access."
              data={(taxonomies.data?.attributes ?? []).map((item: EventTaxonomyItem) => ({ value: String(item.id), label: item.name }))} {...form.getInputProps("attribute_ids")} />
            {!disabled ? <Button type="submit" loading={updateMutation.isPending} style={{ alignSelf: "flex-start" }}>Save details</Button>
              : <Text size="xs" c="dimmed">This event is archived and can no longer be edited.</Text>}
          </Stack>
        </fieldset>
      </form>
    </Card>
  );
}

function EventDateTimeForm({ event, onUpdated, disabled }: { event: Event; onUpdated: (event: Event) => void; disabled: boolean }) {
  const router = useRouter();
  const start = event.start_date ? utcIsoToZonedParts(event.start_date, event.timezone) : { date: "", time: "" };
  const end = event.end_date ? utcIsoToZonedParts(event.end_date, event.timezone) : { date: "", time: "" };
  const form = useForm({
    initialValues: {
      start_date: start.date,
      start_time: start.time,
      end_date: end.date,
      end_time: end.time,
      // "" (not event.timezone) when never scheduled, so the mount effect
      // below can fill in the browser's zone without changing an
      // already-rendered value — flipping a rendered "UTC" to a guessed
      // zone post-mount is a real SSR/CSR text mismatch, not just cosmetic:
      // React logs it as a hydration error, and worse, a different admin
      // opening the same draft would silently get a different default.
      timezone: event.start_date ? event.timezone : "",
    },
    validate: {
      start_date: (v) => (!v ? "Start date is required" : null),
      start_time: (v) => (!v ? "Start time is required" : null),
      end_date: (v) => (!v ? "End date is required" : null),
      timezone: (v) => (!v ? "Timezone is required" : null),
      // Safe as a string comparison: both ends share the one timezone.
      end_time: (v, values) =>
        !v ? "End time is required" : `${values.end_date} ${v}` <= `${values.start_date} ${values.start_time}` ? "End must be after start" : null,
    },
  });
  useEffect(() => {
    if (!event.start_date) form.setFieldValue("timezone", browserTimezone());
    // Initial suggestion only; do not overwrite the organizer's selection.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const updateMutation = useMutation({
    mutationFn: (values: typeof form.values) =>
      updateEvent(event.id, {
        start_date: values.start_date,
        start_time: values.start_time,
        end_date: values.end_date,
        end_time: values.end_time,
        timezone: values.timezone,
      }),
    onSuccess: (data: { event: Event }) => {
      onUpdated(data.event);
      notifications.show({ color: "teal", message: "Date and time updated." });
    },
    onError: (error: Error) => {
      if (redirectOnAuthError(error, router)) return;
      if (error instanceof ApiError && error.errors) {
        form.setErrors(
          Object.fromEntries(Object.entries(error.errors).map(([field, messages]) => [field, messages[0]])),
        );
      } else {
        notifications.show({ color: "red", message: error.message });
      }
    },
  });

  return (
    <Card withBorder radius="lg" p="xl">
      <form onSubmit={form.onSubmit((values) => updateMutation.mutate(values))}>
        <fieldset disabled={disabled} style={{ border: 0, padding: 0, margin: 0 }}>
          <Stack>
            <Group grow align="flex-start">
              <TextInput type="date" label="Start date" {...form.getInputProps("start_date")} />
              <TextInput type="time" label="Start time" {...form.getInputProps("start_time")} />
            </Group>
            <Group grow align="flex-start">
              <TextInput type="date" label="End date" {...form.getInputProps("end_date")} />
              <TextInput type="time" label="End time" {...form.getInputProps("end_time")} />
            </Group>
            <TimezoneSelector
              label="Event timezone"
              description="All times above are in this timezone, and that's how buyers will see them."
              {...form.getInputProps("timezone")}
            />
            {form.values.timezone !== event.timezone && (
              <Alert color="yellow" variant="light">
                Changing the timezone moves this event to a different actual moment. Any ticket sale windows you&apos;ve
                already set keep their original moments — re-check them after saving.
              </Alert>
            )}

            {!disabled ? (
              <Button type="submit" loading={updateMutation.isPending} style={{ alignSelf: "flex-start" }}>
                Save changes
              </Button>
            ) : (
              <Text size="xs" c="dimmed">
                This event is archived and can no longer be edited.
              </Text>
            )}
          </Stack>
        </fieldset>
      </form>
    </Card>
  );
}

const LOCATION_TYPE_OPTIONS: { label: string; value: LocationType }[] = [
  { label: "In-person", value: "IN_PERSON" },
  { label: "Online", value: "ONLINE" },
  { label: "Hybrid", value: "HYBRID" },
];

function needsVenue(locationType: LocationType) {
  return locationType === "IN_PERSON" || locationType === "HYBRID";
}
function needsOnline(locationType: LocationType) {
  return locationType === "ONLINE" || locationType === "HYBRID";
}

function EventLocationForm({
  event,
  onUpdated,
  disabled,
}: {
  event: Event;
  onUpdated: (event: Event) => void;
  disabled: boolean;
}) {
  const router = useRouter();
  const loc = event.location_details;
  const hasMapbox = mapboxTokenConfigured();

  const form = useForm({
    initialValues: {
      location_type: (loc?.location_type ?? "IN_PERSON") as LocationType,
      venue_name: loc?.venue_name ?? "",
      address_line1: loc?.address_line1 ?? "",
      address_line2: loc?.address_line2 ?? "",
      city: loc?.city ?? "",
      state: loc?.state ?? "",
      postal_code: loc?.postal_code ?? "",
      country: loc?.country ?? "",
      latitude: loc?.latitude ?? null,
      longitude: loc?.longitude ?? null,
      online_url: loc?.online_url ?? "",
      platform_name: loc?.platform_name ?? "",
      access_instructions: loc?.access_instructions ?? "",
    },
    validate: {
      country: (v, values) => (needsVenue(values.location_type) && !v ? "Country is required" : null),
      venue_name: (v, values) => (needsVenue(values.location_type) && !v.trim() ? "Venue name is required" : null),
      address_line1: (v, values) => (needsVenue(values.location_type) && !v.trim() ? "Address is required" : null),
      city: (v, values) => (needsVenue(values.location_type) && !v.trim() ? "City is required" : null),
      online_url: (v, values) => (needsOnline(values.location_type) && !v.trim() ? "A join link is required" : null),
    },
  });

  const updateMutation = useMutation({
    mutationFn: (values: typeof form.values) =>
      updateEvent(event.id, { location: values as EventLocationInput }),
    onSuccess: (data: { event: Event }) => {
      onUpdated(data.event);
      notifications.show({ color: "teal", message: "Location updated." });
    },
    onError: (error: Error) => {
      if (redirectOnAuthError(error, router)) return;
      if (error instanceof ApiError && error.errors) {
        // Backend errors for this DTO come back dotted ("location.country")
        // since `location` is nested server-side, but this form's own
        // fields are flat — strip the prefix so setErrors attaches
        // correctly instead of silently missing every field.
        form.setErrors(
          Object.fromEntries(
            Object.entries(error.errors).map(([field, messages]) => [field.replace(/^location\./, ""), messages[0]]),
          ),
        );
      } else {
        notifications.show({ color: "red", message: error.message });
      }
    },
  });

  const handleSuggestionSelect = (suggestion: MapboxSuggestion) => {
    if (suggestion.city) form.setFieldValue("city", suggestion.city);
    if (suggestion.state) form.setFieldValue("state", suggestion.state);
    if (suggestion.postal_code) form.setFieldValue("postal_code", suggestion.postal_code);
    if (suggestion.country) form.setFieldValue("country", suggestion.country);
    form.setFieldValue("latitude", suggestion.latitude);
    form.setFieldValue("longitude", suggestion.longitude);
  };

  const showVenue = needsVenue(form.values.location_type);
  const showOnline = needsOnline(form.values.location_type);

  return (
    <Card withBorder radius="lg" p="xl">
      <form onSubmit={form.onSubmit((values) => updateMutation.mutate(values))}>
        <fieldset disabled={disabled} style={{ border: 0, padding: 0, margin: 0 }}>
          <Stack>
            <SegmentedControl
              data={LOCATION_TYPE_OPTIONS}
              {...form.getInputProps("location_type")}
            />

            {showVenue && (
              <>
                <CountrySelector label="Country" required {...form.getInputProps("country")} />
                <TextInput label="Venue name" required {...form.getInputProps("venue_name")} />
                {hasMapbox ? (
                  <LocationAutocomplete
                    label="Address"
                    required
                    error={form.errors.address_line1}
                    disabled={disabled}
                    value={form.values.address_line1}
                    onChange={(value) => form.setFieldValue("address_line1", value)}
                    onSelect={handleSuggestionSelect}
                    countryIso2={form.values.country || null}
                  />
                ) : (
                  <TextInput label="Address" required {...form.getInputProps("address_line1")} />
                )}
                <Group grow>
                  <TextInput label="City" required {...form.getInputProps("city")} />
                  <TextInput label="State / Region" {...form.getInputProps("state")} />
                </Group>
                <TextInput label="Postal code" {...form.getInputProps("postal_code")} />
                <TextInput label="Address line 2" {...form.getInputProps("address_line2")} />
              </>
            )}

            {showOnline && (
              <>
                <TextInput label="Join link / URL" placeholder="https://zoom.us/j/..." {...form.getInputProps("online_url")} />
                <TextInput label="Platform" placeholder="Zoom" {...form.getInputProps("platform_name")} />
                <Textarea
                  label="Access instructions"
                  placeholder="Meeting ID, passcode, or other notes for attendees"
                  autosize
                  minRows={2}
                  {...form.getInputProps("access_instructions")}
                />
              </>
            )}

            {!disabled ? (
              <Button type="submit" loading={updateMutation.isPending} style={{ alignSelf: "flex-start" }}>
                Save location
              </Button>
            ) : (
              <Text size="xs" c="dimmed">
                This event is archived and can no longer be edited.
              </Text>
            )}
          </Stack>
        </fieldset>
      </form>
    </Card>
  );
}

function handleFormError(error: Error, setErrors: (errors: Record<string, string>) => void, router: ReturnType<typeof useRouter>) {
  if (redirectOnAuthError(error, router)) return;
  if (error instanceof ApiError && error.errors) {
    setErrors(Object.fromEntries(Object.entries(error.errors).map(([field, messages]) => [field, messages[0]])));
  } else notifications.show({ color: "red", message: error.message });
}
