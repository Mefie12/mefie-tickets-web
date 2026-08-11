"use client";

import Link from "next/link";
import { useSearchParams, useRouter } from "next/navigation";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useForm } from "@mantine/form";
import { Alert, Button, Center, Loader, PasswordInput, SimpleGrid, Stack, Text, TextInput } from "@mantine/core";
import { AuthLayout } from "@/components/AuthLayout";
import { fetchCurrentUser, ApiError, type PlatformRole } from "@/lib/authApi";
import {
  acceptAdminInvitation,
  acceptAdminInvitationAsCurrentUser,
  previewAdminInvitation,
  type PlatformInvitationPreview,
} from "@/lib/adminAuthApi";

const ROLE_LABEL: Record<PlatformRole, string> = {
  PLATFORM_SUPER_ADMIN: "Super Admin",
  PLATFORM_OPERATIONS: "Operations",
  PLATFORM_FINANCE: "Finance",
  PLATFORM_SUPPORT: "Support",
};

/**
 * Mirrors AcceptInvitationForm's shape for Platform Admin invitations —
 * see that component's docblock for the general three-branch pattern
 * (new email / requires login / already logged in as invited email).
 * Accepting only creates the Sanctum session + Platform membership;
 * reaching the console itself still requires the separate MFA step, so
 * every branch here lands on /admin/mfa, not /admin/dashboard directly.
 */
export function AcceptAdminInvitationForm() {
  const router = useRouter();
  const token = useSearchParams().get("token");

  const preview = useQuery({
    queryKey: ["admin-invitation-preview", token],
    queryFn: () => previewAdminInvitation(token!),
    enabled: !!token,
    retry: false,
  });

  const currentUser = useQuery({
    queryKey: ["current-user-for-admin-invitation"],
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
    return <LogInToAcceptStep token={token} email={invitation.email} />;
  }

  return <ConfirmAcceptStep token={token} invitation={invitation} onAccepted={() => router.push("/admin/mfa")} />;
}

function LogInToAcceptStep({ token, email }: { token: string; email: string }) {
  const nextUrl = `/admin/invitations/accept?token=${encodeURIComponent(token)}`;
  return (
    <AuthLayout title="Log in to accept">
      <Stack>
        <Text size="sm">
          This Admin Console invitation is for <strong>{email}</strong>, which already has an account. Log in as
          that address to accept it.
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
  invitation: PlatformInvitationPreview;
  onAccepted: () => void;
}) {
  const acceptMutation = useMutation({
    mutationFn: () => acceptAdminInvitationAsCurrentUser(token),
    onSuccess: onAccepted,
  });

  return (
    <AuthLayout title="Join the Admin Console">
      <Stack>
        <Text size="sm">Review your invitation details, then accept to continue to the verification step.</Text>
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

function CreatePasswordStep({ token, invitation }: { token: string; invitation: PlatformInvitationPreview }) {
  const router = useRouter();

  const form = useForm({
    initialValues: { password: "", password_confirmation: "" },
    validate: {
      password: (v) => (v.length < 8 ? "Must be at least 8 characters" : null),
      password_confirmation: (v, values) => (v !== values.password ? "Passwords do not match" : null),
    },
  });

  const acceptMutation = useMutation({
    mutationFn: (values: typeof form.values) => acceptAdminInvitation(token, values),
    onSuccess: () => router.push("/admin/mfa"),
    onError: (error: Error) => {
      if (error instanceof ApiError && error.errors) {
        form.setErrors(
          Object.fromEntries(Object.entries(error.errors).map(([field, messages]) => [field, messages[0]])),
        );
      }
    },
  });

  return (
    <AuthLayout title="Join the Admin Console" subtitle="Review your invitation details and create a password to continue.">
      <form onSubmit={form.onSubmit((values) => acceptMutation.mutate(values))}>
        <Stack>
          {acceptMutation.isError && !(acceptMutation.error instanceof ApiError && acceptMutation.error.errors) && (
            <Alert color="red">{(acceptMutation.error as Error).message}</Alert>
          )}
          <InvitationDetails invitation={invitation} />
          <PasswordInput label="Password" placeholder="At least 8 characters" {...form.getInputProps("password")} />
          <PasswordInput label="Confirm password" {...form.getInputProps("password_confirmation")} />
          <Button type="submit" fullWidth loading={acceptMutation.isPending} mt="sm">
            Accept invitation
          </Button>
        </Stack>
      </form>
    </AuthLayout>
  );
}

function InvitationDetails({ invitation }: { invitation: PlatformInvitationPreview }) {
  return (
    <SimpleGrid cols={{ base: 1, sm: 2 }}>
      <TextInput label="First name" value={invitation.first_name} readOnly />
      <TextInput label="Last name" value={invitation.last_name} readOnly />
      <TextInput label="Email" value={invitation.email} readOnly />
      <TextInput label="Role" value={ROLE_LABEL[invitation.role]} readOnly />
    </SimpleGrid>
  );
}
