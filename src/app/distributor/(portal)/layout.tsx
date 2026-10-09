import { headers } from "next/headers";
import { safeNext } from "@/lib/safeNext";
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
    redirect(`/organizers/login?next=${encodeURIComponent(safeNext((await headers()).get("x-mefie-return-path"), "organizer", "/distributor"))}`);
  }

  if (!user.email_verified_at) {
    redirect("/verify-email");
  }

  // The shared login redirect sends every account without an organization here. If this one isn't a
  // distributor (a venue agent, including one whose access was just removed), send them to their own portal.
  if (!user.portal_access.distributor && user.current_organization_id === null) {
    redirect("/venue");
  }

  return <DistributorShell user={user}>{children}</DistributorShell>;
}
