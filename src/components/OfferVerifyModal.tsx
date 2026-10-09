"use client";

import { useState } from "react";
import Link from "next/link";
import { Alert, Button, Modal, PinInput, Stack, Text, TextInput } from "@mantine/core";
import { isValidEmail } from "@/lib/emailAddress";
import { useEmailFieldError } from "@/lib/useEmailFieldError";

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
      if (!res.ok) throw new Error(data?.message ?? "Please try again.");
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
    } catch (e) {
      setError(e instanceof Error ? e.message : "Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal opened={opened} onClose={onClose} title="Verify your email" centered size="sm" radius="lg">
      <Stack gap="md">
        {error && <Alert color="red" role="alert">{error}</Alert>}

        {step === "email" && (
          <form onSubmit={(e) => { e.preventDefault(); void call("request"); }}>
            <Stack gap="md">
              <Text size="sm" c="dimmed">This offer is limited per customer, so we need to confirm who you are. We’ll email you a one-time code — no password needed.</Text>
              <TextInput label="Email" type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.currentTarget.value)} onBlur={emailError.onBlur} error={emailError.error} data-autofocus />
              <Button type="submit" loading={busy} disabled={!emailOk}>Send code</Button>
            </Stack>
          </form>
        )}

        {step === "code" && (
          <form onSubmit={(e) => { e.preventDefault(); void call("verify"); }}>
            <Stack gap="md" align="stretch">
              <Text size="sm" c="dimmed">Enter the six-digit code we sent to {masked}.</Text>
              <PinInput length={6} type="number" oneTimeCode value={code} onChange={setCode} aria-label="Email verification code" autoFocus />
              <Button type="submit" loading={busy} disabled={code.length !== 6}>Verify</Button>
              <Button variant="subtle" disabled={busy} onClick={() => void call("request")}>Send another code</Button>
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
