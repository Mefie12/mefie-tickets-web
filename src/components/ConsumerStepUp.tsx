"use client";

import { useEffect, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Alert, Button, Group, Stack } from "@mantine/core";
import { requestStepUp, verifyStepUp } from "@/lib/portalApi";
import { resolveApiErrorMessage } from "@/lib/apiErrorMessages";
import { resendLabel } from "@/lib/otpTiming";
import { otpErrorMessage, useOtpTimers } from "@/lib/useOtpTimers";
import { OtpBlockedNotice, OtpExpiry, OtpPinInput } from "@/components/OtpCodeStatus";

/**
 * Inline step-up: emails a code to the profile, verifies it, then calls
 * onVerified() so the caller can retry the guarded action. Freshness is
 * 15 min server-side (EnsureRecentConsumerStepUp), so a caller just
 * retries on STEP_UP_REQUIRED and shows this.
 */
export function ConsumerStepUp({ onVerified }: { onVerified: () => void }) {
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const timers = useOtpTimers();

  const send = useMutation({
    mutationFn: requestStepUp,
    onSuccess: (data) => {
      setSent(true);
      timers.noteSent(data);
      setCode("");
      setError(null);
    },
    onError: (e) => {
      if (!timers.noteRateLimited(e)) setError(resolveApiErrorMessage(e));
    },
  });

  const verify = useMutation({
    mutationFn: () => verifyStepUp(code),
    onSuccess: () => onVerified(),
    onError: (e) => {
      setError(otpErrorMessage(e));
      setCode("");
    },
  });

  useEffect(() => {
    if (!sent && !send.isPending) send.mutate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <Stack gap="sm">
      <Alert color="yellow" variant="light">
        For your security, confirm it&apos;s you. We&apos;ve emailed a 6-digit code.
      </Alert>
      {timers.blocked && <OtpBlockedNotice message={timers.blockedMessage} seconds={timers.resendSeconds} />}
      {error && (
        <Alert color="red" variant="light" role="alert">
          {error}
        </Alert>
      )}
      {sent && <OtpExpiry seconds={timers.expirySeconds} expired={timers.expired} known={timers.hasExpiry} />}
      <OtpPinInput
        disabled={timers.expired}
        length={6}
        type="number"
        inputMode="numeric"
        oneTimeCode
        value={code}
        onChange={setCode}
        onComplete={(v) => {
          setCode(v);
          verify.mutate();
        }}
        aria-label="Step-up code"
        error={verify.isError}
      />
      <Group justify="space-between">
        <Button
          size="xs"
          variant={timers.expired ? "filled" : "subtle"}
          onClick={() => send.mutate()}
          loading={send.isPending}
          disabled={send.isPending || timers.resendSeconds > 0}
        >
          {resendLabel(timers.resendSeconds, timers.expired ? "Send a new code" : "Resend code")}
        </Button>
        <Button size="xs" onClick={() => verify.mutate()} loading={verify.isPending} disabled={code.length !== 6 || timers.expired}>
          Confirm
        </Button>
      </Group>
    </Stack>
  );
}
