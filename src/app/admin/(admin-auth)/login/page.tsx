import { redirect } from "next/navigation";
import { Alert } from "@mantine/core";
import { getAdminAuthState } from "@/lib/adminSession";
import { AuthLayout } from "@/components/AuthLayout";
import { AdminLoginForm } from "@/components/AdminLoginForm";

/**
 * /admin/login — the Mefie Admin Console's own entry point. Guard logic
 * lives on the page itself rather than a shared (admin-auth) layout,
 * since this page and /admin/mfa need opposite behavior for "no Sanctum
 * session at all" (this one renders the form; that one redirects here) —
 * a single shared layout guard can't express that without page-specific
 * overrides anyway.
 */
export default async function AdminLoginPage() {
  const state = await getAdminAuthState();

  if (state.status === "unverified") {
    redirect("/verify-email");
  }
  if (state.status === "unprivileged") {
    redirect("/admin/mfa");
  }
  if (state.status === "privileged") {
    redirect("/admin/dashboard");
  }

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
    <AuthLayout title="Mefie Admin Console" subtitle="Sign in with your staff account to continue.">
      <AdminLoginForm />
    </AuthLayout>
  );
}
