"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Alert, Button, Center, Loader, PasswordInput, Stack, Table, Text, TextInput } from "@mantine/core";
import { useForm } from "@mantine/form";
import { AuthLayout } from "@/components/AuthLayout";
import { ApiError, fetchCurrentUser, logout } from "@/lib/authApi";

type Preview = { requires_login: boolean; invitation: { invited_email: string; expires_at: string; allocation: { distributor: { name: string; company: string | null }; program: { status: "DISABLED" | "ACTIVE" | "CLOSED"; event: { title: string; organization: { name: string } } }; lines: Array<{ id: number; quantity_allocated: number; product: { title: string } }> } } };
async function call<T>(path: string, body?: unknown): Promise<T> { const r = await fetch(path, { method: body === undefined ? "GET" : "POST", headers: { "Content-Type": "application/json" }, body: body === undefined ? undefined : JSON.stringify(body) }); const data = await r.json(); if (!r.ok) throw new ApiError(data.message, r.status, data.errors); return data; }

export function AcceptComplimentaryInvitation({ token }: { token: string }) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const preview = useQuery({ queryKey: ["complimentary-invitation", token], queryFn: () => call<Preview>(`/api/auth/complimentary-invitation/${encodeURIComponent(token)}`), retry: false });
  // Always check who (if anyone) is currently logged in, not just when an
  // account already exists for the invited email — otherwise a visitor
  // who's signed into a different account fills in the whole
  // create-password form before ever finding out it can't work. A 401
  // here just means "nobody's logged in," which is the normal case.
  const current = useQuery({ queryKey: ["current-user-for-complimentary-invitation"], queryFn: fetchCurrentUser, enabled: !!preview.data, retry: false });
  const logoutMutation = useMutation({ mutationFn: logout, onSuccess: () => queryClient.invalidateQueries({ queryKey: ["current-user-for-complimentary-invitation"] }) });
  const form = useForm({ initialValues: { password: "", password_confirmation: "" }, validate: { password: (v) => v.length < 8 ? "Use at least 8 characters" : null, password_confirmation: (v, values) => v !== values.password ? "Passwords do not match" : null } });
  const accept = useMutation({ mutationFn: (body: unknown) => call(`/api/auth/complimentary-invitation/${encodeURIComponent(token)}`, body), onSuccess: () => router.push("/distributor") });
  if (preview.isLoading || current.isLoading) return <AuthLayout title="Checking your allocation…"><Center py="xl"><Loader /></Center></AuthLayout>;
  if (preview.isError || !preview.data) return <AuthLayout title="Invitation unavailable"><Alert color="red">This invitation is invalid, expired, or was replaced. Ask the organizer to resend it.</Alert></AuthLayout>;
  const data = preview.data; const allocation = data.invitation.allocation;
  // React Query keeps `data` at its last successful value even after a
  // later refetch fails (e.g. right after logging out, when the next
  // /api/users/me correctly 401s) — so this must gate on isSuccess, not
  // just data being present, or a mismatch state can never clear.
  const loggedInAs = current.isSuccess ? current.data.user.email : null;
  const sessionMismatch = loggedInAs !== null && loggedInAs !== data.invitation.invited_email;
  const details = <Stack><Text>You&apos;ve been invited by <strong>{allocation.program.event.organization.name}</strong> to distribute tickets for <strong>{allocation.program.event.title}</strong>.</Text>{allocation.program.status !== "ACTIVE" && <Alert color="yellow">This allocation is currently paused by the organizer. You may accept it now, but ticket issuance remains unavailable until complimentary ticketing is re-enabled.</Alert>}<Table><Table.Thead><Table.Tr><Table.Th>Ticket</Table.Th><Table.Th>Quantity</Table.Th></Table.Tr></Table.Thead><Table.Tbody>{allocation.lines.map((line) => <Table.Tr key={line.id}><Table.Td>{line.product.title}</Table.Td><Table.Td>{line.quantity_allocated}</Table.Td></Table.Tr>)}</Table.Tbody></Table><TextInput label="Invited email" value={data.invitation.invited_email} readOnly /><Text size="xs" c="dimmed">Invitation expires {new Date(data.invitation.expires_at).toLocaleString()}.</Text></Stack>;
  if (data.requires_login && loggedInAs !== data.invitation.invited_email) { const next = `/distributor/invitations/${encodeURIComponent(token)}`; return <AuthLayout title="Log in to accept"><Stack>{details}<Button component={Link} href={`/login?next=${encodeURIComponent(next)}`}>Log in as {data.invitation.invited_email}</Button></Stack></AuthLayout>; }
  if (data.requires_login) return <AuthLayout title="Accept ticket allocation"><Stack>{details}{accept.isError && <Alert color="red">{accept.error.message}</Alert>}<Button loading={accept.isPending} onClick={() => accept.mutate({})}>Accept allocation</Button></Stack></AuthLayout>;
  if (sessionMismatch) return <AuthLayout title="Log out to continue"><Stack>{details}<Alert color="yellow">You&apos;re currently logged in as {loggedInAs}. Log out to accept this invitation as {data.invitation.invited_email}.</Alert><Button loading={logoutMutation.isPending} onClick={() => logoutMutation.mutate()}>Log out and continue</Button></Stack></AuthLayout>;
  return <AuthLayout title="Create your distributor account" subtitle="Set a password to accept this allocation. "><form onSubmit={form.onSubmit((values) => accept.mutate(values))}><Stack>{details}{accept.isError && <Alert color="red">{accept.error.message}</Alert>}<PasswordInput label="Password" {...form.getInputProps("password")} /><PasswordInput label="Confirm password" {...form.getInputProps("password_confirmation")} /><Button type="submit" loading={accept.isPending}>Create account & accept</Button></Stack></form></AuthLayout>;
}
