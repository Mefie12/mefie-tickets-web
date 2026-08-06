"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useForm } from "@mantine/form";
import {
  Badge,
  Button,
  Card,
  Divider,
  Group,
  SegmentedControl,
  Stack,
  Switch,
  Tabs,
  Text,
  TextInput,
  Title,
} from "@mantine/core";
import { IconArrowLeft } from "@tabler/icons-react";
import { notifications } from "@mantine/notifications";
import { ApiError } from "@/lib/authApi";
import { redirectOnAuthError } from "@/lib/authErrorRedirect";
import { type Event, type EventStatus, updateEvent, updateEventStatus } from "@/lib/eventApi";
import type { Product } from "@/lib/productApi";
import type { Question } from "@/lib/questionApi";
import { ProductsEditor } from "@/components/ProductsEditor";
import { QuestionsEditor } from "@/components/QuestionsEditor";

const STATUS_COLOR: Record<EventStatus, string> = {
  DRAFT: "gray",
  LIVE: "teal",
  ARCHIVED: "dark",
};

export function EventManager({
  organizerId,
  initialEvent,
  initialProducts,
  initialQuestions,
}: {
  organizerId: number;
  initialEvent: Event;
  initialProducts: Product[];
  initialQuestions: Question[];
}) {
  const [event, setEvent] = useState(initialEvent);
  const archived = event.status === "ARCHIVED";
  const router = useRouter();

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
          href={`/organizers/${organizerId}/events`}
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
          <Badge color={STATUS_COLOR[event.status]} variant="light">
            {event.status}
          </Badge>
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

      <Tabs defaultValue="details">
        <Tabs.List>
          <Tabs.Tab value="details">Details</Tabs.Tab>
          <Tabs.Tab value="tickets">Tickets &amp; Pricing</Tabs.Tab>
          <Tabs.Tab value="questions">Questions</Tabs.Tab>
        </Tabs.List>

        <Tabs.Panel value="details" pt="lg">
          <EventDetailsForm event={event} onUpdated={setEvent} disabled={archived} />
        </Tabs.Panel>
        <Tabs.Panel value="tickets" pt="lg">
          <ProductsEditor eventId={event.id} initialProducts={initialProducts} disabled={archived} />
        </Tabs.Panel>
        <Tabs.Panel value="questions" pt="lg">
          <QuestionsEditor eventId={event.id} initialQuestions={initialQuestions} disabled={archived} />
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
  const loc = event.location_details;
  const router = useRouter();

  const form = useForm({
    initialValues: {
      title: event.title,
      start_date: toDatetimeLocal(event.start_date),
      end_date: toDatetimeLocal(event.end_date),
      venue_name: loc?.venue_name ?? "",
      address_line1: loc?.address_line1 ?? "",
      address_line2: loc?.address_line2 ?? "",
      city: loc?.city ?? "",
      state: loc?.state ?? "",
      postal_code: loc?.postal_code ?? "",
      country: loc?.country ?? "",
      is_online: loc?.is_online ?? false,
      online_url: loc?.online_url ?? "",
    },
    validate: {
      title: (v) => (v.trim().length === 0 ? "Title is required" : null),
      end_date: (v, values) => (new Date(v) < new Date(values.start_date) ? "End must be after start" : null),
    },
  });

  const updateMutation = useMutation({
    mutationFn: (values: typeof form.values) =>
      updateEvent(event.id, {
        title: values.title,
        start_date: new Date(values.start_date).toISOString(),
        end_date: new Date(values.end_date).toISOString(),
        location: {
          venue_name: values.venue_name || null,
          address_line1: values.address_line1 || null,
          address_line2: values.address_line2 || null,
          city: values.city || null,
          state: values.state || null,
          postal_code: values.postal_code || null,
          country: values.country || null,
          is_online: values.is_online,
          online_url: values.online_url || null,
        },
      }),
    onSuccess: (data: { event: Event }) => {
      onUpdated(data.event);
      notifications.show({ color: "teal", message: "Event updated." });
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
            <TextInput label="Event title" {...form.getInputProps("title")} />
            <TextInput type="datetime-local" label="Starts" {...form.getInputProps("start_date")} />
            <TextInput type="datetime-local" label="Ends" {...form.getInputProps("end_date")} />

            <Divider label="Location" labelPosition="left" mt="sm" />
            <Switch label="This is an online event" {...form.getInputProps("is_online", { type: "checkbox" })} />

            {form.values.is_online ? (
              <TextInput label="Online event link" {...form.getInputProps("online_url")} />
            ) : (
              <>
                <TextInput label="Venue name" {...form.getInputProps("venue_name")} />
                <TextInput label="Address" {...form.getInputProps("address_line1")} />
                <TextInput label="Address line 2" {...form.getInputProps("address_line2")} />
                <TextInput label="City" {...form.getInputProps("city")} />
                <TextInput label="State / Region" {...form.getInputProps("state")} />
                <TextInput label="Postal code" {...form.getInputProps("postal_code")} />
                <TextInput label="Country" {...form.getInputProps("country")} />
              </>
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

/** datetime-local inputs need "YYYY-MM-DDTHH:mm" in local time, not an ISO/UTC string. */
function toDatetimeLocal(isoString: string): string {
  const d = new Date(isoString);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
