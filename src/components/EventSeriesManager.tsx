"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { useMutation, useQuery } from "@tanstack/react-query";
import {
  Alert,
  Anchor,
  Badge,
  Button,
  Card,
  CopyButton,
  Group,
  Loader,
  Menu,
  Stack,
  Table,
  Tabs,
  Text,
  TextInput,
  Textarea,
  Title,
} from "@mantine/core";
import { useForm } from "@mantine/form";
import { IconDotsVertical } from "@tabler/icons-react";
import { modals } from "@mantine/modals";
import { notifications } from "@mantine/notifications";
import { LocationFields, needsOnline, needsVenue } from "@/components/LocationFields";
import { EventDetailsFields } from "@/components/EventDetailsFields";
import { PaymentCurrencyExplainer } from "@/components/PaymentCurrencyExplainer";
import { getOrganizationPaymentCurrency } from "@/lib/paymentAccountApi";
import type { MapboxSuggestion } from "@/lib/mapbox";
import {
  DEFAULT_RECURRENCE_VALUES,
  RecurrenceRuleEditor,
  toRecurrenceRuleInput,
  type RecurrenceFormValues,
} from "@/components/RecurrenceRuleEditor";
import { ProductsEditor } from "@/components/ProductsEditor";
import { QuestionsEditor } from "@/components/QuestionsEditor";
import { ContentSectionsEditor } from "@/components/ContentSectionsEditor";
import { EventTermsEditor } from "@/components/EventTermsEditor";
import { EventMediaEditor } from "@/components/EventMediaEditor";
import { ApiError } from "@/lib/authApi";
import { redirectOnAuthError } from "@/lib/authErrorRedirect";
import { utcIsoToZonedPartsOrEmpty } from "@/lib/eventDateTime";
import { getEventTaxonomies, type Event, type EventLocationInput, type EventTaxonomies, type LocationType } from "@/lib/eventApi";
import type { Product } from "@/lib/productApi";
import type { Question } from "@/lib/questionApi";
import {
  archiveEventSeries,
  cancelOccurrence,
  changeRecurrencePattern,
  extendEventSeries,
  getEventSeries,
  listAffectedOrders,
  listEventSeriesOccurrences,
  previewPatternChange,
  publishEventSeries,
  rescheduleOccurrence,
  restoreEventSeries,
  updateEventSeries,
  type EventSeries,
  type EventSeriesOccurrence,
  type RecurrencePatternChangeDiff,
} from "@/lib/eventSeriesApi";

// §4.3 — how often (and for how long) to poll a series' own show
// endpoint while generation_status is PENDING/PROCESSING. Mirrors the
// conditional-refetchInterval pattern already used in
// CheckoutPaymentStep.tsx for polling Stripe payment-intent
// confirmation — slower interval and longer ceiling here since this
// endpoint returns a heavier payload (template/category/occurrences)
// and a large series (up to 200 occurrences, each needing template
// content copied) can plausibly take longer than a payment to resolve.
const GENERATION_POLL_INTERVAL_MS = 3000;
const GENERATION_POLL_CEILING_MS = 5 * 60 * 1000;

function isGeneratingStatus(status: EventSeries["generation_status"]): boolean {
  return status === "PENDING" || status === "PROCESSING";
}

const VALID_TABS = ["details", "recurrence", "location", "media", "ticket-setup", "questions", "content", "terms", "publish"];

// Same rule as EventManager.tsx's nextTab: only a tab with one discrete
// save action advances the organizer forward — open-ended lists (media,
// tickets, questions, content) and terms (auto-saves per field, no
// single "done" moment) never call this.
function nextTab(current: string): string | null {
  const index = VALID_TABS.indexOf(current);
  return index >= 0 && index < VALID_TABS.length - 1 ? VALID_TABS[index + 1] : null;
}

function seriesToRecurrenceValues(series: EventSeries): RecurrenceFormValues {
  return {
    frequency: series.frequency,
    interval: series.interval,
    by_weekday: series.frequency === "WEEKLY" ? (series.by_weekday ?? []) : series.by_weekday ?? [],
    monthly_type: series.monthly_type ?? "MONTH_DAY",
    by_month_day: series.monthly_type === "MONTH_DAY" ? series.by_month_day ?? 1 : DEFAULT_RECURRENCE_VALUES.by_month_day,
    ordinal_weekday: series.monthly_type === "ORDINAL_WEEKDAY" ? series.by_weekday?.[0] ?? 5 : DEFAULT_RECURRENCE_VALUES.ordinal_weekday,
    by_set_position: series.by_set_position ?? 1,
    start_time: series.start_time.slice(0, 5),
    end_time: series.end_time.slice(0, 5),
    timezone: series.timezone,
    ends: series.until ? "on_date" : "after_count",
    until: series.until ?? "",
    occurrence_count: series.occurrence_count ?? 12,
  };
}

export function EventSeriesManager({
  initialSeries,
  initialTemplateEvent,
  initialProducts,
  initialQuestions,
}: {
  initialSeries: EventSeries;
  initialTemplateEvent: Event;
  initialProducts: Product[];
  initialQuestions: Question[];
}) {
  const [series, setSeries] = useState(initialSeries);
  const router = useRouter();
  const searchParams = useSearchParams();
  const requestedTab = searchParams.get("tab");
  const activeTab = requestedTab && VALID_TABS.includes(requestedTab) ? requestedTab : "details";
  const disabled = series.status !== "DRAFT";
  const isGenerating = isGeneratingStatus(series.generation_status);

  const advanceTab = (fromTab: string) => {
    const next = nextTab(fromTab);
    if (next) router.replace(`?tab=${next}`, { scroll: false });
  };

  // §4.3 — polls the series' own show endpoint while a publish/extend/
  // pattern-change job is running in the background, so the organizer
  // never has to guess or manually refresh. Lifted here (not inside
  // PublishPanel) so the "generating" state is visible from every tab,
  // not just Occurrences.
  const pollStartedAtRef = useRef<number | null>(null);
  const prevGenerationStatusRef = useRef(initialSeries.generation_status ?? null);

  const generationQuery = useQuery({
    queryKey: ["event-series-generation-status", series.id],
    queryFn: () => getEventSeries(series.id),
    enabled: isGenerating,
    // The organizer is expected to alt-tab away while this runs in the
    // background (that's the point of "generating in the background") —
    // without this, TanStack Query's refetchInterval silently no-ops
    // whenever the tab isn't focused, so the page would never catch the
    // COMPLETED transition until they click back in.
    refetchIntervalInBackground: true,
    refetchInterval: (query) => {
      const status = query.state.data?.event_series.generation_status;
      if (!isGeneratingStatus(status)) return false;
      if (pollStartedAtRef.current !== null && Date.now() - pollStartedAtRef.current >= GENERATION_POLL_CEILING_MS) return false;
      return GENERATION_POLL_INTERVAL_MS;
    },
  });

  useEffect(() => {
    if (isGenerating && pollStartedAtRef.current === null) pollStartedAtRef.current = Date.now();
    if (!isGenerating) pollStartedAtRef.current = null;
  }, [isGenerating]);

  useEffect(() => {
    const polled = generationQuery.data?.event_series;
    if (!polled) return;
    // Syncing an external system's (the poll's) latest value into local
    // state on change — the exact case this rule's own description
    // calls out as fine, same justification LocationAutocomplete.tsx
    // already uses for its own poll-driven state sync.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSeries(polled);
    if (prevGenerationStatusRef.current !== "COMPLETED" && polled.generation_status === "COMPLETED") {
      const count = polled.occurrences?.length ?? 0;
      notifications.show({ color: "teal", message: `Done — ${count} occurrence${count === 1 ? "" : "s"} are now live.` });
    }
    prevGenerationStatusRef.current = polled.generation_status ?? null;
  }, [generationQuery.data]);

  return (
    <Stack gap="xl">
      <Group justify="space-between" align="center">
        <div>
          <Title order={2}>{series.title}</Title>
          <Text c="dimmed" size="sm">
            Recurring series
          </Text>
        </div>
        <Group gap="sm">
          <Badge size="lg" color={series.status === "LIVE" ? "teal" : series.status === "ARCHIVED" ? "gray" : "yellow"}>
            {series.status}
          </Badge>
          {isGenerating && (
            <Badge color="blue" variant="light" leftSection={<Loader size={10} color="blue" />}>
              Generating…
            </Badge>
          )}
          <ArchiveRestoreButton series={series} onUpdated={setSeries} />
        </Group>
      </Group>

      <Tabs value={activeTab} onChange={(tab) => router.replace(`?tab=${tab}`, { scroll: false })}>
        <Tabs.List>
          <Tabs.Tab value="details">Details</Tabs.Tab>
          <Tabs.Tab value="recurrence">Recurrence</Tabs.Tab>
          <Tabs.Tab value="location">Location</Tabs.Tab>
          <Tabs.Tab value="media">Media</Tabs.Tab>
          <Tabs.Tab value="ticket-setup">Ticket Setup</Tabs.Tab>
          <Tabs.Tab value="questions">Questions</Tabs.Tab>
          <Tabs.Tab value="content">Event page content</Tabs.Tab>
          <Tabs.Tab value="terms">Terms & Conditions</Tabs.Tab>
          <Tabs.Tab value="publish">{series.status === "DRAFT" ? "Publish" : "Occurrences"}</Tabs.Tab>
        </Tabs.List>

        <Tabs.Panel value="details" pt="lg">
          <DetailsForm series={series} onUpdated={setSeries} disabled={disabled} onSaved={() => advanceTab("details")} />
        </Tabs.Panel>
        <Tabs.Panel value="recurrence" pt="lg">
          <RecurrenceForm series={series} onUpdated={setSeries} disabled={disabled} onSaved={() => advanceTab("recurrence")} />
        </Tabs.Panel>
        <Tabs.Panel value="location" pt="lg">
          <LocationForm series={series} onUpdated={setSeries} disabled={disabled} onSaved={() => advanceTab("location")} />
        </Tabs.Panel>
        <Tabs.Panel value="media" pt="lg">
          <EventMediaEditor eventId={series.template_event_id} initialEvent={initialTemplateEvent} disabled={disabled} />
        </Tabs.Panel>
        <Tabs.Panel value="ticket-setup" pt="lg">
          <ProductsEditor
            eventId={series.template_event_id}
            eventTimezone={series.timezone}
            eventCurrency={series.currency_code}
            initialProducts={initialProducts}
            disabled={disabled}
          />
        </Tabs.Panel>
        <Tabs.Panel value="questions" pt="lg">
          <QuestionsEditor eventId={series.template_event_id} initialQuestions={initialQuestions} disabled={disabled} />
        </Tabs.Panel>
        <Tabs.Panel value="content" pt="lg">
          <ContentSectionsEditor eventId={series.template_event_id} disabled={disabled} />
        </Tabs.Panel>
        <Tabs.Panel value="terms" pt="lg">
          <EventTermsEditor eventId={series.template_event_id} disabled={disabled} />
        </Tabs.Panel>
        <Tabs.Panel value="publish" pt="lg">
          <PublishPanel series={series} onUpdated={setSeries} />
        </Tabs.Panel>
      </Tabs>
    </Stack>
  );
}

function DetailsForm({ series, onUpdated, disabled, onSaved }: { series: EventSeries; onUpdated: (series: EventSeries) => void; disabled: boolean; onSaved?: () => void }) {
  const router = useRouter();
  const taxonomies = useQuery<EventTaxonomies>({ queryKey: ["event-taxonomies"], queryFn: getEventTaxonomies });
  const paymentCurrency = useQuery({ queryKey: ["organization-payment-currency"], queryFn: getOrganizationPaymentCurrency });

  const form = useForm({
    initialValues: {
      title: series.title,
      description: series.description,
      event_category_id: series.event_category_id ? String(series.event_category_id) : "",
      event_subcategory_id: series.event_subcategory_id ? String(series.event_subcategory_id) : "",
    },
    validate: {
      title: (v) => (v.trim().length === 0 ? "Title is required" : null),
      description: (v) => (v.replace(/<[^>]*>/g, "").trim().length === 0 ? "Description is required" : null),
    },
  });

  const mutation = useMutation({
    mutationFn: (values: typeof form.values) =>
      updateEventSeries(series.id, {
        title: values.title,
        description: values.description,
        event_category_id: values.event_category_id ? Number(values.event_category_id) : null,
        event_subcategory_id: values.event_subcategory_id ? Number(values.event_subcategory_id) : null,
      }),
    onSuccess: (data: { event_series: EventSeries }) => { onUpdated(data.event_series); notifications.show({ color: "teal", message: "Series details updated." }); onSaved?.(); },
    onError: (error: Error) => {
      if (redirectOnAuthError(error, router)) return;
      if (error instanceof ApiError && error.errors) {
        form.setErrors(Object.fromEntries(Object.entries(error.errors).map(([f, m]) => [f, m[0]])));
      } else {
        notifications.show({ color: "red", message: error.message });
      }
    },
  });

  return (
    <Card withBorder radius="lg" p="xl">
      <form onSubmit={form.onSubmit((values) => mutation.mutate(values))}>
        <fieldset disabled={disabled} style={{ border: 0, padding: 0, margin: 0 }}>
          <Stack>
            <EventDetailsFields
              values={form.values}
              onChange={(field, value) => form.setFieldValue(field, value as never)}
              errors={form.errors}
              disabled={disabled}
              categories={taxonomies.data?.categories ?? []}
              currentCategory={series.category}
              currentSubcategory={series.subcategory}
              titleLabel="Series title"
            />
            {paymentCurrency.data ? (
              <TextInput
                label="Currency"
                value={`${paymentCurrency.data} — set by your payment setup`}
                disabled
                description={
                  <>
                    Every price on this series&apos; template — tickets, tiers, checkout — is quoted in this
                    currency, set by your organization&apos;s payment setup. <PaymentCurrencyExplainer />
                  </>
                }
              />
            ) : (
              <TextInput
                label="Currency"
                placeholder="Not set"
                value=""
                disabled
                description={
                  <>
                    Set up payments to determine this series&apos; currency.{" "}
                    <Anchor component={Link} href="/organization/payments">
                      Go to Payments
                    </Anchor>
                  </>
                }
              />
            )}
            {!disabled ? (
              <Button type="submit" style={{ alignSelf: "flex-start" }} loading={mutation.isPending}>
                Save changes
              </Button>
            ) : (
              <Text size="xs" c="dimmed">This series is published — template details can no longer be edited this way.</Text>
            )}
          </Stack>
        </fieldset>
      </form>
    </Card>
  );
}

function RecurrenceForm({ series, onUpdated, disabled, onSaved }: { series: EventSeries; onUpdated: (series: EventSeries) => void; disabled: boolean; onSaved?: () => void }) {
  const router = useRouter();
  const [startsOn, setStartsOn] = useState(series.starts_on);
  const [values, setValues] = useState<RecurrenceFormValues>(seriesToRecurrenceValues(series));
  const [error, setError] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: () => updateEventSeries(series.id, { starts_on: startsOn, recurrence: toRecurrenceRuleInput(values) }),
    onSuccess: (data: { event_series: EventSeries }) => { onUpdated(data.event_series); notifications.show({ color: "teal", message: "Schedule updated." }); onSaved?.(); },
    onError: (err: Error) => {
      if (redirectOnAuthError(err, router)) return;
      setError(err.message);
    },
  });

  return (
    <Card withBorder radius="lg" p="xl">
      {error && <Alert color="red" mb="md">{error}</Alert>}
      <RecurrenceRuleEditor values={values} onChange={setValues} startsOn={startsOn} onStartsOnChange={setStartsOn} disabled={disabled} />
      {!disabled ? (
        <Button mt="md" loading={mutation.isPending} onClick={() => mutation.mutate()}>
          Save schedule
        </Button>
      ) : (
        <Text size="xs" c="dimmed" mt="md">This series is published — the recurrence pattern can no longer be edited this way (see the roadmap&apos;s per-occurrence editing work).</Text>
      )}
    </Card>
  );
}

function LocationForm({ series, onUpdated, disabled, onSaved }: { series: EventSeries; onUpdated: (series: EventSeries) => void; disabled: boolean; onSaved?: () => void }) {
  const router = useRouter();
  const loc = series.location_details;

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

  const mutation = useMutation({
    mutationFn: (values: typeof form.values) => updateEventSeries(series.id, { location: values as EventLocationInput }),
    onSuccess: (data: { event_series: EventSeries }) => { onUpdated(data.event_series); notifications.show({ color: "teal", message: "Location updated." }); onSaved?.(); },
    onError: (error: Error) => {
      if (redirectOnAuthError(error, router)) return;
      if (error instanceof ApiError && error.errors) {
        form.setErrors(Object.fromEntries(Object.entries(error.errors).map(([f, m]) => [f.replace(/^location\./, ""), m[0]])));
      } else {
        notifications.show({ color: "red", message: error.message });
      }
    },
  });

  const handleSuggestionSelect = (s: MapboxSuggestion) => {
    if (s.city) form.setFieldValue("city", s.city);
    if (s.state) form.setFieldValue("state", s.state);
    if (s.postal_code) form.setFieldValue("postal_code", s.postal_code);
    if (s.country) form.setFieldValue("country", s.country);
    form.setFieldValue("latitude", s.latitude);
    form.setFieldValue("longitude", s.longitude);
  };

  return (
    <Card withBorder radius="lg" p="xl">
      <form onSubmit={form.onSubmit((values) => mutation.mutate(values))}>
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
              <Button type="submit" style={{ alignSelf: "flex-start" }} loading={mutation.isPending}>
                Save changes
              </Button>
            ) : (
              <Text size="xs" c="dimmed">This series is published — location can no longer be edited this way.</Text>
            )}
          </Stack>
        </fieldset>
      </form>
    </Card>
  );
}

function ArchiveRestoreButton({ series, onUpdated }: { series: EventSeries; onUpdated: (series: EventSeries) => void }) {
  const router = useRouter();
  const archiveMutation = useMutation({
    mutationFn: () => archiveEventSeries(series.id),
    onSuccess: (data: { event_series: EventSeries }) => { onUpdated(data.event_series); notifications.show({ color: "teal", message: "Series archived." }); },
    onError: (error: Error) => { if (redirectOnAuthError(error, router)) return; notifications.show({ color: "red", message: error.message }); },
  });
  const restoreMutation = useMutation({
    mutationFn: () => restoreEventSeries(series.id),
    onSuccess: (data: { event_series: EventSeries }) => { onUpdated(data.event_series); notifications.show({ color: "teal", message: "Series restored to draft." }); },
    onError: (error: Error) => { if (redirectOnAuthError(error, router)) return; notifications.show({ color: "red", message: error.message }); },
  });

  if (series.status === "ARCHIVED") {
    return (
      <Button
        variant="default"
        size="compact-sm"
        loading={restoreMutation.isPending}
        onClick={() =>
          modals.openConfirmModal({
            title: "Restore this series?",
            children: <Text size="sm">Makes not-yet-past, not-individually-cancelled occurrences sellable again. Publishing/extending again goes through the normal checks.</Text>,
            labels: { confirm: "Restore to draft", cancel: "Cancel" },
            onConfirm: () => restoreMutation.mutate(),
          })
        }
      >
        Restore
      </Button>
    );
  }

  return (
    <Button
      variant="default"
      color="red"
      size="compact-sm"
      loading={archiveMutation.isPending}
      onClick={() =>
        modals.openConfirmModal({
          title: "Archive this series?",
          children: (
            <Text size="sm">
              Hides the series from public discovery and freezes the template — no further edits or extensions while
              archived. Existing tickets, check-in, and refunds keep working exactly as before; nothing is cancelled
              or deleted.
            </Text>
          ),
          labels: { confirm: "Archive series", cancel: "Cancel" },
          confirmProps: { color: "red" },
          onConfirm: () => archiveMutation.mutate(),
        })
      }
    >
      Archive
    </Button>
  );
}

function RescheduleModalBody({
  seriesId,
  occurrence,
  seriesTimezone,
  onDone,
}: {
  seriesId: number;
  occurrence: EventSeriesOccurrence;
  seriesTimezone: string;
  onDone: (occurrence: EventSeriesOccurrence) => void;
}) {
  const router = useRouter();
  const currentStart = utcIsoToZonedPartsOrEmpty(occurrence.start_date, seriesTimezone);
  const currentEnd = utcIsoToZonedPartsOrEmpty(occurrence.end_date, seriesTimezone);
  const [date, setDate] = useState(occurrence.occurrence_date);
  const [startTime, setStartTime] = useState(currentStart.time);
  const [endTime, setEndTime] = useState(currentEnd.time);
  const [error, setError] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: () => rescheduleOccurrence(seriesId, occurrence.id, { date, start_time: startTime || undefined, end_time: endTime || undefined }),
    onSuccess: (data: { occurrence: EventSeriesOccurrence }) => {
      onDone(data.occurrence);
      notifications.show({ color: "teal", message: "Occurrence rescheduled." });
      modals.closeAll();
    },
    onError: (err: Error) => {
      if (redirectOnAuthError(err, router)) return;
      setError(err.message);
    },
  });

  return (
    <Stack>
      {error && <Alert color="red">{error}</Alert>}
      <Text size="sm" c="dimmed">
        Existing orders and tickets remain valid for this occurrence at its new date/time. Affected buyers are
        emailed automatically with the old and new schedule.
      </Text>
      <TextInput type="date" label="New date" required value={date} onChange={(e) => setDate(e.currentTarget.value)} />
      <Group grow>
        <TextInput type="time" label="Start time" value={startTime} onChange={(e) => setStartTime(e.currentTarget.value)} />
        <TextInput type="time" label="End time" value={endTime} onChange={(e) => setEndTime(e.currentTarget.value)} />
      </Group>
      <Group justify="flex-end">
        <Button variant="default" onClick={() => modals.closeAll()}>Cancel</Button>
        <Button loading={mutation.isPending} onClick={() => mutation.mutate()}>Reschedule</Button>
      </Group>
    </Stack>
  );
}

function CancelModalBody({
  seriesId,
  occurrence,
  onDone,
}: {
  seriesId: number;
  occurrence: EventSeriesOccurrence;
  onDone: (occurrence: EventSeriesOccurrence) => void;
}) {
  const router = useRouter();
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: () => cancelOccurrence(seriesId, occurrence.id, reason || undefined),
    onSuccess: (data: { occurrence: EventSeriesOccurrence }) => {
      onDone(data.occurrence);
      notifications.show({ color: "teal", message: "Occurrence cancelled." });
      modals.closeAll();
    },
    onError: (err: Error) => {
      if (redirectOnAuthError(err, router)) return;
      setError(err.message);
    },
  });

  return (
    <Stack>
      {error && <Alert color="red">{error}</Alert>}
      <Text size="sm" c="dimmed">
        Sales stop immediately for this date only. Existing orders, tickets, and accounting history are kept —
        nothing is deleted. Affected buyers are emailed automatically; refunding is manual for now (see the affected
        orders view).
      </Text>
      <Textarea label="Reason (optional, shown to affected buyers)" value={reason} onChange={(e) => setReason(e.currentTarget.value)} />
      <Group justify="flex-end">
        <Button variant="default" onClick={() => modals.closeAll()}>Back</Button>
        <Button color="red" loading={mutation.isPending} onClick={() => mutation.mutate()}>Cancel occurrence</Button>
      </Group>
    </Stack>
  );
}

function AffectedOrdersModalBody({ seriesId, occurrence }: { seriesId: number; occurrence: EventSeriesOccurrence }) {
  const query = useQuery({
    queryKey: ["event-series-affected-orders", seriesId, occurrence.id],
    queryFn: () => listAffectedOrders(seriesId, occurrence.id),
  });

  if (query.isLoading) return <Loader />;

  const orders = query.data?.orders ?? [];
  if (orders.length === 0) return <Text size="sm" c="dimmed">No orders on this date.</Text>;

  return (
    <Stack>
      <Text size="sm" c="dimmed">Read-only — refund manually outside the platform for now (§6.3).</Text>
      <Table>
        <Table.Thead>
          <Table.Tr>
            <Table.Th>Order</Table.Th>
            <Table.Th>Buyer</Table.Th>
            <Table.Th>Status</Table.Th>
            <Table.Th>Total</Table.Th>
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          {orders.map((order) => (
            <Table.Tr key={order.id}>
              <Table.Td>{order.short_id}</Table.Td>
              <Table.Td>{order.first_name} {order.last_name} ({order.email})</Table.Td>
              <Table.Td><Badge size="sm">{order.status}</Badge></Table.Td>
              <Table.Td>{order.currency} {order.total_amount}</Table.Td>
            </Table.Tr>
          ))}
        </Table.Tbody>
      </Table>
    </Stack>
  );
}

function OccurrenceActionsMenu({
  series,
  occurrence,
  onUpdated,
}: {
  series: EventSeries;
  occurrence: EventSeriesOccurrence;
  onUpdated: (occurrence: EventSeriesOccurrence) => void;
}) {
  const isCancelled = occurrence.occurrence_state === "CANCELLED";

  return (
    <Menu position="bottom-end" shadow="md">
      <Menu.Target>
        <Button variant="subtle" size="compact-sm" px={6}><IconDotsVertical size={16} /></Button>
      </Menu.Target>
      <Menu.Dropdown>
        <Menu.Item
          disabled={isCancelled}
          onClick={() =>
            modals.open({
              title: "Reschedule occurrence",
              children: <RescheduleModalBody seriesId={series.id} occurrence={occurrence} seriesTimezone={series.timezone} onDone={onUpdated} />,
            })
          }
        >
          Reschedule
        </Menu.Item>
        <Menu.Item
          color="red"
          disabled={isCancelled}
          onClick={() =>
            modals.open({
              title: "Cancel this occurrence?",
              children: <CancelModalBody seriesId={series.id} occurrence={occurrence} onDone={onUpdated} />,
            })
          }
        >
          Cancel
        </Menu.Item>
        <Menu.Item
          onClick={() =>
            modals.open({
              title: `Orders on ${occurrence.occurrence_date}`,
              size: "lg",
              children: <AffectedOrdersModalBody seriesId={series.id} occurrence={occurrence} />,
            })
          }
        >
          View orders
        </Menu.Item>
      </Menu.Dropdown>
    </Menu>
  );
}

function ChangeRecurrencePatternModalBody({
  series,
  defaultCutover,
  onApplied,
}: {
  series: EventSeries;
  defaultCutover: string;
  onApplied: (series: EventSeries) => void;
}) {
  const router = useRouter();
  const [cutoverDate, setCutoverDate] = useState(defaultCutover);
  const [values, setValues] = useState<RecurrenceFormValues>(seriesToRecurrenceValues(series));
  const [diff, setDiff] = useState<RecurrencePatternChangeDiff | null>(null);
  const [previewedFor, setPreviewedFor] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const currentKey = JSON.stringify({ cutoverDate, values });
  const isStale = diff !== null && previewedFor !== currentKey;

  function updateValues(next: RecurrenceFormValues) {
    setValues(next);
    setError(null);
  }
  function updateCutover(next: string) {
    setCutoverDate(next);
    setError(null);
  }

  const previewMutation = useMutation({
    mutationFn: () => previewPatternChange(series.id, { recurrence: toRecurrenceRuleInput(values), cutover_date: cutoverDate }),
    onSuccess: (data) => {
      setDiff(data.diff);
      setPreviewedFor(currentKey);
      setError(null);
    },
    onError: (err: Error) => {
      if (redirectOnAuthError(err, router)) return;
      setError(err.message);
    },
  });

  const applyMutation = useMutation({
    mutationFn: () => changeRecurrencePattern(series.id, { recurrence: toRecurrenceRuleInput(values), cutover_date: cutoverDate }),
    onSuccess: (data) => {
      onApplied(data.event_series);
      notifications.show({ color: "blue", message: "Pattern change is generating in the background — this page will update automatically when it's done." });
      modals.closeAll();
    },
    onError: (err: Error) => {
      if (redirectOnAuthError(err, router)) return;
      setError(err.message);
    },
  });

  const canApply = diff !== null && !isStale && diff.blocked.length === 0;

  return (
    <Stack>
      <Text size="sm" c="dimmed">
        Dates before the cutover are never touched. Unsold dates at or after it are replaced with the new pattern;
        dates that already have orders block the change — pick a later cutover, or cancel/reschedule them first.
        &quot;First occurrence&quot; below is that cutover date — the new pattern takes effect from there.
      </Text>
      {error && <Alert color="red">{error}</Alert>}

      <RecurrenceRuleEditor values={values} onChange={updateValues} startsOn={cutoverDate} onStartsOnChange={updateCutover} />

      <Group justify="space-between">
        <Button variant="default" onClick={() => modals.closeAll()}>
          Close
        </Button>
        <Group gap="xs">
          <Button variant="light" loading={previewMutation.isPending} onClick={() => previewMutation.mutate()}>
            Preview changes
          </Button>
          <Button loading={applyMutation.isPending} disabled={!canApply} onClick={() => applyMutation.mutate()}>
            Apply change
          </Button>
        </Group>
      </Group>

      {diff && (
        <Card withBorder radius="md" p="md">
          <Stack gap="xs">
            {isStale && (
              <Alert color="yellow" variant="light">
                The schedule or cutover changed since this preview — preview again before applying.
              </Alert>
            )}
            <Text size="sm">
              <strong>{diff.kept.length}</strong> existing date{diff.kept.length === 1 ? "" : "s"} kept as-is,{" "}
              <strong>{diff.removed.length}</strong> unsold date{diff.removed.length === 1 ? "" : "s"} replaced, and{" "}
              <strong>{diff.added.length}</strong> new date{diff.added.length === 1 ? "" : "s"} added under the new
              pattern.
            </Text>
            {diff.blocked.length > 0 && (
              <Alert color="red" variant="light" title="This cutover is blocked">
                {diff.blocked.length} date{diff.blocked.length === 1 ? "" : "s"} already{" "}
                {diff.blocked.length === 1 ? "has" : "have"} orders and can&apos;t be cleanly changed:{" "}
                {diff.blocked.map((o) => o.date).join(", ")}. Choose a later cutover, or cancel/reschedule{" "}
                {diff.blocked.length === 1 ? "it" : "them"} first from the Occurrences tab.
              </Alert>
            )}
          </Stack>
        </Card>
      )}
    </Stack>
  );
}

function ChangeRecurrencePatternButton({
  series,
  occurrences,
  onUpdated,
}: {
  series: EventSeries;
  occurrences: EventSeriesOccurrence[];
  onUpdated: (series: EventSeries) => void;
}) {
  // §5.6's suggested default: just after the next upcoming occurrence.
  const todayIso = new Date().toISOString().slice(0, 10);
  const nextUpcoming = occurrences
    .filter((o) => o.occurrence_date >= todayIso)
    .sort((a, b) => a.occurrence_date.localeCompare(b.occurrence_date))[0];
  const defaultCutover = nextUpcoming
    ? new Date(new Date(nextUpcoming.occurrence_date + "T00:00:00Z").getTime() + 86400000).toISOString().slice(0, 10)
    : todayIso;

  return (
    <Button
      variant="default"
      size="compact-sm"
      disabled={isGeneratingStatus(series.generation_status)}
      onClick={() =>
        modals.open({
          title: "Change recurrence pattern",
          size: "lg",
          children: <ChangeRecurrencePatternModalBody series={series} defaultCutover={defaultCutover} onApplied={onUpdated} />,
        })
      }
    >
      Change pattern
    </Button>
  );
}

/** §9 — never built a frontend caller for POST .../extend until now; the backend action has been live and tested since Phase 5. No destructive side effects (only ever adds new future occurrences), so no confirm modal — unlike Archive or Change-pattern. */
function ExtendButton({ series, onUpdated }: { series: EventSeries; onUpdated: (series: EventSeries) => void }) {
  const router = useRouter();
  const extendMutation = useMutation({
    mutationFn: () => extendEventSeries(series.id),
    onSuccess: (data: { event_series: EventSeries }) => {
      onUpdated(data.event_series);
      notifications.show({ color: "blue", message: "Extending the series — generating more occurrences in the background." });
    },
    onError: (error: Error) => {
      if (redirectOnAuthError(error, router)) return;
      notifications.show({ color: "red", message: error.message });
    },
  });

  return (
    <Button
      variant="default"
      size="compact-sm"
      loading={extendMutation.isPending}
      disabled={isGeneratingStatus(series.generation_status)}
      onClick={() => extendMutation.mutate()}
    >
      Extend series
    </Button>
  );
}

/** §4.3 — the only place `generation_status` becomes visible in the actual page content (the top badge in EventSeriesManager is a compact always-there hint; this is the fuller explanation, shown right where the Publish/Extend/Change-pattern actions live). */
function GenerationStatusBanner({ series }: { series: EventSeries }) {
  if (isGeneratingStatus(series.generation_status)) {
    return (
      <Alert color="blue" variant="light" icon={<Loader size="xs" />}>
        <Text size="sm">
          Generating occurrences in the background — this can take a few minutes for a large series. This page will
          update automatically when it&apos;s done.
        </Text>
      </Alert>
    );
  }
  if (series.generation_status === "FAILED") {
    return (
      <Alert color="red" variant="light" title="Generation failed">
        <Text size="sm">
          The last generation attempt failed. It&apos;s safe to try again — check the template (cover image,
          products, location) for anything invalid, then retry.
        </Text>
      </Alert>
    );
  }
  return null;
}

function PublishPanel({ series, onUpdated }: { series: EventSeries; onUpdated: (series: EventSeries) => void }) {
  const router = useRouter();
  const occurrences = useQuery({
    queryKey: ["event-series-occurrences", series.id],
    queryFn: () => listEventSeriesOccurrences(series.id),
    enabled: series.status !== "DRAFT",
  });

  const isGenerating = isGeneratingStatus(series.generation_status);

  const publishMutation = useMutation({
    mutationFn: () => publishEventSeries(series.id),
    onSuccess: (data: { event_series: EventSeries }) => {
      onUpdated(data.event_series);
      notifications.show({ color: "blue", message: "Publishing — generating occurrences in the background. This page will update automatically when it's done." });
    },
    onError: (error: Error) => {
      if (redirectOnAuthError(error, router)) return;
      notifications.show({ color: "red", message: error.message });
    },
  });

  function confirmPublish() {
    modals.openConfirmModal({
      title: "Publish this series?",
      children: <Text size="sm">This generates every occurrence from the schedule and publishes them all together. Review the Recurrence tab&apos;s preview first — this can&apos;t be undone from here.</Text>,
      labels: { confirm: "Publish", cancel: "Cancel" },
      onConfirm: () => publishMutation.mutate(),
    });
  }

  // Once generation completes, series.generation_status flips to
  // COMPLETED via the top-level poll (EventSeriesManager) — refetch the
  // occurrence table right then rather than leaving it stale.
  useEffect(() => {
    if (series.generation_status === "COMPLETED") occurrences.refetch();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [series.generation_status]);

  if (series.status === "DRAFT") {
    return (
      <Card withBorder radius="lg" p="xl">
        <Stack>
          <GenerationStatusBanner series={series} />
          <Text>
            Publishing generates every occurrence from your recurrence schedule, copies your ticket types, questions,
            terms, and cover image onto each one, and makes them all live together.
          </Text>
          <Button style={{ alignSelf: "flex-start" }} loading={publishMutation.isPending} disabled={isGenerating} onClick={confirmPublish}>
            Publish series
          </Button>
        </Stack>
      </Card>
    );
  }

  return (
    <Card withBorder radius="lg" p="xl">
      <Stack>
        <GenerationStatusBanner series={series} />
        <Group justify="space-between">
          <Text fw={500}>{occurrences.data?.occurrences.length ?? 0} occurrences</Text>
          {series.status === "LIVE" && (
            <Group gap="xs">
              <ExtendButton
                series={series}
                onUpdated={(updated) => {
                  onUpdated(updated);
                  occurrences.refetch();
                }}
              />
              <ChangeRecurrencePatternButton
                series={series}
                occurrences={occurrences.data?.occurrences ?? []}
                onUpdated={(updated) => {
                  onUpdated(updated);
                  occurrences.refetch();
                }}
              />
            </Group>
          )}
        </Group>
        <Table>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>#</Table.Th>
              <Table.Th>Date</Table.Th>
              <Table.Th>Status</Table.Th>
              <Table.Th>Public link</Table.Th>
              <Table.Th />
              <Table.Th />
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {occurrences.data?.occurrences.map((occurrence) => (
              <Table.Tr key={occurrence.id}>
                <Table.Td>{occurrence.sequence_number}</Table.Td>
                <Table.Td>{occurrence.occurrence_date}</Table.Td>
                <Table.Td>
                  <Badge size="sm" color={occurrence.occurrence_state === "CANCELLED" ? "red" : "teal"}>
                    {occurrence.occurrence_state ?? occurrence.status}
                  </Badge>
                </Table.Td>
                <Table.Td>
                  <CopyButton value={occurrence.public_occurrence_id ?? ""}>
                    {({ copied, copy }) => (
                      <Anchor component="button" type="button" size="sm" onClick={copy}>
                        {copied ? "Copied" : "Copy ID"}
                      </Anchor>
                    )}
                  </CopyButton>
                </Table.Td>
                <Table.Td>
                  <Anchor component={Link} href={`/events/${occurrence.id}/settings`} size="sm">
                    Manage
                  </Anchor>
                </Table.Td>
                <Table.Td>
                  <OccurrenceActionsMenu series={series} occurrence={occurrence} onUpdated={() => occurrences.refetch()} />
                </Table.Td>
              </Table.Tr>
            ))}
          </Table.Tbody>
        </Table>
      </Stack>
    </Card>
  );
}
