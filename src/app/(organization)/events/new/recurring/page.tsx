"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useForm } from "@mantine/form";
import { Anchor, Button, Card, Group, Stack, Text, Title } from "@mantine/core";
import { notifications } from "@mantine/notifications";
import { EventDetailsFields } from "@/components/EventDetailsFields";
import { DEFAULT_RECURRENCE_VALUES, RecurrenceRuleEditor, toRecurrenceRuleInput, type RecurrenceFormValues } from "@/components/RecurrenceRuleEditor";
import { ApiError } from "@/lib/authApi";
import { redirectOnAuthError } from "@/lib/authErrorRedirect";
import { getEventTaxonomies, type EventTaxonomies } from "@/lib/eventApi";
import { createEventSeries, type EventSeries } from "@/lib/eventSeriesApi";

export default function NewRecurringEventPage() {
  const router = useRouter();
  const [startsOn, setStartsOn] = useState("");
  const [recurrence, setRecurrence] = useState<RecurrenceFormValues>(DEFAULT_RECURRENCE_VALUES);

  const taxonomies = useQuery<EventTaxonomies>({ queryKey: ["event-taxonomies"], queryFn: getEventTaxonomies });

  const form = useForm({
    initialValues: {
      title: "",
      description: "",
      event_category_id: "",
      event_subcategory_id: "",
    },
    validate: {
      title: (v) => (v.trim().length === 0 ? "Title is required" : null),
      description: (v) => (v.replace(/<[^>]*>/g, "").trim().length === 0 ? "Description is required" : null),
    },
  });

  const createMutation = useMutation({
    mutationFn: (values: typeof form.values) =>
      createEventSeries({
        title: values.title,
        description: values.description,
        starts_on: startsOn,
        recurrence: toRecurrenceRuleInput(recurrence),
        event_category_id: values.event_category_id ? Number(values.event_category_id) : null,
        event_subcategory_id: values.event_subcategory_id ? Number(values.event_subcategory_id) : null,
      }),
    onSuccess: (data: { event_series: EventSeries }) => router.push(`/event-series/${data.event_series.id}?tab=location`),
    onError: (error: Error) => {
      if (redirectOnAuthError(error, router)) return;
      if (error instanceof ApiError && error.errors) {
        form.setErrors(Object.fromEntries(Object.entries(error.errors).map(([field, messages]) => [field, messages[0]])));
      } else {
        notifications.show({ color: "red", message: error.message });
      }
    },
  });

  return (
    <Stack gap="xl" maw={560}>
      <Group justify="space-between" align="flex-end">
        <Title order={2} fz={28}>
          Create a recurring event
        </Title>
        <Anchor component={Link} href="/events/new" size="sm">
          Create a single event instead
        </Anchor>
      </Group>
      <Text c="dimmed" mt={-16}>
        Configure it once — new dates are generated automatically from the schedule below, and you can extend the
        series later without starting over.
      </Text>

      <Card withBorder radius="lg" p="xl">
        <form onSubmit={form.onSubmit((values) => createMutation.mutate(values))}>
          <Stack>
            <EventDetailsFields
              values={form.values}
              onChange={(field, value) => form.setFieldValue(field, value as never)}
              errors={form.errors}
              categories={taxonomies.data?.categories ?? []}
              currentCategory={null}
              currentSubcategory={null}
              titleLabel="Series title"
              categoryLabel="Category (optional for drafts)"
            />

            <Title order={5} mt="md">
              Recurrence schedule
            </Title>
            <RecurrenceRuleEditor values={recurrence} onChange={setRecurrence} startsOn={startsOn} onStartsOnChange={setStartsOn} />

            <Button type="submit" mt="sm" loading={createMutation.isPending} disabled={!startsOn}>
              Save and continue
            </Button>
            <Text size="xs" c="dimmed">
              Your series will be saved as a draft. Next, you&apos;ll add location, tickets, and questions before
              publishing.
            </Text>
          </Stack>
        </form>
      </Card>
    </Stack>
  );
}
