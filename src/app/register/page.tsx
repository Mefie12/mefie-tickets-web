"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation } from "@tanstack/react-query";
import { useForm } from "@mantine/form";
import { Anchor, Button, PasswordInput, Stack, Text, TextInput } from "@mantine/core";
import { notifications } from "@mantine/notifications";
import { AuthLayout } from "@/components/AuthLayout";
import { VerifyEmailPanel } from "@/components/VerifyEmailPanel";
import { ApiError, type CurrentUser, registerAccount } from "@/lib/authApi";

type RegisterValues = {
  account_name: string;
  first_name: string;
  last_name: string;
  email: string;
  password: string;
  password_confirmation: string;
};

export default function RegisterPage() {
  const [step, setStep] = useState<"register" | "verify">("register");
  const [codeExpiresAt, setCodeExpiresAt] = useState<string | null>(null);
  const router = useRouter();

  const form = useForm<RegisterValues>({
    initialValues: {
      account_name: "",
      first_name: "",
      last_name: "",
      email: "",
      password: "",
      password_confirmation: "",
    },
    validate: {
      account_name: (v) => (v.trim().length === 0 ? "Account name is required" : null),
      first_name: (v) => (v.trim().length === 0 ? "First name is required" : null),
      last_name: (v) => (v.trim().length === 0 ? "Last name is required" : null),
      email: (v) => (/^\S+@\S+\.\S+$/.test(v) ? null : "Enter a valid email"),
      password: (v) => (v.length < 8 ? "Must be at least 8 characters" : null),
      password_confirmation: (v, values) => (v !== values.password ? "Passwords do not match" : null),
    },
  });

  const registerMutation = useMutation({
    mutationFn: registerAccount,
    onSuccess: (data: { user: CurrentUser }) => {
      setCodeExpiresAt(data.user.email_verification_code_expires_at);
      setStep("verify");
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

  if (step === "verify") {
    return <VerifyStep onVerified={() => router.push("/settings")} expiresAt={codeExpiresAt} />;
  }

  return (
    <AuthLayout
      title="Create your account"
      subtitle="Set up an Account and Organizer profile to start selling tickets."
    >
      <form onSubmit={form.onSubmit((values) => registerMutation.mutate(values))}>
        <Stack>
          <TextInput
            label="Account name"
            placeholder="Acme Events"
            {...form.getInputProps("account_name")}
          />
          <TextInput label="First name" placeholder="Ada" {...form.getInputProps("first_name")} />
          <TextInput label="Last name" placeholder="Lovelace" {...form.getInputProps("last_name")} />
          <TextInput label="Email" placeholder="you@example.com" {...form.getInputProps("email")} />
          <PasswordInput
            label="Password"
            placeholder="At least 8 characters"
            {...form.getInputProps("password")}
          />
          <PasswordInput label="Confirm password" {...form.getInputProps("password_confirmation")} />
          <Button type="submit" fullWidth loading={registerMutation.isPending} mt="sm">
            Create account
          </Button>
          <Text size="sm" ta="center" c="dimmed">
            Already have an account? <Anchor href="/login">Log in</Anchor>
          </Text>
        </Stack>
      </form>
    </AuthLayout>
  );
}

function VerifyStep({ onVerified, expiresAt }: { onVerified: () => void; expiresAt: string | null }) {
  return (
    <AuthLayout
      title="Verify your email"
      subtitle="We've emailed you a 6-digit code. Enter it below to finish setting up your account."
    >
      <VerifyEmailPanel onVerified={onVerified} expiresAt={expiresAt} />
    </AuthLayout>
  );
}
