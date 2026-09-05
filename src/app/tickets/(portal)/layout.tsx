import { headers } from "next/headers";
import { safeNext } from "@/lib/safeNext";
import { redirect } from "next/navigation";
import { getConsumerSession } from "@/lib/consumerSession";
import { ConsumerPortalShell } from "@/components/ConsumerPortalShell";

/**
 * Auth guard for the ticket portal. Scoped to the (portal) route group
 * so it never wraps /tickets/verify (which must be reachable with no
 * session). Mirrors src/app/distributor/(portal)/layout.tsx, but against
 * the isolated `mefie_consumer_session` — not the Sanctum principal.
 */
export default async function PortalLayout({ children }: { children: React.ReactNode }) {
  const session = await getConsumerSession();

  if (!session) {
    redirect(`/login?next=${encodeURIComponent(safeNext((await headers()).get("x-mefie-return-path"), "consumer", "/tickets"))}`);
  }

  return <ConsumerPortalShell profile={session.profile}>{children}</ConsumerPortalShell>;
}
