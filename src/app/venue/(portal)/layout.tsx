import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { safeNext } from "@/lib/safeNext";
import { getCurrentUser } from "@/lib/session";
import { VenueShell } from "@/components/VenueShell";

/**
 * Auth guard for the venue-agent portal (docs/25), mirroring the distributor
 * portal. Scoped via the (portal) route group so it does NOT wrap
 * /venue/invitations/[token], which must stay reachable by logged-out or
 * brand-new visitors.
 */
export default async function VenueLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();

  if (!user) {
    redirect(`/organizers/login?next=${encodeURIComponent(safeNext((await headers()).get("x-mefie-return-path"), "organizer", "/venue"))}`);
  }

  if (!user.email_verified_at) {
    redirect("/verify-email");
  }

  // Someone with no venue access but another portal goes there instead of seeing an empty page.
  // A person whose access was just revoked and who has nothing else stays here and sees the empty state.
  if (!user.portal_access.venue) {
    if (user.portal_access.distributor) redirect("/distributor");
    if (user.current_organization_id !== null) redirect("/dashboard");
  }

  return <VenueShell user={user}>{children}</VenueShell>;
}
