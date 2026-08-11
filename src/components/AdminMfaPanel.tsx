"use client";

import { useEffect, useRef, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Anchor, Button, Group, PinInput, Stack, Text } from "@mantine/core";
import { notifications } from "@mantine/notifications";
import { ApiError } from "@/lib/authApi";
import { requestAdminMfa, resendAdminMfa, verifyAdminMfa, type AdminSession } from "@/lib/adminAuthApi";

const RESEND_COOLDOWN_SECONDS = 60;
// PlatformMfaService's code TTL (10 minutes) — unlike email verification,
// the request/resend endpoints here don't echo back a server-authoritative
// expiry timestamp, so this countdown is locally tracked rather than
// resynced from the server on every response.
const CODE_TTL_SECONDS = 10 * 60;

function formatMMSS(totalSeconds: number): string {
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

/**
 * Step 2 of establishing a privileged admin session: request a code on
 * mount, then verify it. On success, a second cookie
 * (mefie_admin_session) is set by VerifyAdminMfaAction alongside the
 * existing Sanctum session — see PlatformSessionService.
 */
export function AdminMfaPanel({ email, onVerified }: { email: string; onVerified: (session: AdminSession) => void }) {
  const [code, setCode] = useState("");
  const [cooldown, setCooldown] = useState(0);
  const [codeSecondsLeft, setCodeSecondsLeft] = useState(CODE_TTL_SECONDS);
  const requestedOnce = useRef(false);

  const requestMutation = useMutation({
    mutationFn: requestAdminMfa,
    onError: (error: Error) => {
      notifications.show({ color: "red", message: error instanceof ApiError ? error.message : error.message });
    },
  });

  useEffect(() => {
    if (requestedOnce.current) return;
    requestedOnce.current = true;
    requestMutation.mutate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
    mutationFn: verifyAdminMfa,
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
    mutationFn: resendAdminMfa,
    onSuccess: () => {
      setCooldown(RESEND_COOLDOWN_SECONDS);
      setCodeSecondsLeft(CODE_TTL_SECONDS);
      setCode("");
      notifications.show({ color: "teal", message: "A new code has been sent." });
    },
    onError: (error: Error) => {
      if (error instanceof ApiError && error.code === "RESEND_COOLDOWN") {
        setCooldown(RESEND_COOLDOWN_SECONDS);
      }
      notifications.show({ color: "red", message: error.message });
    },
  });

  const resendLabel = cooldown > 0 ? `Resend in ${formatMMSS(cooldown)}` : "Resend code";
  const expiryText = codeExpired
    ? "This code has expired. Request a new one."
    : `This code expires in ${formatMMSS(codeSecondsLeft)}.`;

  return (
    <Stack align="center">
      <Text size="sm" c="dimmed" ta="center">
        Enter the 6-digit code sent to <strong>{email}</strong>.
      </Text>
      <Text size="sm" c={codeExpired ? "red" : "dimmed"} ta="center">
        {expiryText}
      </Text>
      <Group>
        <PinInput
          length={6}
          type="number"
          value={code}
          onChange={setCode}
          onComplete={(value) => verifyMutation.mutate(value)}
          disabled={verifyMutation.isPending || codeExpired}
          autoFocus
        />
      </Group>
      <Button
        fullWidth
        loading={verifyMutation.isPending}
        disabled={code.length !== 6 || codeExpired}
        onClick={() => verifyMutation.mutate(code)}
      >
        Verify and continue
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
