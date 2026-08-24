"use client";
import { useEffect, useMemo, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Alert, Anchor, Button, Group, PinInput, Stack, Text } from "@mantine/core";
import { notifications } from "@mantine/notifications";
import { ApiError } from "@/lib/authApi";
import { resendAdminMfa, verifyAdminMfa, type AdminChallenge, type AdminSession } from "@/lib/adminAuthApi";
function secondsUntil(value: string | null): number { return value ? Math.max(0, Math.ceil((new Date(value).getTime() - Date.now()) / 1000)) : 0; }
function formatMMSS(seconds: number): string { return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`; }
export function AdminMfaPanel({ initialChallenge, onVerified }: { initialChallenge: AdminChallenge; onVerified: (session: AdminSession) => void }) {
  const [challenge, setChallenge] = useState(initialChallenge); const [code, setCode] = useState(""); const [, tick] = useState(0);
  useEffect(() => { const timer = window.setInterval(() => tick((n) => n + 1), 1000); return () => window.clearInterval(timer); }, []);
  const expiry = secondsUntil(challenge.expires_at); const cooldown = secondsUntil(challenge.resend_available_at); const expired = challenge.status === "expired" || expiry === 0;
  const verifyMutation = useMutation({ mutationFn: () => verifyAdminMfa(challenge.id, code), onSuccess: onVerified,
    onError: (error: Error) => { notifications.show({ color: "red", message: error instanceof ApiError ? (error.fieldError("code") ?? error.message) : error.message }); setCode(""); } });
  const resendMutation = useMutation({ mutationFn: () => resendAdminMfa(challenge.id), onSuccess: ({ challenge: next }) => { setChallenge(next); setCode(""); notifications.show({ color: "teal", message: "A new code has been sent." }); },
    onError: (error: Error) => notifications.show({ color: "red", message: error.message }) });
  const delivery = useMemo(() => challenge.masked_email, [challenge.masked_email]);
  return <Stack align="center"><Text size="sm" c="dimmed" ta="center">Enter the 6-digit code sent to <strong>{delivery}</strong>.</Text>
    <Text size="sm" c={expired ? "red" : "dimmed"} ta="center">{expired ? "This code has expired. Sign in again to continue." : `This code expires in ${formatMMSS(expiry)}.`}</Text>
    {challenge.attempts_remaining < 5 && !expired && <Alert color="yellow" w="100%">{challenge.attempts_remaining} verification attempts remaining.</Alert>}
    <Group><PinInput length={6} type="number" value={code} onChange={setCode} disabled={verifyMutation.isPending || expired} autoFocus /></Group>
    <Button fullWidth loading={verifyMutation.isPending} disabled={code.length !== 6 || expired} onClick={() => verifyMutation.mutate()}>Verify and continue</Button>
    {!expired && <Text size="sm" c="dimmed">Didn&apos;t get a code?{" "}<Anchor component="button" type="button" onClick={() => resendMutation.mutate()} disabled={cooldown > 0 || resendMutation.isPending}>{cooldown > 0 ? `Resend in ${formatMMSS(cooldown)}` : "Resend code"}</Anchor></Text>}</Stack>;
}
