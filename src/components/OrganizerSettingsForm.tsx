"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation } from "@tanstack/react-query";
import { useForm } from "@mantine/form";
import {
  Avatar,
  Badge,
  Box,
  Button,
  Card,
  Divider,
  Group,
  Stack,
  Switch,
  Text,
  Textarea,
  TextInput,
  Title,
} from "@mantine/core";
import { IconCamera, IconPhoto } from "@tabler/icons-react";
import { notifications } from "@mantine/notifications";
import { ApiError } from "@/lib/authApi";
import { redirectOnAuthError } from "@/lib/authErrorRedirect";
import {
  type Organizer,
  updateOrganizer,
  uploadOrganizerCoverImage,
  uploadOrganizerLogo,
} from "@/lib/organizerApi";

export function OrganizerSettingsForm({
  initialOrganizer,
  canEdit,
}: {
  initialOrganizer: Organizer;
  canEdit: boolean;
}) {
  const [organizer, setOrganizer] = useState(initialOrganizer);
  const router = useRouter();

  const form = useForm({
    initialValues: {
      name: organizer.name,
      email: organizer.email,
      description: organizer.description ?? "",
      address_line1: organizer.address?.address_line1 ?? "",
      city: organizer.address?.city ?? "",
      state: organizer.address?.state ?? "",
      postal_code: organizer.address?.postal_code ?? "",
      country: organizer.address?.country ?? "",
      tax_pass_through: organizer.tax_pass_through,
      fee_pass_through: organizer.fee_pass_through,
    },
    validate: {
      name: (v) => (v.trim().length === 0 ? "Name is required" : null),
      email: (v) => (/^\S+@\S+\.\S+$/.test(v) ? null : "Enter a valid email"),
    },
  });

  const updateMutation = useMutation({
    mutationFn: (values: typeof form.values) =>
      updateOrganizer(organizer.id, {
        name: values.name,
        email: values.email,
        description: values.description || null,
        address: {
          address_line1: values.address_line1 || null,
          city: values.city || null,
          state: values.state || null,
          postal_code: values.postal_code || null,
          country: values.country || null,
        },
        tax_pass_through: values.tax_pass_through,
        fee_pass_through: values.fee_pass_through,
      }),
    onSuccess: (data: { organizer: Organizer }) => {
      setOrganizer(data.organizer);
      notifications.show({ color: "teal", message: "Organizer updated." });
    },
    onError: (error: Error) => {
      if (redirectOnAuthError(error, router)) return;
      notifications.show({
        color: "red",
        message: error instanceof ApiError ? error.message : "Something went wrong.",
      });
    },
  });

  return (
    <Stack gap="xl" maw={640}>
      <Group justify="space-between">
        <Title order={2} fz={28}>
          {organizer.name}
        </Title>
        <Badge variant="light">/{organizer.slug}</Badge>
      </Group>

      <BrandingCard organizer={organizer} canEdit={canEdit} onUpdated={setOrganizer} />

      <Card withBorder radius="lg" p="xl">
        <form onSubmit={form.onSubmit((values) => updateMutation.mutate(values))}>
          <fieldset disabled={!canEdit} style={{ border: 0, padding: 0, margin: 0 }}>
            <Stack>
              <TextInput label="Organizer name" {...form.getInputProps("name")} />
              <TextInput label="Contact email" {...form.getInputProps("email")} />
              <Textarea label="Description" autosize minRows={2} {...form.getInputProps("description")} />

              <Divider label="Location" labelPosition="left" mt="sm" />
              <TextInput label="Address" {...form.getInputProps("address_line1")} />
              <TextInput label="City" {...form.getInputProps("city")} />
              <TextInput label="State / Region" {...form.getInputProps("state")} />
              <TextInput label="Postal code" {...form.getInputProps("postal_code")} />
              <TextInput label="Country" {...form.getInputProps("country")} />

              <Divider label="Payment settings" labelPosition="left" mt="sm" />
              <Text size="xs" c="dimmed" mt={-8}>
                Temporary, MVP-only setting — see the platform payment model notes. Defaults to charging the buyer;
                switch off to absorb the cost out of your payout instead.
              </Text>
              <Switch
                label="Pass tax on to attendees"
                description="On: tax is added to the buyer's total. Off: absorbed from your payout."
                {...form.getInputProps("tax_pass_through", { type: "checkbox" })}
              />
              <Switch
                label="Pass platform fee on to attendees"
                description="On: the platform fee is added to the buyer's total. Off: absorbed from your payout."
                {...form.getInputProps("fee_pass_through", { type: "checkbox" })}
              />

              {canEdit && (
                <Button type="submit" loading={updateMutation.isPending} style={{ alignSelf: "flex-start" }}>
                  Save changes
                </Button>
              )}
            </Stack>
          </fieldset>
        </form>
      </Card>
    </Stack>
  );
}

function BrandingCard({
  organizer,
  canEdit,
  onUpdated,
}: {
  organizer: Organizer;
  canEdit: boolean;
  onUpdated: (organizer: Organizer) => void;
}) {
  const logoInputRef = useRef<HTMLInputElement>(null);
  const coverInputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  const logoMutation = useMutation({
    mutationFn: (file: File) => uploadOrganizerLogo(organizer.id, file),
    onSuccess: (data: { organizer: Organizer }) => onUpdated(data.organizer),
    onError: (error: Error) => {
      if (redirectOnAuthError(error, router)) return;
      notifications.show({ color: "red", message: error.message });
    },
  });

  const coverMutation = useMutation({
    mutationFn: (file: File) => uploadOrganizerCoverImage(organizer.id, file),
    onSuccess: (data: { organizer: Organizer }) => onUpdated(data.organizer),
    onError: (error: Error) => {
      if (redirectOnAuthError(error, router)) return;
      notifications.show({ color: "red", message: error.message });
    },
  });

  return (
    <Card withBorder radius="lg" p={0} style={{ overflow: "hidden" }}>
      <Box
        pos="relative"
        h={160}
        style={{
          backgroundColor: "var(--mantine-color-dark-5)",
          backgroundImage: organizer.cover_image_url ? `url(${organizer.cover_image_url})` : undefined,
          backgroundSize: "cover",
          backgroundPosition: "center",
        }}
      >
        {canEdit && (
          <>
            <Button
              size="xs"
              variant="white"
              color="dark"
              pos="absolute"
              top={12}
              right={12}
              leftSection={<IconPhoto size={14} />}
              loading={coverMutation.isPending}
              onClick={() => coverInputRef.current?.click()}
            >
              Change cover
            </Button>
            <input
              ref={coverInputRef}
              type="file"
              accept="image/png,image/jpeg,image/webp"
              hidden
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) coverMutation.mutate(file);
                e.target.value = "";
              }}
            />
          </>
        )}

        <Box pos="absolute" bottom={-32} left={20}>
          <Avatar src={organizer.logo_url} size={80} radius="lg" color="brand" style={{ border: "3px solid var(--mantine-color-body)" }}>
            {organizer.name[0]}
          </Avatar>
          {canEdit && (
            <>
              <Button
                size="compact-xs"
                variant="white"
                color="dark"
                pos="absolute"
                bottom={-6}
                right={-6}
                p={4}
                loading={logoMutation.isPending}
                onClick={() => logoInputRef.current?.click()}
              >
                <IconCamera size={14} />
              </Button>
              <input
                ref={logoInputRef}
                type="file"
                accept="image/png,image/jpeg,image/webp"
                hidden
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) logoMutation.mutate(file);
                  e.target.value = "";
                }}
              />
            </>
          )}
        </Box>
      </Box>
      <Box h={40} />
      {!canEdit && (
        <Text size="xs" c="dimmed" px="md" pb="sm">
          Only account admins can edit branding.
        </Text>
      )}
    </Card>
  );
}
