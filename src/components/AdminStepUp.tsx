"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation } from "@tanstack/react-query";
import { Alert, Button, PasswordInput, Stack } from "@mantine/core";
import { useForm } from "@mantine/form";
import { AdminMfaPanel } from "@/components/AdminMfaPanel";
import { reauthenticateAdmin, type AdminChallenge } from "@/lib/adminAuthApi";
export function AdminStepUp({ returnTo }: { returnTo: string }) {
  const router = useRouter(); const [challenge, setChallenge] = useState<AdminChallenge | null>(null);
  const form = useForm({ initialValues: { password: "" }, validate: { password: (v) => v ? null : "Password is required" } });
  const mutation = useMutation({ mutationFn: (password: string) => reauthenticateAdmin(password, "step_up"), onSuccess: (data) => setChallenge(data.challenge),
    onError: (error: Error & { fieldError?: (field: string) => string | undefined }) => form.setFieldError("password", error.fieldError?.("password") ?? error.message) });
  if (challenge) return <AdminMfaPanel initialChallenge={challenge} onVerified={() => router.replace(returnTo)} />;
  return <Stack><Alert color="yellow">This action requires a password and verification code completed within the last 15 minutes. The original action will not run automatically.</Alert>
    <form onSubmit={form.onSubmit(({ password }) => mutation.mutate(password))}><Stack><PasswordInput label="Password" autoComplete="current-password" {...form.getInputProps("password")} /><Button type="submit" loading={mutation.isPending}>Send verification code</Button></Stack></form></Stack>;
}
