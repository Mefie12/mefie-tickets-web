"use client";

import { useSearchParams, useRouter } from "next/navigation";
import { useMutation } from "@tanstack/react-query";
import { useForm } from "@mantine/form";
import { Alert, Button, PasswordInput, Stack, TextInput } from "@mantine/core";
import { AuthLayout } from "@/components/AuthLayout";
import { ApiError, acceptInvitation } from "@/lib/authApi";

/**
 * Reads ?token=... — matches the link shape built by the backend's
 * TeammateInvitationNotification (mefie-tickets-api
 * app/Notifications/TeammateInvitationNotification.php): FRONTEND_URL +
 * "/invitations/accept?token={token}".
 */
export function AcceptInvitationForm() {
  const router = useRouter();
  const token = useSearchParams().get("token");

  const form = useForm({
    initialValues: { first_name: "", last_name: "", password: "", password_confirmation: "" },
    validate: {
      first_name: (v) => (v.trim().length === 0 ? "First name is required" : null),
      last_name: (v) => (v.trim().length === 0 ? "Last name is required" : null),
      password: (v) => (v.length < 8 ? "Must be at least 8 characters" : null),
      password_confirmation: (v, values) => (v !== values.password ? "Passwords do not match" : null),
    },
  });

  const acceptMutation = useMutation({
    mutationFn: (values: typeof form.values) => acceptInvitation(token ?? "", values),
    onSuccess: () => router.push("/settings"),
    onError: (error: Error) => {
      if (error instanceof ApiError && error.errors) {
        form.setErrors(
          Object.fromEntries(Object.entries(error.errors).map(([field, messages]) => [field, messages[0]])),
        );
      }
    },
  });

  if (!token) {
    return (
      <AuthLayout title="Invitation link invalid">
        <Alert color="red">This invitation link is missing its token. Ask for a new invite email.</Alert>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout title="Join your team" subtitle="Set your name and password to finish joining the account.">
      <form onSubmit={form.onSubmit((values) => acceptMutation.mutate(values))}>
        <Stack>
          {acceptMutation.isError && !(acceptMutation.error instanceof ApiError && acceptMutation.error.errors) && (
            <Alert color="red">{(acceptMutation.error as Error).message}</Alert>
          )}
          <TextInput label="First name" placeholder="Bob" {...form.getInputProps("first_name")} />
          <TextInput label="Last name" placeholder="Builder" {...form.getInputProps("last_name")} />
          <PasswordInput
            label="Password"
            placeholder="At least 8 characters"
            {...form.getInputProps("password")}
          />
          <PasswordInput label="Confirm password" {...form.getInputProps("password_confirmation")} />
          <Button type="submit" fullWidth loading={acceptMutation.isPending} mt="sm">
            Accept invitation
          </Button>
        </Stack>
      </form>
    </AuthLayout>
  );
}
