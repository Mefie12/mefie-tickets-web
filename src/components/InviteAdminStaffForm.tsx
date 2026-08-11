"use client";

import { useRouter } from "next/navigation";
import { useMutation } from "@tanstack/react-query";
import { useForm } from "@mantine/form";
import { Button, Group, Select, Stack, TextInput } from "@mantine/core";
import { notifications } from "@mantine/notifications";
import { ApiError, type PlatformRole } from "@/lib/authApi";
import { redirectOnAdminAuthError } from "@/lib/adminAuthErrorRedirect";
import { INVITABLE_PLATFORM_ROLES, inviteAdminStaff } from "@/lib/platformAdminUsersApi";

type FormValues = { first_name: string; last_name: string; email: string; role: PlatformRole };

export type InvitedAdminStaff = {
  id: number;
  first_name: string;
  last_name: string;
  email: string;
  role: PlatformRole;
  expires_at: string;
};

export function InviteAdminStaffForm({
  onSuccess,
  onCancel,
}: {
  onSuccess: (invitation: InvitedAdminStaff) => void;
  onCancel?: () => void;
}) {
  const router = useRouter();

  const form = useForm<FormValues>({
    initialValues: { first_name: "", last_name: "", email: "", role: "PLATFORM_SUPPORT" },
    validate: {
      first_name: (v) => (v.trim().length === 0 ? "First name is required" : null),
      last_name: (v) => (v.trim().length === 0 ? "Last name is required" : null),
      email: (v) => (/^\S+@\S+\.\S+$/.test(v) ? null : "Enter a valid email"),
      role: (v) => (!v ? "Role is required" : null),
    },
  });

  const inviteMutation = useMutation({
    mutationFn: (values: FormValues) => inviteAdminStaff(values),
    onSuccess: (data: { invitation: InvitedAdminStaff }) => {
      notifications.show({ color: "teal", message: `Invitation sent to ${form.values.email}.` });
      form.reset();
      onSuccess(data.invitation);
    },
    onError: (error: Error) => {
      if (redirectOnAdminAuthError(error, router)) return;
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
        <TextInput label="Email" type="email" placeholder="ada@mefietickets.com" {...form.getInputProps("email")} />
        <Select label="Role" data={INVITABLE_PLATFORM_ROLES} allowDeselect={false} {...form.getInputProps("role")} />
        <Group justify="flex-end" mt="sm">
          {onCancel && (
            <Button type="button" variant="subtle" onClick={onCancel}>
              Cancel
            </Button>
          )}
          <Button type="submit" loading={inviteMutation.isPending}>
            Send invitation
          </Button>
        </Group>
      </Stack>
    </form>
  );
}
