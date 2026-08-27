import { redirect } from "next/navigation";
import { Alert } from "@mantine/core";
import { getAdminAuthState } from "@/lib/adminSession";
import { AuthLayout } from "@/components/AuthLayout";
import { AdminMfaStep } from "@/components/AdminMfaStep";

export default async function AdminMfaPage({ searchParams }: { searchParams: Promise<{ returnTo?: string }> }) {
  const state = await getAdminAuthState();
  const requested = (await searchParams).returnTo;
  const returnTo = requested?.startsWith("/admin/") && !requested.startsWith("//") ? requested : "/admin/dashboard";

  if (state.status === "unauthenticated") {
    redirect("/admin/login");
  }
  if (state.status === "unverified") {
    redirect("/verify-email");
  }
  if (state.status === "privileged") {
    redirect(returnTo);
  }

  if (state.status === "service_error") return <AuthLayout title="Admin Console unavailable"><Alert color="red">We could not check your admin session. Retry in a moment. No verification code was sent.</Alert></AuthLayout>;

  if (state.status === "unauthorized") {
    return (
      <AuthLayout title="Not authorized">
        <Alert color="red">
          {state.user.email} doesn&apos;t have access to the Mefie Admin Console. If you believe this is a mistake,
          ask a Super Admin to invite you.
        </Alert>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout title="Verify it's you" subtitle="One more step before you can enter the console.">
      <AdminMfaStep initialChallenge={state.challenge} reason={state.reason} returnTo={returnTo} />
    </AuthLayout>
  );
}
