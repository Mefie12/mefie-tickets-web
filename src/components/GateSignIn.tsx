"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation } from "@tanstack/react-query";
import { Alert, Button, Stack, TextInput } from "@mantine/core";
import { IconScan } from "@tabler/icons-react";
import { startGateSession } from "@/lib/gateApi";
import { rememberGateSession } from "@/lib/gateSession";
import { resolveApiErrorMessage } from "@/lib/apiErrorMessages";
import { AuthLayout } from "@/components/AuthLayout";

/**
 * Gate device sign-in (docs/17 §13.1). The organizer hands the operator
 * the event id, the check-in list code, the pass name and its secret
 * (prefillable via ?event= &list= &label=). On success the isolated
 * mefie_gate_session cookie is set and we go straight to the roster.
 */
export function GateSignIn({
  defaults,
}: {
  defaults: { event?: string; list?: string; label?: string };
}) {
  const router = useRouter();
  const [eventId, setEventId] = useState(defaults.event ?? "");
  const [listCode, setListCode] = useState(defaults.list ?? "");
  const [label, setLabel] = useState(defaults.label ?? "");
  const [secret, setSecret] = useState("");
  const [error, setError] = useState<string | null>(null);

  const signIn = useMutation({
    mutationFn: () => {
      const evId = Number(eventId);
      if (!evId) return Promise.reject(new Error("Enter the event ID."));
      if (!listCode.trim()) return Promise.reject(new Error("Enter the check-in list code."));
      if (!label.trim() || !secret.trim()) return Promise.reject(new Error("Enter the pass name and secret."));
      return startGateSession({ event_id: evId, label: label.trim(), secret: secret.trim() });
    },
    onSuccess: (info) => {
      rememberGateSession(info);
      router.replace(`/gate/lists/${encodeURIComponent(listCode.trim())}`);
    },
    onError: (e) => setError(resolveApiErrorMessage(e)),
  });

  return (
    <AuthLayout title="Gate sign-in" subtitle="Use the details the organizer gave you.">
      <Stack gap="md">
        {error && (
          <Alert color="red" variant="light" withCloseButton onClose={() => setError(null)}>
            {error}
          </Alert>
        )}
        <TextInput label="Event ID" inputMode="numeric" value={eventId} onChange={(e) => setEventId(e.currentTarget.value)} />
        <TextInput label="Check-in list code" value={listCode} onChange={(e) => setListCode(e.currentTarget.value)} />
        <TextInput label="Pass name" value={label} onChange={(e) => setLabel(e.currentTarget.value)} />
        <TextInput
          label="Secret"
          type="password"
          value={secret}
          onChange={(e) => setSecret(e.currentTarget.value)}
          onKeyDown={(e) => e.key === "Enter" && signIn.mutate()}
        />
        <Button leftSection={<IconScan size={16} />} onClick={() => signIn.mutate()} loading={signIn.isPending} size="md">
          Start scanning
        </Button>
      </Stack>
    </AuthLayout>
  );
}
