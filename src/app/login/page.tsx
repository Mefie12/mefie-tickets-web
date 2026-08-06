"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation } from "@tanstack/react-query";
import { useForm } from "@mantine/form";
import { Anchor, Button, PasswordInput, Stack, Text, TextInput } from "@mantine/core";
import { notifications } from "@mantine/notifications";
import { AuthLayout } from "@/components/AuthLayout";
import { VerifyEmailPanel } from "@/components/VerifyEmailPanel";
import { ApiError, type CurrentUser, login } from "@/lib/authApi";

export default function LoginPage() {
  const [unverifiedUser, setUnverifiedUser] = useState<CurrentUser | null>(null);
  const router = useRouter();

  const form = useForm({
    initialValues: { email: "", password: "" },
    validate: {
      email: (v) => (/^\S+@\S+\.\S+$/.test(v) ? null : "Enter a valid email"),
      password: (v) => (v.length === 0 ? "Password is required" : null),
    },
  });

  const loginMutation = useMutation({
    mutationFn: login,
    onSuccess: (data: { user: CurrentUser }) => {
      if (data.user.email_verified_at) {
        router.push("/settings");
      } else {
        setUnverifiedUser(data.user);
      }
    },
    onError: (error: Error) => {
      if (error instanceof ApiError && error.errors) {
        form.setErrors(
          Object.fromEntries(Object.entries(error.errors).map(([field, messages]) => [field, messages[0]])),
        );
      } else {
        notifications.show({ color: "red", message: (error as Error).message });
      }
    },
  });

  if (unverifiedUser) {
    return (
      <AuthLayout
        title="Verify your email"
        subtitle={`Enter the 6-digit code we sent to ${unverifiedUser.email} to continue.`}
      >
        <VerifyEmailPanel
          onVerified={() => router.push("/settings")}
          expiresAt={unverifiedUser.email_verification_code_expires_at}
        />
      </AuthLayout>
    );
  }

  return (
    <AuthLayout title="Welcome back" subtitle="Log in to manage your events and tickets.">
      <form onSubmit={form.onSubmit((values) => loginMutation.mutate(values))}>
        <Stack>
          <TextInput label="Email" placeholder="you@example.com" {...form.getInputProps("email")} />
          <PasswordInput label="Password" {...form.getInputProps("password")} />
          <Button type="submit" fullWidth loading={loginMutation.isPending} mt="sm">
            Log in
          </Button>
          <Text size="sm" ta="center" c="dimmed">
            Don&apos;t have an account? <Anchor href="/register">Create one</Anchor>
          </Text>
        </Stack>
      </form>
    </AuthLayout>
  );
}
