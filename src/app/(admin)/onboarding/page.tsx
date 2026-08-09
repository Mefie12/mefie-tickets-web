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
  Progress,
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

const STEPS = ["profile", "team"] as const;
type Step = (typeof STEPS)[number];

/**
 * Two-step post-registration wizard for the founding admin: enrich the
 * org profile, then optionally invite the first teammate. Deliberately
 * narrow scope — description/website/social are out of scope for step 1
 * (see the brief), and step 2 is a thin wrapper around the same
 * InviteOrganizerForm used on the standalone Team page. Both steps are
 * skippable; either path ends on the dashboard.
 */
export default function OnboardingPage() {
  const [step, setStep] = useState<Step>("profile");
  const router = useRouter();

  const stepIndex = STEPS.indexOf(step);

  return (
    <Stack gap="xl" maw={520}>
      <Stack gap={4}>
        <Text size="sm" c="dimmed">
          Step {stepIndex + 1} of {STEPS.length}
        </Text>
        <Progress value={((stepIndex + 1) / STEPS.length) * 100} size="sm" radius="xl" />
      </Stack>

      {step === "profile" && <ProfileStep onDone={() => setStep("team")} />}
      {step === "team" && <TeamStep onDone={() => router.push("/dashboard")} />}
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
