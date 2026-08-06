"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation } from "@tanstack/react-query";
import { useForm } from "@mantine/form";
import {
  Badge,
  Button,
  Card,
  Container,
  Divider,
  Group,
  Modal,
  PasswordInput,
  Stack,
  Text,
  TextInput,
} from "@mantine/core";
import { notifications } from "@mantine/notifications";
import { VerifyEmailPanel } from "@/components/VerifyEmailPanel";
import { ApiError, changeEmail, type CurrentUser, updateCurrentUser } from "@/lib/authApi";
import { redirectOnAuthError } from "@/lib/authErrorRedirect";

export function SettingsForm({ initialUser }: { initialUser: CurrentUser }) {
  const [user, setUser] = useState(initialUser);
  const router = useRouter();

  const form = useForm({
    initialValues: { first_name: user.first_name, last_name: user.last_name },
  });

  const updateMutation = useMutation({
    mutationFn: updateCurrentUser,
    onSuccess: (data: { user: CurrentUser }) => {
      setUser(data.user);
      notifications.show({ color: "teal", message: "Profile updated." });
    },
    onError: (error: Error) => {
      if (redirectOnAuthError(error, router)) return;
      notifications.show({ color: "red", message: error.message });
    },
  });

  return (
    <Container size="sm" py="xl">
      <Stack gap="xl">
        <Text component="h1" fz={28} fw={800}>
          Account settings
        </Text>

        {!user.email_verified_at && (
          <VerifyEmailPanel
            variant="compact"
            expiresAt={user.email_verification_code_expires_at}
            onVerified={() => setUser({ ...user, email_verified_at: new Date().toISOString() })}
          />
        )}

        <Card withBorder radius="lg" shadow="md" p="xl">
          <Stack>
            <Group justify="space-between">
              <Text fw={600}>Profile</Text>
              <Badge variant="light">{user.role}</Badge>
            </Group>

            <form onSubmit={form.onSubmit((values) => updateMutation.mutate(values))}>
              <Stack>
                <TextInput label="First name" {...form.getInputProps("first_name")} />
                <TextInput label="Last name" {...form.getInputProps("last_name")} />
                <Button type="submit" loading={updateMutation.isPending} style={{ alignSelf: "flex-start" }}>
                  Save changes
                </Button>
              </Stack>
            </form>

            {/* Deliberately outside the profile form above: Mantine's Modal
                portals its content, but the modal's own <form> still sits in
                the DOM tree under this one, and a native `submit` event
                bubbles — nesting it inside the profile form double-submitted
                both on every email change. */}
            <ChangeEmailField user={user} onChanged={setUser} />

            <Divider />

            <Group justify="space-between">
              <Text size="sm" c="dimmed">
                Email verified
              </Text>
              <Badge color={user.email_verified_at ? "teal" : "yellow"} variant="light">
                {user.email_verified_at ? "verified" : "unverified"}
              </Badge>
            </Group>
          </Stack>
        </Card>
      </Stack>
    </Container>
  );
}

function ChangeEmailField({
  user,
  onChanged,
}: {
  user: CurrentUser;
  onChanged: (user: CurrentUser) => void;
}) {
  const [opened, setOpened] = useState(false);
  const router = useRouter();

  const form = useForm({
    initialValues: { email: "", current_password: "" },
    validate: {
      email: (v) => (/^\S+@\S+\.\S+$/.test(v) ? null : "Enter a valid email"),
      current_password: (v) => (v.length === 0 ? "Enter your current password to confirm" : null),
    },
  });

  const changeMutation = useMutation({
    mutationFn: changeEmail,
    onSuccess: (data: { user: CurrentUser }) => {
      onChanged(data.user);
      setOpened(false);
      form.reset();
      notifications.show({ color: "teal", message: "Email updated. A new verification code has been sent." });
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
    <>
      <Group align="flex-end" gap="xs">
        <TextInput label="Email" value={user.email} disabled style={{ flex: 1 }} />
        <Button type="button" variant="light" onClick={() => setOpened(true)}>
          Change
        </Button>
      </Group>

      <Modal opened={opened} onClose={() => setOpened(false)} title="Change email address">
        <form onSubmit={form.onSubmit((values) => changeMutation.mutate(values))}>
          <Stack>
            <Text size="sm" c="dimmed">
              You&apos;ll need to verify the new address before you can use the app again.
            </Text>
            <TextInput label="New email" placeholder="you@example.com" {...form.getInputProps("email")} />
            <PasswordInput label="Current password" {...form.getInputProps("current_password")} />
            <Group justify="flex-end" mt="sm">
              <Button type="button" variant="subtle" onClick={() => setOpened(false)}>
                Cancel
              </Button>
              <Button type="submit" loading={changeMutation.isPending}>
                Update email
              </Button>
            </Group>
          </Stack>
        </form>
      </Modal>
    </>
  );
}
