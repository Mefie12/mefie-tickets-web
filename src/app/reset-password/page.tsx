"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useMutation } from "@tanstack/react-query";
import { useForm } from "@mantine/form";
import { Alert, Anchor, Button, PasswordInput, Stack, Text } from "@mantine/core";
import { notifications } from "@mantine/notifications";
import { AuthLayout } from "@/components/AuthLayout";
import { ApiError, resetPassword } from "@/lib/authApi";

export default function ResetPasswordPage() {
  return (
    <Suspense>
      <ResetPasswordForm />
    </Suspense>
  );
}

/**
 * Reads ?token=...&email=... — matches the link shape built by the
 * backend's ResetPasswordNotification (mefie-tickets-api
 * app/Notifications/ResetPasswordNotification.php): FRONTEND_URL +
 * "/reset-password?token={token}&email={email}".
 *
 * There's no preview/validate-token endpoint (unlike invitations), so
 * validity is only known once the new password is submitted.
 */
function ResetPasswordForm() {
  const params = useSearchParams();
  const token = params.get("token");
  const email = params.get("email");
  const [done, setDone] = useState(false);

  const form = useForm({
    initialValues: { password: "", password_confirmation: "" },
    validate: {
      password: (v) => (v.length < 8 ? "Must be at least 8 characters" : null),
      password_confirmation: (v, values) => (v !== values.password ? "Passwords do not match" : null),
    },
  });

  const mutation = useMutation({
    mutationFn: (values: typeof form.values) => resetPassword({ token: token!, email: email!, ...values }),
    onSuccess: () => setDone(true),
    onError: (error: Error) => {
      if (error instanceof ApiError && error.errors) {
        form.setErrors(
          Object.fromEntries(Object.entries(error.errors).map(([field, messages]) => [field, messages[0]])),
        );
        // The broker's failure reasons (invalid/expired token, unknown
        // user, throttled) all land on an "email" field error, but this
        // form has no visible email input to attach that to.
        const message = error.fieldError("email");
        if (message) notifications.show({ color: "red", message });
      } else {
        notifications.show({ color: "red", message: error.message });
      }
    },
  });

  if (!token || !email) {
    return (
      <AuthLayout title="Invalid reset link">
        <Stack>
          <Alert color="red">This password reset link is invalid or missing its token.</Alert>
          <Text size="sm" ta="center">
            <Anchor component={Link} href="/forgot-password">
              Request a new link
            </Anchor>
          </Text>
        </Stack>
      </AuthLayout>
    );
  }

  if (done) {
    return (
      <AuthLayout title="Password updated" subtitle="Your password has been reset successfully.">
        <Button component={Link} href="/login" fullWidth>
          Log in
        </Button>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout title="Set a new password" subtitle={`Choose a new password for ${email}.`}>
      <form onSubmit={form.onSubmit((values) => mutation.mutate(values))}>
        <Stack>
          <PasswordInput label="New password" placeholder="At least 8 characters" {...form.getInputProps("password")} />
          <PasswordInput label="Confirm password" {...form.getInputProps("password_confirmation")} />
          <Button type="submit" fullWidth loading={mutation.isPending} mt="sm">
            Reset password
          </Button>
        </Stack>
      </form>
    </AuthLayout>
  );
}
