"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation } from "@tanstack/react-query";
import { Alert, Button, Group, Stack, Text } from "@mantine/core";
import { IconAlertTriangle, IconMail } from "@tabler/icons-react";
import { requestOtp, verifyOtp } from "@/lib/locatorApi";
import { resolveApiErrorMessage } from "@/lib/apiErrorMessages";
import { formatMMSS, resendLabel } from "@/lib/otpTiming";
import { otpErrorMessage, useOtpTimers } from "@/lib/useOtpTimers";
import { OtpBlockedNotice, OtpExpiry, OtpPinInput } from "@/components/OtpCodeStatus";

const ENTRY_STATE_COPY: Record<string, string> = {
  expired: "That link has expired. Check your most recent confirmation email for a fresh one.",
  mismatch: "You're signed in as a different person. Enter the code sent to this order's email to switch.",
  notfound: "We couldn't find that order link. Check your confirmation email and try the link again.",
};

/**
 * The token-free landing after /t/{token} (docs/17 §9, §18). Sends a
 * one-time code to the order's email (never client-supplied), verifies
 * it, and lands the buyer in the portal with a fresh
 * `mefie_consumer_session`.
 */
export function VerifyLocatorFlow({ entryState }: { entryState?: string }) {
  const router = useRouter();
  const [phase, setPhase] = useState<"intro" | "code">("intro");
  const [maskedEmail, setMaskedEmail] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(entryState ? ENTRY_STATE_COPY[entryState] ?? null : null);

  const timers = useOtpTimers();

  const send = useMutation({
    mutationFn: requestOtp,
    onSuccess: (data) => {
      setMaskedEmail(data.masked_email);
      setPhase("code");
      timers.noteSent(data);
      setCode("");
      setError(null);
    },
    onError: (err) => {
      if (!timers.noteRateLimited(err)) setError(resolveApiErrorMessage(err));
    },
  });

  const verify = useMutation({
    mutationFn: () => verifyOtp(code),
    onSuccess: () => router.push("/tickets"),
    onError: (err) => {
      setError(otpErrorMessage(err));
      setCode("");
    },
  });

  return (
    <Stack gap="lg">
      {error && (
        <Alert color="red" icon={<IconAlertTriangle size={18} />} variant="light" role="alert">
          {error}
        </Alert>
      )}

      {timers.blocked && <OtpBlockedNotice message={timers.blockedMessage} seconds={timers.resendSeconds} />}

      {phase === "intro" && (
        <Stack gap="md">
          <Text size="sm" c="dimmed">
            To keep your tickets private, we&apos;ll email a one-time code to the address on this order.
          </Text>
          <Button
            leftSection={<IconMail size={16} />}
            onClick={() => send.mutate()}
            loading={send.isPending}
            disabled={timers.blocked}
            size="md"
          >
            {timers.blocked ? `Try again in ${formatMMSS(timers.resendSeconds)}` : "Email me a code"}
          </Button>
        </Stack>
      )}

      {phase === "code" && (
        <Stack gap="md">
          <Text size="sm" c="dimmed">
            Enter the 6-digit code we sent to <Text span fw={600}>{maskedEmail}</Text>.
          </Text>
          <OtpExpiry seconds={timers.expirySeconds} expired={timers.expired} known={timers.hasExpiry} />
          <OtpPinInput
            disabled={timers.expired}
            length={6}
            type="number"
            inputMode="numeric"
            oneTimeCode
            value={code}
            onChange={setCode}
            onComplete={(value) => {
              setCode(value);
              verify.mutate();
            }}
            aria-label="One-time code"
            error={verify.isError}
          />
          <Group justify="space-between">
            <Button
              variant={timers.expired ? "filled" : "subtle"}
              size="sm"
              disabled={timers.resendSeconds > 0 || send.isPending}
              onClick={() => send.mutate()}
              loading={send.isPending}
            >
              {resendLabel(timers.resendSeconds, timers.expired ? "Send a new code" : "Resend code")}
            </Button>
            <Button
              size="sm"
              onClick={() => verify.mutate()}
              loading={verify.isPending}
              disabled={code.length !== 6 || timers.expired}
            >
              Verify
            </Button>
          </Group>
        </Stack>
      )}
    </Stack>
  );
}
