"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation } from "@tanstack/react-query";
import { Alert, Button, Group, Stack, Text } from "@mantine/core";
import { IconAlertTriangle, IconMail } from "@tabler/icons-react";
import { requestInviteOtp, verifyInviteOtp } from "@/lib/eventInvitationApi";
import { resolveApiErrorMessage } from "@/lib/apiErrorMessages";
import { formatMMSS, resendLabel } from "@/lib/otpTiming";
import { otpErrorMessage, useOtpTimers } from "@/lib/useOtpTimers";
import { OtpBlockedNotice, OtpExpiry, OtpPinInput } from "@/components/OtpCodeStatus";

/**
 * The inline "verify it's you" step for a personalized invitation link
 * (mirrors VerifyLocatorFlow for the order-locator flow). The invited
 * email is already known from the invite-flow preview cookie, so unlike
 * the locator flow's "intro" phase this can name it upfront — but still
 * requires an explicit click to send the code, same as the locator flow,
 * rather than auto-sending on every page load/refresh.
 */
export function VerifyInviteFlow({ maskedEmail }: { maskedEmail: string }) {
  const router = useRouter();
  const [phase, setPhase] = useState<"intro" | "code">("intro");
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const timers = useOtpTimers();

  const send = useMutation({
    mutationFn: requestInviteOtp,
    onSuccess: (data) => {
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
    mutationFn: () => verifyInviteOtp(code),
    // A refresh, not a push: this re-runs the event page's server fetch
    // with the now-authenticated mefie_consumer_session cookie, so it
    // renders the actual event in place rather than navigating away.
    onSuccess: () => router.refresh(),
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
        <Stack gap="md" align="center">
          <Text size="sm" c="dimmed" ta="center">
            We&apos;ll email a one-time code to <Text span fw={600}>{maskedEmail}</Text> to confirm it&apos;s you.
          </Text>
          <Button leftSection={<IconMail size={16} />} onClick={() => send.mutate()} loading={send.isPending} disabled={timers.blocked} size="md">
            {timers.blocked ? `Try again in ${formatMMSS(timers.resendSeconds)}` : "Email me a code"}
          </Button>
        </Stack>
      )}

      {phase === "code" && (
        <Stack gap="md" align="center">
          <Text size="sm" c="dimmed" ta="center">
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
          <Group justify="center" gap="md">
            <Button
              variant={timers.expired ? "filled" : "subtle"}
              size="sm"
              disabled={timers.resendSeconds > 0 || send.isPending}
              onClick={() => send.mutate()}
              loading={send.isPending}
            >
              {resendLabel(timers.resendSeconds, timers.expired ? "Send a new code" : "Resend code")}
            </Button>
            <Button size="sm" onClick={() => verify.mutate()} loading={verify.isPending} disabled={code.length !== 6 || timers.expired}>
              Verify
            </Button>
          </Group>
        </Stack>
      )}
    </Stack>
  );
}
