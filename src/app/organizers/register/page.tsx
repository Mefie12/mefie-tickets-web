"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation } from "@tanstack/react-query";
import { useForm } from "@mantine/form";
import { Anchor, Button, Checkbox, PasswordInput, Stack, Text, TextInput } from "@mantine/core";
import { notifications } from "@mantine/notifications";
import { AuthLayout } from "@/components/AuthLayout";
import { LegalDocumentLinks } from "@/components/LegalDocumentLinks";
import { VerifyEmailPanel } from "@/components/VerifyEmailPanel";
import { ApiError, type CurrentUser, registerOrganization } from "@/lib/authApi";

type RegisterValues = {
  organization_name: string;
  first_name: string;
  last_name: string;
  email: string;
  password: string;
  password_confirmation: string;
  accepted_terms: boolean;
};

export default function RegisterPage() {
  const [step, setStep] = useState<"register" | "verify">("register");
  const [codeExpiresAt, setCodeExpiresAt] = useState<string | null>(null);
  const router = useRouter();

  const form = useForm<RegisterValues>({
    initialValues: {
      organization_name: "",
      first_name: "",
      last_name: "",
      email: "",
      password: "",
      password_confirmation: "",
      accepted_terms: false,
    },
    validate: {
      organization_name: (v) => (v.trim().length === 0 ? "Organization name is required" : null),
      first_name: (v) => (v.trim().length === 0 ? "First name is required" : null),
      last_name: (v) => (v.trim().length === 0 ? "Last name is required" : null),
      email: (v) => (/^\S+@\S+\.\S+$/.test(v) ? null : "Enter a valid email"),
      password: (v) => (v.length < 8 ? "Must be at least 8 characters" : null),
      password_confirmation: (v, values) => (v !== values.password ? "Passwords do not match" : null),
      accepted_terms: (v) => (v ? null : "You must accept the Terms of Use and Privacy Policy to continue"),
    },
  });

  const registerMutation = useMutation({
    mutationFn: registerOrganization,
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

  // Post-verify: the founding admin still has to set up their org profile
  // and (optionally) their team before landing on the dashboard — see
  // /onboarding. An invited teammate skips this (AcceptInvitationForm
  // goes straight to the dashboard): there's no org-level setup for them
  // to do.
  if (step === "verify") {
    return <VerifyStep onVerified={() => router.push("/onboarding")} expiresAt={codeExpiresAt} />;
  }

  return (
    <AuthLayout
      title="Create an organization"
      subtitle="Set up your Organization to start selling tickets."
    >
      <form onSubmit={form.onSubmit((values) => registerMutation.mutate(values))}>
        <Stack>
          <TextInput
            label="Organization name"
            placeholder="Acme Events"
            {...form.getInputProps("organization_name")}
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
          <Checkbox
            {...form.getInputProps("accepted_terms", { type: "checkbox" })}
            label={
              <>
                I accept Mefie Tickets&apos;{" "}
                <LegalDocumentLinks placement="account-registration" fallback="Terms of Use and Privacy Policy" />.
              </>
            }
          />
          <Button type="submit" fullWidth loading={registerMutation.isPending} mt="sm">
            Create organization
          </Button>
          <Text size="xs" c="dimmed" ta="center">
            If you add a phone number to your account, we may text you about product updates and events — reply
            STOP at any time to opt out.
          </Text>
          <Text size="sm" ta="center" c="dimmed">
            Already have an account? <Anchor href="/organizers/login">Log in</Anchor>
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
