import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/session";
import { AdminShell } from "@/components/AdminShell";

/**
 * Auth guard for the whole organizer admin portal (Milestone 3a) — the
 * session cookie is checked server-side, so an unauthenticated visitor
 * never sees the shell flash before redirecting. Also gates on
 * verification status: the backend rejects every route here except a
 * handful of exempt ones (see EnsureEmailIsVerified) for an unverified
 * session, so an unverified user is redirected to /verify-email before
 * ever seeing (and immediately 403ing on) the admin shell.
 */
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/login");
  }

  if (!user.email_verified_at) {
    redirect("/verify-email");
  }

  return <AdminShell user={user}>{children}</AdminShell>;
}
