import { GateOperationsDashboard } from "@/components/GateOperationsDashboard";
import { backendRequest } from "@/lib/backend";
import type { EventGate, GateConfiguration } from "@/lib/gateRoutingApi";

export default async function GateOperationsPage({ params }: { params: Promise<{ eventId: string }> }) {
  const { eventId } = await params;
  const configuration = await backendRequest<GateConfiguration>(`/api/events/${eventId}/gates`);
  const gates: EventGate[] = configuration.status === 200 ? configuration.data.gates : [];
  return <GateOperationsDashboard eventId={Number(eventId)} gates={gates} />;
}
