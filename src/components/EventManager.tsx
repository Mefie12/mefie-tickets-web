"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useForm } from "@mantine/form";
import {
  Alert,
  Button,
  Card,
  Group,
  Modal,
  MultiSelect,
  SegmentedControl,
  Stack,
  Tabs,
  Text,
  TextInput,
  Title,
} from "@mantine/core";
import { notifications } from "@mantine/notifications";
import { TimezoneSelector } from "@/components/TimezoneSelector";
import { COUNTRIES_BY_CODE } from "@/lib/countries";
import { CurrencySelector } from "@/components/CurrencySelector";
import { PaymentCurrencyExplainer } from "@/components/PaymentCurrencyExplainer";
import { getOrganizationPaymentCurrency } from "@/lib/paymentAccountApi";
import { LocationFields, needsOnline, needsVenue } from "@/components/LocationFields";
import { EventDetailsFields } from "@/components/EventDetailsFields";
import { ApiError } from "@/lib/authApi";
import { redirectOnAuthError } from "@/lib/authErrorRedirect";
import { joinLocalDateTime, splitLocalDateTime, utcIsoToZonedParts } from "@/lib/eventDateTime";
import { browserTimezone } from "@/lib/timezones";
import { CURRENCIES_BY_CODE, suggestCurrencyForCountryCode } from "@/lib/currencies";
import type { MapboxSuggestion } from "@/lib/mapbox";
import {
  getEventTaxonomies,
  type Event,
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
import { ContentSectionsEditor } from "@/components/ContentSectionsEditor";
import { EventMediaEditor } from "@/components/EventMediaEditor";
import { EventTermsEditor } from "@/components/EventTermsEditor";
import { ComplimentarySettings } from "@/components/ComplimentarySettings";
import { DeferredAssignmentCard } from "@/components/DeferredAssignmentCard";
import { ScrollableTabsBar } from "@/components/ScrollableTabsBar";
import type { ComplimentaryProgram } from "@/lib/complimentaryApi";

const TAB_DEFS = [
  { value: "details", label: "Details" },
  { value: "date-time", label: "Date & Time" },
  { value: "location", label: "Location & Access" },
  { value: "media", label: "Media" },
  { value: "ticket-setup", label: "Ticket Setup" },
  { value: "complimentary", label: "Complimentary" },
  { value: "questions", label: "Questions" },
  { value: "content", label: "Event page content" },
  { value: "terms", label: "Terms & Conditions" },
  { value: "advanced", label: "Advanced Settings" },
];
const VALID_TABS = TAB_DEFS.map((t) => t.value);

// Only forms with one discrete "this tab is done" save action advance the
// organizer forward — a tab that's an open-ended list (media, tickets,
// questions, content) or a multi-step/no-single-save workflow (terms,
// which auto-saves per field) never fires this, since there's no way to
// know the organizer is actually finished with it.
function nextTab(current: string): string | null {
  const index = VALID_TABS.indexOf(current);
  return index >= 0 && index < VALID_TABS.length - 1 ? VALID_TABS[index + 1] : null;
}

type StatusConfirmation = {
  title: string;
  body: string;
  confirmLabel: string;
  confirmColor?: string;
};

function statusConfirmation(from: EventStatus, to: EventStatus): StatusConfirmation {
  if (from === "ARCHIVED" && to === "DRAFT") {
    return {
      title: "Unarchive this event?",
      body: "The event will become editable again, but it will stay private and ticket sales will remain stopped until you publish it.",
      confirmLabel: "Unarchive as draft",
    };
  }
  if (to === "ARCHIVED") {
    return {
      title: "Archive this event?",
      body: "The event will be hidden and become read-only. Existing orders, attendee records, and tickets remain intact and valid. Archiving does not cancel or refund the event, and you can restore it later as a draft.",
      confirmLabel: "Archive event",
      confirmColor: "red",
    };
  }
  if (to === "LIVE") {
    return {
      title: "Publish this event?",
      body: "The event will become public. Ticket sales and registrations will follow the availability and sales windows you configured.",
      confirmLabel: "Publish event",
    };
  }
  return {
    title: "Unpublish this event?",
    body: "The public event page and new sales will stop. Existing orders and tickets remain intact and valid; this does not cancel or refund the event.",
    confirmLabel: "Unpublish event",
    confirmColor: "orange",
  };
}

export function EventManager({
  initialEvent,
  initialProducts,
  initialQuestions,
  initialComplimentaryProgram,
}: {
  initialEvent: Event;
  initialProducts: Product[];
  initialQuestions: Question[];
  initialComplimentaryProgram: ComplimentaryProgram;
}) {
  const [event, setEvent] = useState(initialEvent);
  const sellsPaidTickets = initialProducts.some((product) => ["PAID", "TIERED", "DONATION"].includes(product.type));
  const [requestedStatus, setRequestedStatus] = useState<EventStatus | null>(null);
  const [statusError, setStatusError] = useState<string | null>(null);
  const archived = event.status === "ARCHIVED";
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const requestedTab = searchParams.get("tab") ?? "";
  const [tab, setTab] = useState(VALID_TABS.includes(requestedTab) ? requestedTab : "details");

  const handleTabChange = (next: string | null) => {
    if (!next) return;
    setTab(next);
    const params = new URLSearchParams(searchParams.toString());
    params.set("tab", next);
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  };

  const statusMutation = useMutation({
    mutationFn: (status: EventStatus) => updateEventStatus(event.id, status),
    onSuccess: (data: { event: Event }) => {
      setEvent(data.event);
      setRequestedStatus(null);
      setStatusError(null);
      notifications.show({ color: "teal", message: `Event is now ${data.event.status}.` });
    },
    onError: (error: Error) => {
      if (redirectOnAuthError(error, router)) return;
      setStatusError(error instanceof ApiError ? (error.fieldError("status") ?? error.message) : "Something went wrong.");
    },
  });

  const advanceTab = (fromTab: string) => {
    const next = nextTab(fromTab);
    if (next) handleTabChange(next);
  };

  const confirmation = requestedStatus ? statusConfirmation(event.status, requestedStatus) : null;

  const requestStatusChange = (status: EventStatus) => {
    if (status === event.status) return;
    setStatusError(null);
    setRequestedStatus(status);
  };

  return (
    <Stack gap="xl">
      <Stack gap="xs">
        <Title order={2} fz={28}>
          Event settings
        </Title>
        <Group gap="xs">
          <Text size="sm" c="dimmed">
            Status:
          </Text>
          <SegmentedControl
            size="xs"
            data={[
              { value: "DRAFT", label: "Draft" },
              { value: "LIVE", label: "Live", disabled: archived },
              { value: "ARCHIVED", label: "Archived" },
            ]}
            value={event.status}
            onChange={(value) => requestStatusChange(value as EventStatus)}
            disabled={statusMutation.isPending}
          />
        </Group>
        {archived && (
          <Text size="sm" c="dimmed">
            This event is archived and read-only. Restore it as a draft to make changes; it will remain private until republished.
          </Text>
        )}
      </Stack>

      <Modal
        opened={confirmation !== null}
        onClose={() => {
          if (!statusMutation.isPending) {
            setRequestedStatus(null);
            setStatusError(null);
          }
        }}
        title={confirmation?.title}
        centered
        closeOnClickOutside={!statusMutation.isPending}
        closeOnEscape={!statusMutation.isPending}
        withCloseButton={!statusMutation.isPending}
      >
        <Stack gap="md">
          <Text size="sm">{confirmation?.body}</Text>
          {statusError && <Alert color="red">{statusError}</Alert>}
          <Group justify="flex-end">
            <Button variant="default" disabled={statusMutation.isPending} onClick={() => { setRequestedStatus(null); setStatusError(null); }}>
              Keep current status
            </Button>
            <Button
              color={confirmation?.confirmColor}
              loading={statusMutation.isPending}
              onClick={() => requestedStatus && statusMutation.mutate(requestedStatus)}
            >
              {confirmation?.confirmLabel}
            </Button>
          </Group>
        </Stack>
      </Modal>

      <Tabs value={tab} onChange={handleTabChange}>
        <ScrollableTabsBar tabs={TAB_DEFS} value={tab} onChange={handleTabChange} />

        <Tabs.Panel value="details" pt="lg">
          <EventDetailsForm event={event} onUpdated={setEvent} disabled={archived} onSaved={() => advanceTab("details")} />
        </Tabs.Panel>
        <Tabs.Panel value="date-time" pt="lg">
          <EventDateTimeForm event={event} onUpdated={setEvent} disabled={archived} onSaved={() => advanceTab("date-time")} />
        </Tabs.Panel>
        <Tabs.Panel value="location" pt="lg">
          <EventLocationForm event={event} onUpdated={setEvent} disabled={archived} onSaved={() => advanceTab("location")} />
        </Tabs.Panel>
        <Tabs.Panel value="media" pt="lg">
          <EventMediaEditor eventId={event.id} initialEvent={event} disabled={archived} />
        </Tabs.Panel>
        <Tabs.Panel value="ticket-setup" pt="lg">
          <ProductsEditor
            eventId={event.id}
            eventTimezone={event.timezone}
            eventCurrency={event.currency_code}
            initialProducts={initialProducts}
            disabled={archived}
          />
        </Tabs.Panel>
        <Tabs.Panel value="complimentary" pt="lg">
          <ComplimentarySettings eventId={event.id} initialProgram={initialComplimentaryProgram} products={initialProducts} disabled={archived} onSaved={() => advanceTab("complimentary")} />
        </Tabs.Panel>
        <Tabs.Panel value="questions" pt="lg">
          <QuestionsEditor eventId={event.id} initialQuestions={initialQuestions} disabled={archived} />
        </Tabs.Panel>
        <Tabs.Panel value="content" pt="lg">
          <ContentSectionsEditor eventId={event.id} disabled={archived} />
        </Tabs.Panel>
        <Tabs.Panel value="terms" pt="lg">
          <EventTermsEditor eventId={event.id} disabled={archived} />
        </Tabs.Panel>
        <Tabs.Panel value="advanced" pt="lg">
          <DeferredAssignmentCard eventId={event.id} event={event} sellsPaidTickets={sellsPaidTickets} />
        </Tabs.Panel>
      </Tabs>
    </Stack>
  );
}

function EventDetailsForm({
  event,
  onUpdated,
  disabled,
  onSaved,
}: {
  event: Event;
  onUpdated: (event: Event) => void;
  disabled: boolean;
  onSaved?: () => void;
}) {
  const router = useRouter();
  const taxonomies = useQuery<EventTaxonomies>({ queryKey: ["event-taxonomies"], queryFn: getEventTaxonomies });
  const paymentCurrency = useQuery({ queryKey: ["organization-payment-currency"], queryFn: getOrganizationPaymentCurrency });

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
      currency_code: (v) => (!v ? "Currency is required" : null),
    },
  });
  // Suggested from the event's already-saved location (not live Location-tab
  // typing — that's a separate form/tab). Dismissible, never auto-applied.
  const suggestedCurrency = suggestCurrencyForCountryCode(event.location_details?.country);
  // Tracks *which* currency was dismissed (not a plain boolean) so a
  // later location change that suggests a different currency isn't
  // silently suppressed by an earlier, unrelated dismissal.
  const [dismissedCurrency, setDismissedCurrency] = useState<string | null>(null);
  const showCurrencySuggestion =
    !paymentCurrency.data &&
    !!suggestedCurrency &&
    suggestedCurrency !== form.values.currency_code &&
    suggestedCurrency !== dismissedCurrency;
  const suggestedCountryName = event.location_details?.country
    ? (COUNTRIES_BY_CODE.get(event.location_details.country)?.name ?? event.location_details.country)
    : "";

  const updateMutation = useMutation({
    mutationFn: (values: typeof form.values) => updateEvent(event.id, {
      title: values.title,
      description: values.description,
      event_category_id: values.event_category_id ? Number(values.event_category_id) : null,
      event_subcategory_id: values.event_subcategory_id ? Number(values.event_subcategory_id) : null,
      classification_version: event.classification_version,
      audience_ids: values.audience_ids.map(Number),
      attribute_ids: values.attribute_ids.map(Number),
      currency_code: values.currency_code,
    }),
    onSuccess: (data: { event: Event }) => { onUpdated(data.event); notifications.show({ color: "teal", message: "Event details updated." }); onSaved?.(); },
    onError: (error: Error) => handleFormError(error, form.setErrors, router),
  });

  return (
    <Card withBorder radius="lg" p="xl">
      <form onSubmit={form.onSubmit((values) => updateMutation.mutate(values))}>
        <fieldset disabled={disabled} style={{ border: 0, padding: 0, margin: 0 }}>
          <Stack>
            <EventDetailsFields
              values={form.values}
              onChange={(field, value) => form.setFieldValue(field, value as never)}
              errors={form.errors}
              disabled={disabled}
              categories={taxonomies.data?.categories ?? []}
              currentCategory={event.category}
              currentSubcategory={event.subcategory}
              categoryLabel="Category (required to publish)"
            />
            {paymentCurrency.data ? (
              <TextInput
                label="Currency"
                value={`${event.currency_code} — set by your payment setup`}
                disabled
                description={
                  <>
                    Every price on this event — tickets, tiers, checkout — is quoted in this currency, set by your
                    organization&apos;s payment setup. <PaymentCurrencyExplainer />
                  </>
                }
              />
            ) : (
              <CurrencySelector
                label="Currency"
                required
                description="Every price on this event — tickets, tiers, checkout — is quoted in this currency. This is provisional until you set up payments."
                {...form.getInputProps("currency_code")}
              />
            )}
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
                <Button variant="subtle" size="compact-xs" color="gray" onClick={() => setDismissedCurrency(suggestedCurrency)}>
                  Dismiss
                </Button>
              </Alert>
            )}
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

function EventDateTimeForm({ event, onUpdated, disabled, onSaved }: { event: Event; onUpdated: (event: Event) => void; disabled: boolean; onSaved?: () => void }) {
  const router = useRouter();
  const start = event.start_date ? utcIsoToZonedParts(event.start_date, event.timezone) : { date: "", time: "" };
  const end = event.end_date ? utcIsoToZonedParts(event.end_date, event.timezone) : { date: "", time: "" };
  const form = useForm({
    initialValues: {
      // One `<input type="datetime-local">` value per end — `YYYY-MM-DDTHH:mm`,
      // wall-clock in the event's zone. Split back to date/time only at submit.
      start_at: joinLocalDateTime(start),
      end_at: joinLocalDateTime(end),
      // "" (not event.timezone) when never scheduled, so the mount effect
      // below can fill in the browser's zone without changing an
      // already-rendered value — flipping a rendered "UTC" to a guessed
      // zone post-mount is a real SSR/CSR text mismatch, not just cosmetic:
      // React logs it as a hydration error, and worse, a different admin
      // opening the same draft would silently get a different default.
      timezone: event.start_date ? event.timezone : "",
    },
    validate: {
      start_at: (v) => (!v ? "Start date and time is required" : null),
      timezone: (v) => (!v ? "Timezone is required" : null),
      // Both ends are wall-clock in the one timezone and share the
      // `YYYY-MM-DDTHH:mm` shape, so a lexicographic compare is chronological.
      end_at: (v, values) =>
        !v ? "End date and time is required" : v <= values.start_at ? "End must be after start" : null,
    },
  });
  useEffect(() => {
    if (!event.start_date) form.setFieldValue("timezone", browserTimezone());
    // Initial suggestion only; do not overwrite the organizer's selection.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onStartChange = (value: string) => {
    form.setFieldValue("start_at", value);
    // Drop an end that's now at or before the new start rather than leave a
    // stale, invalid range sitting in the form.
    if (form.values.end_at && form.values.end_at <= value) form.setFieldValue("end_at", "");
  };

  const updateMutation = useMutation({
    mutationFn: (values: typeof form.values) => {
      const startParts = splitLocalDateTime(values.start_at);
      const endParts = splitLocalDateTime(values.end_at);
      return updateEvent(event.id, {
        start_date: startParts.date,
        start_time: startParts.time,
        end_date: endParts.date,
        end_time: endParts.time,
        timezone: values.timezone,
      });
    },
    onSuccess: (data: { event: Event }) => {
      onUpdated(data.event);
      notifications.show({ color: "teal", message: "Date and time updated." });
      onSaved?.();
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
              <TextInput
                type="datetime-local"
                label="Start"
                withAsterisk
                {...form.getInputProps("start_at")}
                onChange={(e) => onStartChange(e.currentTarget.value)}
              />
              <TextInput
                type="datetime-local"
                label="End"
                withAsterisk
                min={form.values.start_at || undefined}
                {...form.getInputProps("end_at")}
              />
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

function EventLocationForm({
  event,
  onUpdated,
  disabled,
  onSaved,
}: {
  event: Event;
  onUpdated: (event: Event) => void;
  disabled: boolean;
  onSaved?: () => void;
}) {
  const router = useRouter();
  const loc = event.location_details;

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
      onSaved?.();
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

  return (
    <Card withBorder radius="lg" p="xl">
      <form onSubmit={form.onSubmit((values) => updateMutation.mutate(values))}>
        <fieldset disabled={disabled} style={{ border: 0, padding: 0, margin: 0 }}>
          <Stack>
            <LocationFields
              values={form.values}
              onChange={(field, value) => form.setFieldValue(field, value as never)}
              errors={form.errors}
              disabled={disabled}
              onAddressSelect={handleSuggestionSelect}
            />

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
