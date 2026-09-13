"use client";

import { useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useForm } from "@mantine/form";
import { Anchor, Button, Card, Group, MultiSelect, Stack, Text, TextInput, Title } from "@mantine/core";
import { notifications } from "@mantine/notifications";
import { CurrencySelector } from "@/components/CurrencySelector";
import { PaymentCurrencyExplainer } from "@/components/PaymentCurrencyExplainer";
import { EventDetailsFields } from "@/components/EventDetailsFields";
import { getOrganizationPaymentCurrency } from "@/lib/paymentAccountApi";
import { ApiError } from "@/lib/authApi";
import { redirectOnAuthError } from "@/lib/authErrorRedirect";
import { createEvent, getEventTaxonomies, type Event, type EventTaxonomies, type EventTaxonomyItem } from "@/lib/eventApi";

export default function NewEventPage() {
  const router = useRouter();
  const paymentCurrency = useQuery({ queryKey: ["organization-payment-currency"], queryFn: getOrganizationPaymentCurrency });

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

  // Once a payment account exists, currency is derived server-side —
  // see EventService::resolveCurrencyCode() — so it's sent along
  // automatically rather than left for the organizer to pick.
  useEffect(() => {
    if (paymentCurrency.data) form.setFieldValue("currency_code", paymentCurrency.data);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paymentCurrency.data]);

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
    onSuccess: (data: { event: Event }) => router.push(`/events/${data.event.id}/settings?tab=date-time`),
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
      <Group justify="space-between" align="flex-end">
        <Title order={2} fz={28}>
          Create an event
        </Title>
        <Anchor component={Link} href="/events/new/recurring" size="sm">
          Create a recurring event instead
        </Anchor>
      </Group>

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
              categoryLabel="Category (optional for drafts)"
            />
            {paymentCurrency.data ? (
              <TextInput
                label="Currency"
                value={`${paymentCurrency.data} — set by your payment setup`}
                disabled
                description={
                  <>
                    Every event settles in your organization&apos;s payment currency. <PaymentCurrencyExplainer />
                  </>
                }
              />
            ) : (
              <CurrencySelector
                label="Currency (optional)"
                description="No payment setup yet — this is provisional and will be locked to whatever currency you eventually set up payments in."
                {...form.getInputProps("currency_code")}
              />
            )}
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
