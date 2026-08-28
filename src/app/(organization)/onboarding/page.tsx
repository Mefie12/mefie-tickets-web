"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation } from "@tanstack/react-query";
import {
  Avatar,
  Box,
  Button,
  Card,
  Group,
  Stack,
  Text,
  Title,
} from "@mantine/core";
import { IconCamera } from "@tabler/icons-react";
import { notifications } from "@mantine/notifications";
import { isValidPhoneNumber } from "libphonenumber-js";
import { ApiError } from "@/lib/authApi";
import { redirectOnAuthError } from "@/lib/authErrorRedirect";
import { updateOrganization, uploadOrganizationLogo } from "@/lib/organizationApi";
import { InviteOrganizerForm } from "@/components/InviteOrganizerForm";
import { PhoneInput } from "@/components/PhoneInput";
import { OnboardingJourney } from "@/components/OnboardingJourney";
import { PaymentAccountSetupForm } from "@/components/PaymentAccountSetupForm";
import { PaymentCurrencyExplainer } from "@/components/PaymentCurrencyExplainer";

type Step = "welcome" | "financials" | "profile" | "team";

/**
 * Post-registration wizard for the founding admin. It leads with payment
 * setup — legal country + settlement currency — so every event the
 * organization later creates inherits that currency from creation (see
 * EventService::resolveCurrencyCode()), rather than being drafted in a
 * provisional USD that only collides with the real currency at publish
 * time. The payment step is skippable ("Skip this step if your event is
 * free"); anyone who skips and later sells paid tickets is still caught
 * at publish by EventPaymentBindingService::bindForPaidSales()
 * (PAYMENT_SETUP_REQUIRED), and the dashboard shows a reminder until
 * payments are set up. The profile and team steps that follow are
 * unchanged and also skippable. No onboarding progress is persisted
 * server-side; every path ends on the dashboard.
 */
export default function OnboardingPage() {
  const [step, setStep] = useState<Step>("welcome");
  const router = useRouter();

  return (
    <Stack gap="xl" maw={620}>
      <OnboardingJourney activeKey={step === "financials" ? "financials" : undefined} />

      {step === "welcome" && <WelcomeStep onNext={() => setStep("financials")} />}
      {step === "financials" && <FinancialsStep onDone={() => setStep("profile")} />}
      {step === "profile" && <ProfileStep onDone={() => setStep("team")} />}
      {step === "team" && <TeamStep onDone={() => router.push("/dashboard")} />}
    </Stack>
  );
}

function WelcomeStep({ onNext }: { onNext: () => void }) {
  return (
    <Stack gap="xl" align="center" mt="md">
      <Stack gap={4} align="center">
        <Title order={2} fz={26} ta="center">
          Welcome to Mefie Tickets
        </Title>
        <Text c="dimmed" size="sm" ta="center">
          Here&apos;s what happens now:
        </Text>
      </Stack>
      <Button size="md" onClick={onNext}>
        Next
      </Button>
    </Stack>
  );
}

function FinancialsStep({ onDone }: { onDone: () => void }) {
  return (
    <Stack gap="xl">
      <Stack gap={4}>
        <Title order={2} fz={26}>
          Add your financial details
        </Title>
        <Text c="dimmed" size="sm">
          Connect your account to get paid. Pick your legal payment country and settlement currency now — every
          event your organization creates sells tickets in that currency. You can finish full verification later.{" "}
          <PaymentCurrencyExplainer />
        </Text>
      </Stack>

      <Card withBorder radius="lg" p="xl">
        <PaymentAccountSetupForm hideHeading defaultLegalCountry={null} onProvisioned={onDone} />
      </Card>

      <Group justify="center">
        <Button variant="subtle" color="gray" onClick={onDone}>
          Skip this step if your event is free
        </Button>
      </Group>
    </Stack>
  );
}

function ProfileStep({ onDone }: { onDone: () => void }) {
  const [phone, setPhone] = useState("");
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  const continueMutation = useMutation({
    mutationFn: async () => {
      if (phone.trim()) {
        await updateOrganization({ phone: phone.trim() });
      }
      if (logoFile) {
        await uploadOrganizationLogo(logoFile);
      }
    },
    onSuccess: onDone,
    onError: (error: Error) => {
      if (redirectOnAuthError(error, router)) return;
      notifications.show({
        color: "red",
        message: error instanceof ApiError ? error.message : "Something went wrong.",
      });
    },
  });

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setLogoFile(file);
    setLogoPreview(URL.createObjectURL(file));
  }

  function handleContinue() {
    if (phone.trim() && !isValidPhoneNumber(phone)) {
      notifications.show({ color: "red", message: "Enter a valid phone number, or leave it blank." });
      return;
    }
    continueMutation.mutate();
  }

  return (
    <Stack gap="xl">
      <Stack gap={4}>
        <Title order={2} fz={26}>
          Set up your organization
        </Title>
        <Text c="dimmed" size="sm">
          Add a contact number and logo so buyers recognize your events. You can always change these later.
        </Text>
      </Stack>

      <Card withBorder radius="lg" p="xl">
        <Stack>
          <Group>
            <Avatar src={logoPreview} size={72} radius="lg" color="brand">
              {!logoPreview && <IconCamera size={24} opacity={0.6} />}
            </Avatar>
            <Box>
              <Button variant="light" size="xs" onClick={() => fileInputRef.current?.click()}>
                Upload logo
              </Button>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/png,image/jpeg,image/webp"
                hidden
                onChange={handleFileChange}
              />
              <Text size="xs" c="dimmed" mt={4}>
                Optional — PNG, JPEG, or WebP.
              </Text>
            </Box>
          </Group>

          <PhoneInput
            label="Phone number"
            placeholder="Phone number"
            value={phone}
            onChange={setPhone}
          />
          <Text size="xs" c="dimmed" mt={-8}>
            Optional — a contact number for your organization.
          </Text>

          <Group justify="space-between" mt="sm">
            <Button variant="subtle" color="gray" onClick={onDone}>
              Skip for now
            </Button>
            <Button loading={continueMutation.isPending} onClick={handleContinue}>
              Continue
            </Button>
          </Group>
        </Stack>
      </Card>
    </Stack>
  );
}

function TeamStep({ onDone }: { onDone: () => void }) {
  const [inviting, setInviting] = useState(false);

  return (
    <Stack gap="xl">
      <Stack gap={4}>
        <Title order={2} fz={26}>
          Bring in your team
        </Title>
        <Text c="dimmed" size="sm">
          Invite an organizer to help manage events, or skip this and invite people later from Team settings.
        </Text>
      </Stack>

      <Card withBorder radius="lg" p="xl">
        {inviting ? (
          <InviteOrganizerForm onSuccess={onDone} onCancel={() => setInviting(false)} submitLabel="Send invite and finish" />
        ) : (
          <Stack>
            <Button onClick={() => setInviting(true)}>Invite a teammate</Button>
            <Button variant="subtle" color="gray" onClick={onDone}>
              Skip for now
            </Button>
          </Stack>
        )}
      </Card>
    </Stack>
  );
}
