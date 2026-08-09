"use client";

import { useRouter } from "next/navigation";
import { useMutation } from "@tanstack/react-query";
import { useForm } from "@mantine/form";
import { Button, Group, Select, Stack, TextInput } from "@mantine/core";
import { notifications } from "@mantine/notifications";
import { isValidPhoneNumber } from "libphonenumber-js";
import { ApiError, type Role } from "@/lib/authApi";
import { redirectOnAuthError } from "@/lib/authErrorRedirect";
import { INVITABLE_ROLES, inviteTeammate } from "@/lib/teamApi";
import { PhoneInput } from "@/components/PhoneInput";

type InviteFormValues = {
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  role: string;
};

export type InvitedTeammate = {
  id: number;
  email: string;
  first_name: string;
  last_name: string;
  phone: string | null;
  role: Role;
  expires_at: string;
};

/**
 * The invite-a-teammate form, shared verbatim by the standalone Team
 * page (in a Modal) and the onboarding wizard's step 2 (inline) — one
 * copy of the fields/validation/mutation so the two call sites can never
 * drift apart. `role` is a Select over INVITABLE_ROLES rather than a
 * hardcoded single option, so widening the allow-list later (see
 * teamApi.ts) is a one-line change here too.
 */
export function InviteOrganizerForm({
  onSuccess,
  onCancel,
  submitLabel = "Send invitation",
}: {
  onSuccess: (invitation: InvitedTeammate) => void;
  onCancel?: () => void;
  submitLabel?: string;
}) {
  const router = useRouter();

  const form = useForm<InviteFormValues>({
    initialValues: {
      first_name: "",
      last_name: "",
      email: "",
      phone: "",
      role: INVITABLE_ROLES[0]?.value ?? "ORGANIZER",
    },
    validate: {
      first_name: (v) => (v.trim().length === 0 ? "First name is required" : null),
      last_name: (v) => (v.trim().length === 0 ? "Last name is required" : null),
      email: (v) => (/^\S+@\S+\.\S+$/.test(v) ? null : "Enter a valid email"),
      phone: (v) => (v.trim() && !isValidPhoneNumber(v) ? "Enter a valid phone number" : null),
      role: (v) => (!v ? "Role is required" : null),
    },
  });

  const inviteMutation = useMutation({
    mutationFn: (values: InviteFormValues) =>
      inviteTeammate({
        first_name: values.first_name,
        last_name: values.last_name,
        email: values.email,
        phone: values.phone || undefined,
        role: values.role,
      }),
    onSuccess: (data: { invitation: InvitedTeammate }) => {
      notifications.show({ color: "teal", message: `Invitation sent to ${form.values.email}.` });
      form.reset();
      onSuccess(data.invitation);
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
    <form onSubmit={form.onSubmit((values) => inviteMutation.mutate(values))}>
      <Stack>
        <Group grow>
          <TextInput label="First name" placeholder="Ada" {...form.getInputProps("first_name")} />
          <TextInput label="Last name" placeholder="Lovelace" {...form.getInputProps("last_name")} />
        </Group>
        <TextInput label="Email" type="email" placeholder="ada@example.com" {...form.getInputProps("email")} />
        <PhoneInput label="Phone (optional)" {...form.getInputProps("phone")} />
        <Select
          label="Role"
          data={INVITABLE_ROLES}
          allowDeselect={false}
          {...form.getInputProps("role")}
        />
        <Group justify="flex-end" mt="sm">
          {onCancel && (
            <Button type="button" variant="subtle" onClick={onCancel}>
              Cancel
            </Button>
          )}
          <Button type="submit" loading={inviteMutation.isPending}>
            {submitLabel}
          </Button>
        </Group>
      </Stack>
    </form>
  );
}
