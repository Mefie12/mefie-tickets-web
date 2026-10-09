"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Alert, Button, Center, Loader, PasswordInput, Stack, Text, TextInput } from "@mantine/core";
import { useForm } from "@mantine/form";
import { AuthLayout } from "@/components/AuthLayout";
import { ApiError, fetchCurrentUser, logout } from "@/lib/authApi";
import { formatInZone, type VenueInvitationPreview } from "@/lib/venueApi";

async function call<T>(path: string, body?: unknown): Promise<T> {
  const res = await fetch(path, { method: body === undefined ? "GET" : "POST", headers: { "Content-Type": "application/json" }, body: body === undefined ? undefined : JSON.stringify(body) });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(data?.message ?? "Something went wrong.", res.status, data?.errors);

  return data as T;
}

/** Invitation landing page for a venue agent. Same account rules as the distributor invitation. */
export function AcceptVenueInvitation({ token }: { token: string }) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const path = `/api/auth/venue-invitation/${encodeURIComponent(token)}`;
  const preview = useQuery({ queryKey: ["venue-invitation", token], queryFn: () => call<VenueInvitationPreview>(path), retry: false });
  // A 401 just means nobody is logged in, which is the normal case.
  const current = useQuery({ queryKey: ["current-user-for-venue-invitation"], queryFn: fetchCurrentUser, enabled: !!preview.data, retry: false });
  const logoutMutation = useMutation({ mutationFn: logout, onSuccess: () => queryClient.invalidateQueries({ queryKey: ["current-user-for-venue-invitation"] }) });
  const form = useForm({
    initialValues: { password: "", password_confirmation: "" },
    validate: {
      password: (v) => (v.length < 8 ? "Use at least 8 characters" : null),
      password_confirmation: (v, values) => (v !== values.password ? "Passwords do not match" : null),
    },
  });
  const accept = useMutation({ mutationFn: (body: unknown) => call(path, body), onSuccess: () => router.push("/venue") });

  if (preview.isLoading || current.isLoading) return <AuthLayout title="Checking your invitation…"><Center py="xl"><Loader /></Center></AuthLayout>;
  if (preview.isError || !preview.data) {
    return <AuthLayout title="Invitation unavailable"><Alert color="red">This invitation is invalid, expired, or was replaced. Ask the organizer to send a new one.</Alert></AuthLayout>;
  }

  const { invitation, requires_login: requiresLogin } = preview.data;
  // Gate on isSuccess: react-query keeps `data` at its last good value after a later failed refetch (e.g. right after logout).
  const loggedInAs = current.isSuccess ? current.data.user.email : null;
  const sessionMismatch = loggedInAs !== null && loggedInAs.toLowerCase() !== invitation.email.toLowerCase();

  const details = (
    <Stack>
      <Text><strong>{invitation.organizer}</strong> has invited you to follow how <strong>{invitation.event_title}</strong> is going{invitation.venue_name ? ` at ${invitation.venue_name}` : ""}{invitation.start_date ? ` (${formatInZone(invitation.start_date, invitation.timezone)})` : ""}.</Text>
      <Alert color="blue" variant="light">
        You will see ticket counts, expected attendance and live check-in numbers. You will not see prices, revenue or attendee details, and you cannot change anything.
      </Alert>
      <TextInput label="Invited email" value={invitation.email} readOnly />
      <Text size="xs" c="dimmed">Invitation expires {new Date(invitation.expires_at).toLocaleString()}.</Text>
    </Stack>
  );

  if (requiresLogin && loggedInAs?.toLowerCase() !== invitation.email.toLowerCase()) {
    const next = `/venue/invitations/${encodeURIComponent(token)}`;

    return (
      <AuthLayout title="Log in to accept">
        <Stack>
          {details}
          {sessionMismatch && (
            <Alert color="yellow">You&apos;re logged in as {loggedInAs}. Log out first to continue as {invitation.email}.</Alert>
          )}
          {sessionMismatch
            ? <Button loading={logoutMutation.isPending} onClick={() => logoutMutation.mutate()}>Log out and continue</Button>
            : <Button component={Link} href={`/organizers/login?next=${encodeURIComponent(next)}`}>Log in as {invitation.email}</Button>}
        </Stack>
      </AuthLayout>
    );
  }

  if (requiresLogin) {
    return (
      <AuthLayout title="Accept venue access">
        <Stack>
          {details}
          {accept.isError && <Alert color="red">{accept.error.message}</Alert>}
          <Button loading={accept.isPending} onClick={() => accept.mutate({})}>Accept invitation</Button>
        </Stack>
      </AuthLayout>
    );
  }

  if (sessionMismatch) {
    return (
      <AuthLayout title="Log out to continue">
        <Stack>
          {details}
          <Alert color="yellow">You&apos;re currently logged in as {loggedInAs}. Log out to accept this invitation as {invitation.email}.</Alert>
          <Button loading={logoutMutation.isPending} onClick={() => logoutMutation.mutate()}>Log out and continue</Button>
        </Stack>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout title="Create your account" subtitle="Set a password to accept this invitation.">
      <form onSubmit={form.onSubmit((values) => accept.mutate(values))}>
        <Stack>
          {details}
          {accept.isError && <Alert color="red">{accept.error.message}</Alert>}
          <PasswordInput label="Password" autoComplete="new-password" {...form.getInputProps("password")} />
          <PasswordInput label="Confirm password" autoComplete="new-password" {...form.getInputProps("password_confirmation")} />
          <Button type="submit" loading={accept.isPending}>Create account &amp; accept</Button>
        </Stack>
      </form>
    </AuthLayout>
  );
}
