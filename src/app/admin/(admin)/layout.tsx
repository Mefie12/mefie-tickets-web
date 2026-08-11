import { redirect } from "next/navigation";
import { Alert, Container } from "@mantine/core";
import { getAdminAuthState } from "@/lib/adminSession";
import { PlatformAdminShell } from "@/components/PlatformAdminShell";

/**
 * The privileged console guard, applied to everything under /admin/*
 * except the (admin-auth) login/mfa pages. No Sanctum session -> back to
 * /admin/login. Sanctum session but no Platform membership -> an
 * "unauthorized" page, not the ordinary /login (this may be a
 * legitimate customer-org user with no platform access at all).
 * Membership but no live privileged session -> /admin/mfa.
 */
export default async function PlatformAdminLayout({ children }: { children: React.ReactNode }) {
  const state = await getAdminAuthState();

  if (state.status === "unauthenticated") {
    redirect("/admin/login");
  }
  if (state.status === "unverified") {
    redirect("/verify-email");
  }
  if (state.status === "unprivileged") {
    redirect("/admin/mfa");
  }

  if (state.status === "unauthorized") {
    return (
      <Container size="xs" py={80}>
        <Alert color="red" title="Not authorized">
          {state.user.email} doesn&apos;t have access to the Mefie Admin Console.
        </Alert>
      </Container>
    );
  }

  return (
    <PlatformAdminShell user={state.user} role={state.role} permissions={state.permissions}>
      {children}
    </PlatformAdminShell>
  );
}
