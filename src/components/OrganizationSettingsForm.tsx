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
  Modal,
  Stack,
  Switch,
  Text,
  Textarea,
  TextInput,
  Title,
} from "@mantine/core";
import { IconCamera, IconPhoto } from "@tabler/icons-react";
import { notifications } from "@mantine/notifications";
import { isValidPhoneNumber } from "libphonenumber-js";
import { CountrySelector } from "@/components/CountrySelector";
import { PhoneInput } from "@/components/PhoneInput";
import { ApiError } from "@/lib/authApi";
import { redirectOnAuthError } from "@/lib/authErrorRedirect";
import {
  changeOrganizationSlug,
  type Organization,
  updateOrganization,
  uploadOrganizationCoverImage,
  uploadOrganizationLogo,
} from "@/lib/organizationApi";
import { PublicShareCard } from "@/components/PublicShareCard";

export function OrganizationSettingsForm({
  initialOrganization,
  canEdit,
  appUrl,
}: {
  initialOrganization: Organization;
  canEdit: boolean;
  appUrl: string;
}) {
  const [organization, setOrganization] = useState(initialOrganization);
  const router = useRouter();

  const form = useForm({
    initialValues: {
      name: organization.name,
      email: organization.email,
      phone: organization.phone ?? "",
      description: organization.description ?? "",
      address_line1: organization.address?.address_line1 ?? "",
      city: organization.address?.city ?? "",
      state: organization.address?.state ?? "",
      postal_code: organization.address?.postal_code ?? "",
      country: organization.address?.country ?? "",
      tax_pass_through: organization.tax_pass_through,
      fee_pass_through: organization.fee_pass_through,
    },
    validate: {
      name: (v) => (v.trim().length === 0 ? "Name is required" : null),
      email: (v) => (/^\S+@\S+\.\S+$/.test(v) ? null : "Enter a valid email"),
      phone: (v) => (v.trim() && !isValidPhoneNumber(v) ? "Enter a valid phone number" : null),
    },
  });

  const updateMutation = useMutation({
    mutationFn: (values: typeof form.values) =>
      updateOrganization({
        name: values.name,
        email: values.email,
        phone: values.phone || null,
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
    onSuccess: (data: { organization: Organization }) => {
      setOrganization(data.organization);
      notifications.show({ color: "teal", message: "Organization updated." });
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
          {organization.name}
        </Title>
        <Badge variant="light">/{organization.slug}</Badge>
      </Group>

      <PublicShareCard
        url={`${appUrl}/${organization.slug}`}
        title={`${organization.name} events`}
        text={`Discover events from ${organization.name}.`}
        enabled
      />

      <BrandingCard organization={organization} canEdit={canEdit} onUpdated={setOrganization} />

      <Card withBorder radius="lg" p="xl">
        <form onSubmit={form.onSubmit((values) => updateMutation.mutate(values))}>
          <fieldset disabled={!canEdit} style={{ border: 0, padding: 0, margin: 0 }}>
            <Stack>
              <TextInput label="Organization name" {...form.getInputProps("name")} />
              <TextInput label="Contact email" type="email" {...form.getInputProps("email")} />
              <PhoneInput label="Phone" {...form.getInputProps("phone")} />
              <Textarea label="Description" autosize minRows={2} {...form.getInputProps("description")} />

              <Divider label="Location" labelPosition="left" mt="sm" />
              <TextInput label="Address" {...form.getInputProps("address_line1")} />
              <TextInput label="City" {...form.getInputProps("city")} />
              <TextInput label="State / Region" {...form.getInputProps("state")} />
              <TextInput label="Postal code" {...form.getInputProps("postal_code")} />
              <CountrySelector label="Country" {...form.getInputProps("country")} />

              <Divider label="Payment settings" labelPosition="left" mt="sm" />
              <Text size="xs" c="dimmed" mt={-8}>
                Choose who pays Mefie&apos;s service fee. Card-processing fees are separate and are charged to your connected payment account.
              </Text>
              <Switch
                label="Pass tax on to attendees"
                description="On: tax is added to the buyer's total. Off: absorbed from your payout."
                {...form.getInputProps("tax_pass_through", { type: "checkbox" })}
              />
              <Switch
                label="Pass Mefie service fee on to attendees"
                description="On: the Mefie service fee is added to the buyer's total. Off: your organization absorbs it. Mefie service fees are normally non-refundable."
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

      {canEdit && <AdvancedSlugCard organization={organization} onUpdated={setOrganization} />}
    </Stack>
  );
}

/**
 * Deliberately its own card, visually separated from the profile form
 * above: the slug is immutable through normal edits (see
 * organizationApi.ts's changeOrganizationSlug) — changing it is a rare,
 * deliberate action with real consequences (it's the org's public URL
 * segment), not just another profile field.
 */
function AdvancedSlugCard({
  organization,
  onUpdated,
}: {
  organization: Organization;
  onUpdated: (organization: Organization) => void;
}) {
  const [opened, setOpened] = useState(false);
  const router = useRouter();

  const form = useForm({
    initialValues: { slug: organization.slug },
    validate: {
      slug: (v) => (v.trim().length === 0 ? "Slug is required" : null),
    },
  });

  const slugMutation = useMutation({
    mutationFn: (slug: string) => changeOrganizationSlug(slug),
    onSuccess: (data: { organization: Organization }) => {
      onUpdated(data.organization);
      setOpened(false);
      notifications.show({ color: "teal", message: "Organization URL updated." });
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
      <Stack gap="xs">
        <Text fw={600}>Advanced</Text>
        <Group justify="space-between" align="flex-end" wrap="wrap">
          <Stack gap={0}>
            <Text size="sm">Organization URL</Text>
            <Text size="sm" c="dimmed">
              /{organization.slug}
            </Text>
          </Stack>
          <Button
            disabled={organization.public_url_locked_at !== null}
            variant="light"
            size="xs"
            onClick={() => {
              form.setValues({ slug: organization.slug });
              setOpened(true);
            }}
          >
            Change URL
          </Button>
        </Group>
        <Text size="xs" c="dimmed">
          {organization.public_url_locked_at
            ? "This URL is permanently locked because this organization has published an event."
            : "Changing this changes the public link to every event page under this organization. Existing links using the old URL will stop working."}
        </Text>
      </Stack>

      <Modal opened={opened} onClose={() => setOpened(false)} title="Change organization URL">
        <form onSubmit={form.onSubmit((values) => slugMutation.mutate(values.slug))}>
          <Stack>
            <TextInput label="Slug" description="Letters, numbers, and hyphens only." {...form.getInputProps("slug")} />
            <Group justify="flex-end" mt="sm">
              <Button type="button" variant="subtle" onClick={() => setOpened(false)}>
                Cancel
              </Button>
              <Button type="submit" loading={slugMutation.isPending}>
                Save
              </Button>
            </Group>
          </Stack>
        </form>
      </Modal>
    </Card>
  );
}

function BrandingCard({
  organization,
  canEdit,
  onUpdated,
}: {
  organization: Organization;
  canEdit: boolean;
  onUpdated: (organization: Organization) => void;
}) {
  const logoInputRef = useRef<HTMLInputElement>(null);
  const coverInputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  const logoMutation = useMutation({
    mutationFn: (file: File) => uploadOrganizationLogo(file),
    onSuccess: (data: { organization: Organization }) => onUpdated(data.organization),
    onError: (error: Error) => {
      if (redirectOnAuthError(error, router)) return;
      notifications.show({ color: "red", message: error.message });
    },
  });

  const coverMutation = useMutation({
    mutationFn: (file: File) => uploadOrganizationCoverImage(file),
    onSuccess: (data: { organization: Organization }) => onUpdated(data.organization),
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
          backgroundImage: organization.cover_image_url ? `url(${organization.cover_image_url})` : undefined,
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
          <Avatar
            src={organization.logo_url}
            size={80}
            radius="lg"
            color="brand"
            style={{ border: "3px solid var(--mantine-color-body)" }}
          >
            {organization.name[0]}
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
          Only organization admins can edit branding.
        </Text>
      )}
    </Card>
  );
}
