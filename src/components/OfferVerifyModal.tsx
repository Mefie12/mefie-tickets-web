"use client";

import { useState } from "react";
import Link from "next/link";
import { Alert, Button, Modal, Stack, Text, TextInput } from "@mantine/core";
import { isValidEmail } from "@/lib/emailAddress";
import { useEmailFieldError } from "@/lib/useEmailFieldError";
import { buildApiError } from "@/lib/authApi";
import { formatMMSS, resendLabel } from "@/lib/otpTiming";
import { otpErrorMessage, useOtpTimers } from "@/lib/useOtpTimers";
import { OtpBlockedNotice, OtpExpiry, OtpPinInput } from "@/components/OtpCodeStatus";

type Step = "email" | "code" | "needs-account";

/**
 * Inline email verification for offers that have a per-customer limit.
 * Uses the same passwordless consumer endpoints as the /login page, but as
 * a compact sheet so the buyer never leaves the ticket panel or checkout —
 * their cart and typed code stay put, and the quote re-runs when this
 * reports `onVerified`. A brand-new customer (who needs name/phone/legal
 * consent) is sent to /register and returned here afterwards.
 */
export function OfferVerifyModal({ opened, onClose, onVerified, returnPath, defaultEmail }: {
  opened: boolean;
  onClose: () => void;
  onVerified: () => void;
  /** Local path to come back to after creating an account (the cart survives in sessionStorage). */
  returnPath: string;
  defaultEmail?: string;
}) {
  const [step, setStep] = useState<Step>("email");
  const [email, setEmail] = useState(defaultEmail ?? "");
  const emailOk = isValidEmail(email);
  const emailError = useEmailFieldError(email, emailOk);
  const [code, setCode] = useState("");
  const [masked, setMasked] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const timers = useOtpTimers();

  async function call(action: "request" | "verify") {
    if (action === "request" && !emailOk) return;
    setBusy(true);
    setError("");
    try {
      const body = action === "verify" ? { code } : { email, intent: "login" };
      const res = await fetch(`/api/public/consumer/account/${action}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw buildApiError(res, data);
      if (data.status === "authenticated") {
        onVerified();
        onClose();
        return;
      }
      if (data.status === "completion_required") {
        setStep("needs-account");
        return;
      }
      setMasked(data.masked_email ?? email);
      setCode("");
      setStep("code");
      timers.noteSent(data);
    } catch (e) {
      if (!(action === "request" && timers.noteRateLimited(e))) setError(otpErrorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal opened={opened} onClose={onClose} title="Verify your email" centered size="sm" radius="lg">
      <Stack gap="md">
        {error && <Alert color="red" role="alert">{error}</Alert>}
        {timers.blocked && <OtpBlockedNotice message={timers.blockedMessage} seconds={timers.resendSeconds} />}

        {step === "email" && (
          <form onSubmit={(e) => { e.preventDefault(); void call("request"); }}>
            <Stack gap="md">
              <Text size="sm" c="dimmed">This offer is limited per customer, so we need to confirm who you are. We’ll email you a one-time code — no password needed.</Text>
              <TextInput label="Email" type="email" required autoComplete="email" value={email} onChange={(e) => { setEmail(e.currentTarget.value); if (timers.blocked) timers.clear(); }} onBlur={emailError.onBlur} error={emailError.error} data-autofocus />
              <Button type="submit" loading={busy} disabled={!emailOk || timers.blocked}>{timers.blocked ? `Try again in ${formatMMSS(timers.resendSeconds)}` : "Send code"}</Button>
            </Stack>
          </form>
        )}

        {step === "code" && (
          <form onSubmit={(e) => { e.preventDefault(); void call("verify"); }}>
            <Stack gap="md" align="stretch">
              <Text size="sm" c="dimmed">Enter the six-digit code we sent to {masked}.</Text>
              <OtpExpiry seconds={timers.expirySeconds} expired={timers.expired} known={timers.hasExpiry} />
              <OtpPinInput length={6} type="number" oneTimeCode value={code} onChange={setCode} disabled={timers.expired} aria-label="Email verification code" autoFocus />
              <Button type="submit" loading={busy} disabled={code.length !== 6 || timers.expired}>Verify</Button>
              <Button variant={timers.expired ? "filled" : "subtle"} disabled={busy || timers.resendSeconds > 0} onClick={() => void call("request")}>{resendLabel(timers.resendSeconds, timers.expired ? "Send a new code" : "Resend code")}</Button>
            </Stack>
          </form>
        )}

        {step === "needs-account" && (
          <Stack gap="md">
            <Text size="sm">Looks like you’re new here. Create your free ticket account, then come back — your tickets and code will be waiting.</Text>
            <Button component={Link} href={`/register?next=${encodeURIComponent(returnPath)}`}>Create account</Button>
          </Stack>
        )}
      </Stack>
    </Modal>
  );
}
