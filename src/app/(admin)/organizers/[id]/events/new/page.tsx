"use client";

import { use } from "react";
import { useRouter } from "next/navigation";
import { useMutation } from "@tanstack/react-query";
import { useForm } from "@mantine/form";
import { Button, Card, Divider, Stack, Switch, Text, TextInput, Title } from "@mantine/core";
import { notifications } from "@mantine/notifications";
import { ApiError } from "@/lib/authApi";
import { redirectOnAuthError } from "@/lib/authErrorRedirect";
import { createEvent, type Event } from "@/lib/eventApi";

export default function NewEventPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const organizerId = Number(id);
  const router = useRouter();

  const form = useForm({
    initialValues: {
      title: "",
      start_date: "",
      end_date: "",
      venue_name: "",
      address_line1: "",
      address_line2: "",
      city: "",
      state: "",
      postal_code: "",
      country: "",
      is_online: false,
      online_url: "",
    },
    validate: {
      title: (v) => (v.trim().length === 0 ? "Title is required" : null),
      start_date: (v) => (v.trim().length === 0 ? "Start date/time is required" : null),
      end_date: (v, values) =>
        v.trim().length === 0
          ? "End date/time is required"
          : new Date(v) < new Date(values.start_date)
            ? "End must be after start"
            : null,
      online_url: (v, values) => (values.is_online && v.trim().length === 0 ? "Online link is required" : null),
    },
  });

  const createMutation = useMutation({
    mutationFn: (values: typeof form.values) =>
      createEvent({
        organizer_id: organizerId,
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
    onSuccess: (data: { event: Event }) => router.push(`/organizers/${organizerId}/events/${data.event.id}`),
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
            <TextInput label="Event title" placeholder="Summer Music Festival" {...form.getInputProps("title")} />
            <TextInput type="datetime-local" label="Starts" {...form.getInputProps("start_date")} />
            <TextInput type="datetime-local" label="Ends" {...form.getInputProps("end_date")} />

            <Divider label="Location" labelPosition="left" mt="sm" />
            <Switch
              label="This is an online event"
              {...form.getInputProps("is_online", { type: "checkbox" })}
            />

            {form.values.is_online ? (
              <TextInput
                label="Online event link"
                placeholder="https://zoom.us/..."
                {...form.getInputProps("online_url")}
              />
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

            <Button type="submit" loading={createMutation.isPending} mt="sm">
              Create event
            </Button>
            <Text size="xs" c="dimmed">
              New events start as drafts. You can add tickets and questions, then publish it when ready.
            </Text>
          </Stack>
        </form>
      </Card>
    </Stack>
  );
}
