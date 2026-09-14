import { ScannerSetupManager } from "@/components/ScannerSetupManager";
import { backendRequest } from "@/lib/backend";
import type { Event } from "@/lib/eventApi";
import type { GateConfiguration } from "@/lib/gateRoutingApi";
import type { ScannerSetup } from "@/lib/scannerSetupApi";

export default async function ScannerSetupPage({ params }: { params: Promise<{ eventId: string }> }) {
  const { eventId } = await params;
  const [eventResult, configuration, setups] = await Promise.all([
    backendRequest<{ event: Event }>(`/api/events/${eventId}`),
    backendRequest<GateConfiguration>(`/api/events/${eventId}/gates`),
    backendRequest<{ scanner_setups: ScannerSetup[] }>(`/api/events/${eventId}/scanner-setups`),
  ]);
  const gates = configuration.status === 200 ? configuration.data.gates : [];
  const structureChanges = configuration.status === 200
    ? configuration.data.structure_changes
    : { allowed: false, reason: null };
  const initialSetups = setups.status === 200 ? setups.data.scanner_setups : [];
  const eventStatus = eventResult.status === 200 ? eventResult.data.event.status : "DRAFT";
  return (
    <ScannerSetupManager
      eventId={Number(eventId)}
      eventStatus={eventStatus}
      gates={gates}
      structureChanges={structureChanges}
      initialSetups={initialSetups}
    />
  );
}
