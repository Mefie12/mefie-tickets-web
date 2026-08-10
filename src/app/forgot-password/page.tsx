"use client";

import { useState } from "react";
import Link from "next/link";
import { useMutation } from "@tanstack/react-query";
import { useForm } from "@mantine/form";
import { Anchor, Button, Stack, Text, TextInput } from "@mantine/core";
import { AuthLayout } from "@/components/AuthLayout";
import { requestPasswordReset } from "@/lib/authApi";

/**
 * Always shows the same confirmation regardless of whether the email
 * exists — ForgotPasswordAction on the backend returns an identical
 * response either way, so there's nothing more specific to show here.
 */
export default function ForgotPasswordPage() {
  const [submitted, setSubmitted] = useState(false);

  const form = useForm({
    initialValues: { email: "" },
    validate: {
      email: (v) => (/^\S+@\S+\.\S+$/.test(v) ? null : "Enter a valid email"),
    },
  });

  const mutation = useMutation({
    mutationFn: requestPasswordReset,
    onSuccess: () => setSubmitted(true),
  });

  if (submitted) {
    return (
      <AuthLayout title="Check your email" subtitle="If an account exists for that email, we've sent a password reset link.">
        <Stack>
          <Text size="sm" ta="center" c="dimmed">
            <Anchor component={Link} href="/login">
              Back to login
            </Anchor>
          </Text>
        </Stack>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout title="Forgot your password?" subtitle="Enter your email and we'll send you a reset link.">
      <form onSubmit={form.onSubmit((values) => mutation.mutate(values))}>
        <Stack>
          <TextInput label="Email" placeholder="you@example.com" {...form.getInputProps("email")} />
          <Button type="submit" fullWidth loading={mutation.isPending} mt="sm">
            Send reset link
          </Button>
          <Text size="sm" ta="center" c="dimmed">
            <Anchor component={Link} href="/login">
              Back to login
            </Anchor>
          </Text>
        </Stack>
      </form>
    </AuthLayout>
  );
}
