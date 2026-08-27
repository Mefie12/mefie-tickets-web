import { redirect } from "next/navigation";
import { Alert } from "@mantine/core";
import { AuthLayout } from "@/components/AuthLayout";
import { AdminStepUp } from "@/components/AdminStepUp";
import { getAdminAuthState } from "@/lib/adminSession";
export default async function ReauthenticatePage({ searchParams }: { searchParams: Promise<{ returnTo?: string }> }) {
  const state = await getAdminAuthState(); const requested = (await searchParams).returnTo;
  const returnTo = requested?.startsWith("/admin/") && !requested.startsWith("//") ? requested : "/admin/dashboard";
  if (state.status === "unauthenticated") redirect(`/admin/login?returnTo=${encodeURIComponent(returnTo)}`);
  if (state.status === "unprivileged") redirect(`/admin/mfa?returnTo=${encodeURIComponent(returnTo)}`);
  if (state.status === "unverified") redirect("/verify-email");
  if (state.status === "unauthorized") return <AuthLayout title="Not authorized"><Alert color="red">You do not have access to this console.</Alert></AuthLayout>;
  if (state.status === "service_error") return <AuthLayout title="Unavailable"><Alert color="red">We could not verify your session.</Alert></AuthLayout>;
  return <AuthLayout title="Confirm it’s you" subtitle="Required before a sensitive admin action."><AdminStepUp returnTo={returnTo} /></AuthLayout>;
}
