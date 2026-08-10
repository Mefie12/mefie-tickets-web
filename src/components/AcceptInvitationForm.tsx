"use client";

import Link from "next/link";
import { useSearchParams, useRouter } from "next/navigation";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useForm } from "@mantine/form";
import { Alert, Button, Center, Loader, PasswordInput, SimpleGrid, Stack, Text, TextInput } from "@mantine/core";
import { AuthLayout } from "@/components/AuthLayout";
import {
  acceptInvitation,
  acceptInvitationAsCurrentUser,
  ApiError,
  fetchCurrentUser,
  type InvitationPreview,
  previewInvitation,
} from "@/lib/authApi";

/**
 * Reads ?token=... — matches the link shape built by the backend's
 * TeammateInvitationNotification (mefie-tickets-api
 * app/Notifications/TeammateInvitationNotification.php): FRONTEND_URL +
 * "/invitations/accept?token={token}".
 *
 * Three real states once the token itself checks out (see
 * GET /api/auth/invitation/{token}'s requires_login flag):
 *   - requires_login=false: brand-new email, show the create-password
 *     form (unchanged from before).
 *   - requires_login=true, not currently logged in as that email: prompt
 *     to log in first, then come back to this same URL.
 *   - requires_login=true, already logged in as that exact email: a
 *     one-click confirmation (no password form — the account already
 *     exists).
 */
export function AcceptInvitationForm() {
  const router = useRouter();
  const token = useSearchParams().get("token");

  const preview = useQuery({
    queryKey: ["invitation-preview", token],
    queryFn: () => previewInvitation(token!),
    enabled: !!token,
    retry: false,
  });

  // Only fetched once we know the invite requires an existing login —
  // no need to hit /api/users/me for the brand-new-email path.
  const currentUser = useQuery({
    queryKey: ["current-user-for-invitation"],
    queryFn: fetchCurrentUser,
    enabled: !!preview.data?.requires_login,
    retry: false,
  });

  if (!token) {
    return (
      <AuthLayout title="Invitation link invalid">
        <Alert color="red">This invitation link is missing its token. Ask for a new invite email.</Alert>
      </AuthLayout>
    );
  }

  if (preview.isLoading) {
    return (
      <AuthLayout title="Checking your invitation...">
        <Center py="xl">
          <Loader />
        </Center>
      </AuthLayout>
    );
  }

  if (preview.isError || !preview.data) {
    const message =
      preview.error instanceof ApiError ? preview.error.fieldError("token") ?? preview.error.message : undefined;
    return (
      <AuthLayout title="Invitation link invalid">
        <Alert color="red">{message ?? "This invitation link is invalid or has expired. Ask for a new invite email."}</Alert>
      </AuthLayout>
    );
  }

  const invitation = preview.data;

  if (!invitation.requires_login) {
    return <CreatePasswordStep token={token} invitation={invitation} />;
  }

  // requires_login: wait for the current-user check before deciding
  // between the login prompt and the confirmation button, so we don't
  // flash the wrong one.
  if (currentUser.isLoading) {
    return (
      <AuthLayout title="Checking your invitation...">
        <Center py="xl">
          <Loader />
        </Center>
      </AuthLayout>
    );
  }

  const loggedInAsInvitedEmail = currentUser.data?.user.email === invitation.email;

  if (!loggedInAsInvitedEmail) {
    return <LogInToAcceptStep token={token} organizationName={invitation.organization_name} email={invitation.email} />;
  }

  return (
    <ConfirmAcceptStep
      token={token}
      invitation={invitation}
      onAccepted={() => router.push("/dashboard")}
    />
  );
}

function LogInToAcceptStep({
  token,
  organizationName,
  email,
}: {
  token: string;
  organizationName: string;
  email: string;
}) {
  const nextUrl = `/invitations/accept?token=${encodeURIComponent(token)}`;
  return (
    <AuthLayout title="Log in to accept">
      <Stack>
        <Text size="sm">
          The invitation to join <strong>{organizationName}</strong> is for <strong>{email}</strong>, which already
          has an account. Log in as that address to accept it.
        </Text>
        <Button component={Link} href={`/login?next=${encodeURIComponent(nextUrl)}`} fullWidth>
          Log in to continue
        </Button>
      </Stack>
    </AuthLayout>
  );
}

function ConfirmAcceptStep({
  token,
  invitation,
  onAccepted,
}: {
  token: string;
  invitation: InvitationPreview;
  onAccepted: () => void;
}) {
  const acceptMutation = useMutation({
    mutationFn: () => acceptInvitationAsCurrentUser(token),
    onSuccess: onAccepted,
  });

  return (
    <AuthLayout title="Join your team">
      <Stack>
        <Text size="sm">Review your invitation details, then accept to join the team.</Text>
        <InvitationDetails invitation={invitation} />
        {acceptMutation.isError && (
          <Alert color="red">
            {acceptMutation.error instanceof ApiError ? acceptMutation.error.message : "Something went wrong."}
          </Alert>
        )}
        <Button fullWidth loading={acceptMutation.isPending} onClick={() => acceptMutation.mutate()}>
          Accept invitation
        </Button>
      </Stack>
    </AuthLayout>
  );
}

function CreatePasswordStep({ token, invitation }: { token: string; invitation: InvitationPreview }) {
  const router = useRouter();

  const form = useForm({
    initialValues: { password: "", password_confirmation: "" },
    validate: {
      password: (v) => (v.length < 8 ? "Must be at least 8 characters" : null),
      password_confirmation: (v, values) => (v !== values.password ? "Passwords do not match" : null),
    },
  });

  const acceptMutation = useMutation({
    mutationFn: (values: typeof form.values) => acceptInvitation(token, values),
    // No org-level setup for an invited teammate to do — /settings is
    // just the user's own profile, and the dashboard is the natural
    // landing spot once they're in.
    onSuccess: () => router.push("/dashboard"),
    onError: (error: Error) => {
      if (error instanceof ApiError && error.errors) {
        form.setErrors(
          Object.fromEntries(Object.entries(error.errors).map(([field, messages]) => [field, messages[0]])),
        );
      }
    },
  });

  return (
    <AuthLayout title="Join your team" subtitle="Review your invitation details and create a password to continue.">
      <form onSubmit={form.onSubmit((values) => acceptMutation.mutate(values))}>
        <Stack>
          {acceptMutation.isError && !(acceptMutation.error instanceof ApiError && acceptMutation.error.errors) && (
            <Alert color="red">{(acceptMutation.error as Error).message}</Alert>
          )}
          <InvitationDetails invitation={invitation} />
          <PasswordInput
            label="Password"
            placeholder="At least 8 characters"
            {...form.getInputProps("password")}
          />
          <PasswordInput label="Confirm password" {...form.getInputProps("password_confirmation")} />
          <Button type="submit" fullWidth loading={acceptMutation.isPending} mt="sm">
            Accept invitation
          </Button>
        </Stack>
      </form>
    </AuthLayout>
  );
}

function InvitationDetails({ invitation }: { invitation: InvitationPreview }) {
  const roleLabel = invitation.role === "SUPERADMIN" ? "Super Admin" : invitation.role === "ADMIN" ? "Admin" : "Organizer";

  return (
    <SimpleGrid cols={{ base: 1, sm: 2 }}>
      <TextInput label="First name" value={invitation.first_name} readOnly />
      <TextInput label="Last name" value={invitation.last_name} readOnly />
      <TextInput label="Email" value={invitation.email} readOnly />
      <TextInput label="Phone" value={invitation.phone ?? "Not provided"} readOnly />
      <TextInput label="Organization" value={invitation.organization_name} readOnly />
      <TextInput label="Role" value={roleLabel} readOnly />
    </SimpleGrid>
  );
}
