"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "@mantine/form";
import { Anchor, Button, PasswordInput, Stack, Text, TextInput } from "@mantine/core";
import { notifications } from "@mantine/notifications";
import { AuthLayout } from "@/components/AuthLayout";
import { LegalAgreement, useLegalDocuments } from "@/components/LegalDocumentLinks";
import { VerifyEmailPanel } from "@/components/VerifyEmailPanel";
import { ApiError, type CurrentUser, registerOrganization } from "@/lib/authApi";
import type { LegalDocumentPlacementSlug } from "@/lib/legalDocumentsApi";

type RegisterValues = {
  organization_name: string;
  first_name: string;
  last_name: string;
  email: string;
  password: string;
  password_confirmation: string;
  accepted_terms: boolean;
};

const REGISTRATION_PLACEMENTS: LegalDocumentPlacementSlug[] = ["account-registration", "organizer-onboarding"];

export default function RegisterPage() {
  const [step, setStep] = useState<"register" | "verify">("register");
  const [codeExpiresAt, setCodeExpiresAt] = useState<string | null>(null);
  const router = useRouter();
  const queryClient = useQueryClient();
  const legal = useLegalDocuments(REGISTRATION_PLACEMENTS);

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
      accepted_terms: (v) => (legal.required.length > 0 && !v ? "You must accept the documents above to continue" : null),
    },
  });

  const registerMutation = useMutation({
    mutationFn: registerOrganization,
    onSuccess: (data: { user: CurrentUser }) => {
      setCodeExpiresAt(data.user.email_verification_code_expires_at);
      setStep("verify");
    },
    onError: (error: Error) => {
      if (error instanceof ApiError && error.code === "DOCUMENTS_CHANGED") {
        // The documents changed while the form was open: show the new ones and make them agree again.
        form.setFieldValue("accepted_terms", false);
        void queryClient.invalidateQueries({ queryKey: ["legal-documents"] });
        notifications.show({ color: "orange", message: "Our legal documents were just updated. Please review them and accept again." });
      } else if (error instanceof ApiError && error.errors) {
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
    return <VerifyStep onVerified={() => router.replace("/onboarding")} expiresAt={codeExpiresAt} />;
  }

  return (
    <AuthLayout
      title="Create an organization"
      subtitle="Set up your Organization to start selling tickets."
    >
      <form onSubmit={form.onSubmit((values) => registerMutation.mutate({ ...values, document_versions: legal.versionIds }))}>
        <Stack>
          <TextInput
            label="Organization name"
            withAsterisk
            placeholder="Acme Events"
            {...form.getInputProps("organization_name")}
          />
          <TextInput label="First name" withAsterisk placeholder="Ada" {...form.getInputProps("first_name")} />
          <TextInput label="Last name" withAsterisk placeholder="Lovelace" {...form.getInputProps("last_name")} />
          <TextInput label="Email" withAsterisk placeholder="you@example.com" {...form.getInputProps("email")} />
          <PasswordInput
            label="Password"
            withAsterisk
            placeholder="At least 8 characters"
            {...form.getInputProps("password")}
          />
          <PasswordInput label="Confirm password" withAsterisk {...form.getInputProps("password_confirmation")} />
          <LegalAgreement
            documents={legal}
            action="creating an organization"
            checked={form.values.accepted_terms}
            onChange={(checked) => form.setFieldValue("accepted_terms", checked)}
            error={form.errors.accepted_terms}
          />
          <Button type="submit" fullWidth loading={registerMutation.isPending} mt="sm">
            Create organization
          </Button>
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
