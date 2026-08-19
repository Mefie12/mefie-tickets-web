import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/session";
import { DistributorShell } from "@/components/DistributorShell";

/**
 * Auth guard for the distributor portal, mirroring (organization)/layout.tsx's
 * pattern. Scoped via the (portal) route group so it does NOT wrap
 * /distributor/invitations/[token], which must stay reachable by
 * logged-out or brand-new visitors.
 */
export default async function DistributorLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/login?next=%2Fdistributor");
  }

  if (!user.email_verified_at) {
    redirect("/verify-email");
  }

  return <DistributorShell user={user}>{children}</DistributorShell>;
}
