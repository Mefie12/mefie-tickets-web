"use client";

import { useRouter } from "next/navigation";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useForm } from "@mantine/form";
import { Button, Card, MultiSelect, Select, Stack, Text, TextInput, Title } from "@mantine/core";
import { notifications } from "@mantine/notifications";
import { RichTextDescription } from "@/components/RichTextDescription";
import { CurrencySelector } from "@/components/CurrencySelector";
import { ApiError } from "@/lib/authApi";
import { redirectOnAuthError } from "@/lib/authErrorRedirect";
import { createEvent, getEventTaxonomies, type Event, type EventCategory, type EventTaxonomies, type EventTaxonomyItem } from "@/lib/eventApi";

export default function NewEventPage() {
  const router = useRouter();

  const form = useForm({
    initialValues: {
      title: "",
      description: "",
      event_category_id: "",
      event_subcategory_id: "",
      audience_ids: [] as string[],
      attribute_ids: [] as string[],
      currency_code: "",
    },
    validate: {
      title: (v) => (v.trim().length === 0 ? "Title is required" : null),
      description: (v) => (v.replace(/<[^>]*>/g, "").trim().length === 0 ? "Description is required" : null),
    },
  });

  const taxonomies = useQuery<EventTaxonomies>({ queryKey: ["event-taxonomies"], queryFn: getEventTaxonomies });
  const category = taxonomies.data?.categories.find((item: EventCategory) => String(item.id) === form.values.event_category_id);

  const createMutation = useMutation({
    mutationFn: (values: typeof form.values) =>
      createEvent({
        title: values.title,
        description: values.description,
        event_category_id: values.event_category_id ? Number(values.event_category_id) : null,
        event_subcategory_id: values.event_subcategory_id ? Number(values.event_subcategory_id) : null,
        audience_ids: values.audience_ids.map(Number),
        attribute_ids: values.attribute_ids.map(Number),
        currency_code: values.currency_code || undefined,
      }),
    onSuccess: (data: { event: Event }) => router.push(`/events/${data.event.id}?tab=date-time`),
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
    <Stack gap="xl" maw={560}>
      <Title order={2} fz={28}>
        Create an event
      </Title>

      <Card withBorder radius="lg" p="xl">
        <form onSubmit={form.onSubmit((values) => createMutation.mutate(values))}>
          <Stack>
            <TextInput required label="Event title" placeholder="Summer Music Festival" {...form.getInputProps("title")} />
            <RichTextDescription value={form.values.description} onChange={(value) => form.setFieldValue("description", value)} error={form.errors.description} />
            <Select searchable clearable label="Category (optional for drafts)" placeholder="Select a category"
              data={(taxonomies.data?.categories ?? []).map((item: EventCategory) => ({ value: String(item.id), label: item.name }))}
              {...form.getInputProps("event_category_id")}
              onChange={(value) => { form.setFieldValue("event_category_id", value ?? ""); form.setFieldValue("event_subcategory_id", ""); }} />
            <Select searchable clearable disabled={!category} label="Subcategory (optional)" placeholder="Select a subcategory"
              data={(category?.subcategories ?? []).map((item: EventTaxonomyItem) => ({ value: String(item.id), label: item.name }))}
              {...form.getInputProps("event_subcategory_id")} />
            <CurrencySelector
              label="Currency (optional)"
              description="Leave blank to use your organization's existing currency, or the account default."
              {...form.getInputProps("currency_code")}
            />
            <MultiSelect searchable clearable label="Audience (optional)" description="Helps attendees discover events intended for them."
              data={(taxonomies.data?.audiences ?? []).map((item: EventTaxonomyItem) => ({ value: String(item.id), label: item.name }))}
              {...form.getInputProps("audience_ids")} />
            <MultiSelect searchable clearable label="Accessibility & event attributes (optional)" description="Highlight accessibility, facilities, format, and special access."
              data={(taxonomies.data?.attributes ?? []).map((item: EventTaxonomyItem) => ({ value: String(item.id), label: item.name }))}
              {...form.getInputProps("attribute_ids")} />

            <Button type="submit" loading={createMutation.isPending} mt="sm">
              Save and continue
            </Button>
            <Text size="xs" c="dimmed">
              Your event will be saved as a draft. Next, you&apos;ll configure its date and time.
            </Text>
          </Stack>
        </form>
      </Card>
    </Stack>
  );
}
