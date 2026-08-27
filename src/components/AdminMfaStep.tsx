"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation } from "@tanstack/react-query";
import { Alert, Button, PasswordInput, Stack, Text } from "@mantine/core";
import { useForm } from "@mantine/form";
import { AdminMfaPanel } from "@/components/AdminMfaPanel";
import { reauthenticateAdmin, type AdminAuthReason, type AdminChallenge } from "@/lib/adminAuthApi";
const reasonText: Partial<Record<AdminAuthReason, string>> = { expired: "Your admin session reached its maximum lifetime.", idle_timeout: "Your admin session ended after a period of inactivity.", revoked: "This admin session was revoked.", membership_changed: "Your platform access changed and must be verified again.", authentication_required: "Confirm your identity to enter the Admin Console." };
export function AdminMfaStep({ initialChallenge, reason, returnTo }: { initialChallenge: AdminChallenge | null; reason: AdminAuthReason; returnTo: string }) {
  const router = useRouter(); const [challenge, setChallenge] = useState(initialChallenge);
  const form = useForm({ initialValues: { password: "" }, validate: { password: (v) => v ? null : "Password is required" } });
  const mutation = useMutation({ mutationFn: (password: string) => reauthenticateAdmin(password, "login"), onSuccess: ({ challenge: next }) => { setChallenge(next); form.reset(); },
    onError: (error: Error & { fieldError?: (field: string) => string | undefined }) => form.setFieldError("password", error.fieldError?.("password") ?? error.message) });
  if (challenge) return <AdminMfaPanel initialChallenge={challenge} onVerified={() => router.replace(returnTo)} />;
  return <Stack><Alert color="yellow" title="Admin session ended">{reasonText[reason] ?? reasonText.authentication_required} No verification code has been sent.</Alert>
    <Text size="sm" c="dimmed">Enter your password. After it is confirmed, we will send a verification code automatically.</Text>
    <form onSubmit={form.onSubmit(({ password }) => mutation.mutate(password))}><Stack><PasswordInput label="Password" autoComplete="current-password" {...form.getInputProps("password")} /><Button type="submit" loading={mutation.isPending}>Continue securely</Button></Stack></form></Stack>;
}
