"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useMutation } from "@tanstack/react-query";
import { useForm } from "@mantine/form";
import { Alert, Anchor, Button, Checkbox, Group, PasswordInput, Stack, Text, TextInput } from "@mantine/core";
import { notifications } from "@mantine/notifications";
import { safeNext } from "@/lib/safeNext";
import { AuthLayout } from "@/components/AuthLayout";
import { VerifyEmailPanel } from "@/components/VerifyEmailPanel";
import { ApiError, type CurrentUser, login } from "@/lib/authApi";

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}

function LoginForm() {
  const [unverifiedUser, setUnverifiedUser] = useState<CurrentUser | null>(null);
  const router = useRouter();
  // Lets e.g. the invitation-accept page send an unauthenticated visitor
  // here, then land them back where they came from once logged in —
  // see AcceptInvitationForm's "requires_login" branch.
  const searchParams = useSearchParams();
  const next = searchParams.get("next");
  const sessionExpired = searchParams.get("expired") === "1";
  // A distributor-only account (created via the complimentary-allocation
  // invitation flow) never gets an organization membership, so
  // current_organization_id stays null — /dashboard would otherwise show
  // them a bare "create your first event" prompt that isn't meant for
  // them (confirmed live: that's exactly what happened before this).
  function destinationFor(user: CurrentUser): string {
    if (next) return safeNext(next, "organizer", user.current_organization_id === null ? "/distributor" : "/dashboard");
    return user.current_organization_id === null ? "/distributor" : "/dashboard";
  }

  const form = useForm({
    initialValues: { email: "", password: "", remember: false },
    validate: {
      email: (v) => (/^\S+@\S+\.\S+$/.test(v) ? null : "Enter a valid email"),
      password: (v) => (v.length === 0 ? "Password is required" : null),
    },
  });

  const loginMutation = useMutation({
    mutationFn: login,
    onSuccess: (data: { user: CurrentUser }) => {
      if (data.user.email_verified_at) {
        router.push(destinationFor(data.user));
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
          onVerified={() => router.push(destinationFor(unverifiedUser))}
          expiresAt={unverifiedUser.email_verification_code_expires_at}
        />
      </AuthLayout>
    );
  }

  return (
    <AuthLayout title="Organizer login" subtitle="Log in to manage your organization and events.">
      <form onSubmit={form.onSubmit((values) => loginMutation.mutate(values))}>
        <Stack>
          {sessionExpired && (
            <Alert color="orange" title="Your session expired">
              You were signed out after a period of inactivity. Log in again to pick up where you left off.
            </Alert>
          )}
          <TextInput label="Email" placeholder="you@example.com" {...form.getInputProps("email")} />
          <PasswordInput label="Password" {...form.getInputProps("password")} />
          <Group justify="space-between">
            <Checkbox label="Remember me" {...form.getInputProps("remember", { type: "checkbox" })} />
            <Anchor href="/forgot-password" size="sm">
              Forgot password?
            </Anchor>
          </Group>
          <Button type="submit" fullWidth loading={loginMutation.isPending} mt="sm">
            Log in
          </Button>
          <Text size="sm" ta="center" c="dimmed">
            New organizer? <Anchor href="/organizers/register">Create an organization</Anchor>
          </Text>
        </Stack>
      </form>
    </AuthLayout>
  );
}
