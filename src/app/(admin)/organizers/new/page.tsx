"use client";

import { useRouter } from "next/navigation";
import { useMutation } from "@tanstack/react-query";
import { useForm } from "@mantine/form";
import {
  Button,
  Card,
  Divider,
  Stack,
  Text,
  Textarea,
  TextInput,
  Title,
} from "@mantine/core";
import { notifications } from "@mantine/notifications";
import { ApiError } from "@/lib/authApi";
import { redirectOnAuthError } from "@/lib/authErrorRedirect";
import { createOrganizer, type Organizer } from "@/lib/organizerApi";

export default function NewOrganizerPage() {
  const router = useRouter();

  const form = useForm({
    initialValues: {
      name: "",
      email: "",
      description: "",
      address_line1: "",
      city: "",
      state: "",
      postal_code: "",
      country: "",
    },
    validate: {
      name: (v) => (v.trim().length === 0 ? "Name is required" : null),
      email: (v) => (/^\S+@\S+\.\S+$/.test(v) ? null : "Enter a valid email"),
    },
  });

  const createMutation = useMutation({
    mutationFn: (values: typeof form.values) =>
      createOrganizer({
        name: values.name,
        email: values.email,
        description: values.description || undefined,
        address: {
          address_line1: values.address_line1 || null,
          city: values.city || null,
          state: values.state || null,
          postal_code: values.postal_code || null,
          country: values.country || null,
        },
      }),
    onSuccess: (data: { organizer: Organizer }) => router.push(`/organizers/${data.organizer.id}`),
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
    <Stack gap="xl" maw={520}>
      <Title order={2} fz={28}>
        Create an organizer
      </Title>

      <Card withBorder radius="lg" p="xl">
        <form onSubmit={form.onSubmit((values) => createMutation.mutate(values))}>
          <Stack>
            <TextInput label="Organizer name" placeholder="Acme Live Events" {...form.getInputProps("name")} />
            <TextInput label="Contact email" placeholder="contact@acme.com" {...form.getInputProps("email")} />
            <Textarea label="Description" placeholder="What does this organizer do?" autosize minRows={2} {...form.getInputProps("description")} />

            <Divider label="Location (optional)" labelPosition="left" mt="sm" />
            <TextInput label="Address" placeholder="123 Main St" {...form.getInputProps("address_line1")} />
            <TextInput label="City" {...form.getInputProps("city")} />
            <TextInput label="State / Region" {...form.getInputProps("state")} />
            <TextInput label="Postal code" {...form.getInputProps("postal_code")} />
            <TextInput label="Country" {...form.getInputProps("country")} />

            <Button type="submit" loading={createMutation.isPending} mt="sm">
              Create organizer
            </Button>
            <Text size="xs" c="dimmed">
              You can add a logo and cover image after creating the organizer.
            </Text>
          </Stack>
        </form>
      </Card>
    </Stack>
  );
}
