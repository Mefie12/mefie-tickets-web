import { notFound } from "next/navigation";
import { getCurrentOrganization, getEventById } from "@/lib/session";
import { EventOperationsNavShell } from "@/components/EventOperationsNavShell";

export default async function EventOperationsLayout({ children, params }: { children: React.ReactNode; params: Promise<{ eventId: string }> }) {
  const { eventId } = await params;
  const [event, organization] = await Promise.all([getEventById(eventId), getCurrentOrganization()]);
  if (!event || !organization) notFound();

  return (
    <EventOperationsNavShell eventId={event.id} title={event.title} status={event.status}>
      {children}
    </EventOperationsNavShell>
  );
}
