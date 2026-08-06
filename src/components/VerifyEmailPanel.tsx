"use client";

import { useEffect, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Anchor, Button, Card, Group, PinInput, Stack, Text } from "@mantine/core";
import { notifications } from "@mantine/notifications";
import { ApiError, type CurrentUser, resendVerification, verifyEmail } from "@/lib/authApi";

const RESEND_COOLDOWN_SECONDS = 60;
const CODE_TTL_SECONDS = 15 * 60;

function secondsUntil(isoString: string | null | undefined): number {
  if (!isoString) return CODE_TTL_SECONDS;
  const remaining = Math.round((new Date(isoString).getTime() - Date.now()) / 1000);
  return Math.max(0, Math.min(CODE_TTL_SECONDS, remaining));
}

function formatMMSS(totalSeconds: number): string {
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

/**
 * Shared by the registration flow, the login flow (an unverified user
 * lands here instead of the dashboard), the standalone /verify-email
 * page, and the settings-page banner. `variant="compact"` matches the
 * settings-page banner's horizontal layout; `variant="standalone"`
 * (default) matches the full-page centered layout used everywhere else.
 *
 * `expiresAt` should be the server's `email_verification_code_expires_at`
 * for the current user wherever the caller has it — this drives the
 * live 15-minute countdown from the server-authoritative timestamp
 * rather than a client-guessed one, so a page refresh mid-window still
 * shows the real remaining time. Falls back to a fresh 15:00 if omitted.
 */
export function VerifyEmailPanel({
  onVerified,
  variant = "standalone",
  expiresAt = null,
}: {
  onVerified: () => void;
  variant?: "standalone" | "compact";
  expiresAt?: string | null;
}) {
  const [code, setCode] = useState("");
  const [cooldown, setCooldown] = useState(0);
  const [codeSecondsLeft, setCodeSecondsLeft] = useState(() => secondsUntil(expiresAt));

  useEffect(() => {
    setCodeSecondsLeft(secondsUntil(expiresAt));
  }, [expiresAt]);

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setInterval(() => setCooldown((s) => Math.max(0, s - 1)), 1000);
    return () => clearInterval(timer);
  }, [cooldown]);

  useEffect(() => {
    if (codeSecondsLeft <= 0) return;
    const timer = setInterval(() => setCodeSecondsLeft((s) => Math.max(0, s - 1)), 1000);
    return () => clearInterval(timer);
  }, [codeSecondsLeft]);

  const codeExpired = codeSecondsLeft <= 0;

  const verifyMutation = useMutation({
    mutationFn: verifyEmail,
    onSuccess: onVerified,
    onError: (error: Error) => {
      notifications.show({
        color: "red",
        message: error instanceof ApiError ? (error.fieldError("code") ?? error.message) : error.message,
      });
      setCode("");
    },
  });

  const resendMutation = useMutation({
    mutationFn: resendVerification,
    onSuccess: (data: { message: string; user: CurrentUser }) => {
      setCooldown(RESEND_COOLDOWN_SECONDS);
      setCodeSecondsLeft(secondsUntil(data.user.email_verification_code_expires_at));
      setCode("");
      notifications.show({ color: "teal", message: "A new code has been sent." });
    },
    onError: (error: Error) => {
      if (error instanceof ApiError && error.code === "RESEND_COOLDOWN") {
        // Local timer likely drifted (e.g. a backgrounded tab) — resync to the server's cooldown.
        setCooldown(RESEND_COOLDOWN_SECONDS);
      }
      notifications.show({ color: "red", message: error.message });
    },
  });

  const resendLabel = cooldown > 0 ? `Resend in ${formatMMSS(cooldown)}` : "Resend code";
  const expiryText = codeExpired
    ? "This code has expired. Request a new one."
    : `This code expires in ${formatMMSS(codeSecondsLeft)}.`;

  if (variant === "compact") {
    return (
      <Card withBorder radius="lg" p="lg" style={{ borderColor: "var(--mantine-color-yellow-6)" }}>
        <Stack gap="sm">
          <Text fw={600}>Verify your email</Text>
          <Text size="sm" c={codeExpired ? "red" : "dimmed"}>
            Enter the 6-digit code we emailed you. {expiryText}
          </Text>
          <Group>
            <PinInput
              length={6}
              type="number"
              value={code}
              onChange={setCode}
              onComplete={(value) => verifyMutation.mutate(value)}
              disabled={verifyMutation.isPending || codeExpired}
            />
            <Button
              loading={verifyMutation.isPending}
              disabled={code.length !== 6 || codeExpired}
              onClick={() => verifyMutation.mutate(code)}
            >
              Verify
            </Button>
          </Group>
          <Text size="xs" c="dimmed">
            Didn&apos;t get a code?{" "}
            <Button
              variant="transparent"
              size="compact-xs"
              p={0}
              onClick={() => resendMutation.mutate()}
              loading={resendMutation.isPending}
              disabled={cooldown > 0}
            >
              {resendLabel}
            </Button>
          </Text>
        </Stack>
      </Card>
    );
  }

  return (
    <Stack align="center">
      <Text size="sm" c={codeExpired ? "red" : "dimmed"} ta="center">
        {expiryText}
      </Text>
      <PinInput
        length={6}
        type="number"
        value={code}
        onChange={setCode}
        onComplete={(value) => verifyMutation.mutate(value)}
        disabled={verifyMutation.isPending || codeExpired}
        autoFocus
      />
      <Button
        fullWidth
        loading={verifyMutation.isPending}
        disabled={code.length !== 6 || codeExpired}
        onClick={() => verifyMutation.mutate(code)}
      >
        Verify email
      </Button>
      <Text size="sm" c="dimmed">
        Didn&apos;t get a code?{" "}
        <Anchor
          component="button"
          type="button"
          onClick={() => resendMutation.mutate()}
          disabled={cooldown > 0 || resendMutation.isPending}
        >
          {resendLabel}
        </Anchor>
      </Text>
    </Stack>
  );
}
