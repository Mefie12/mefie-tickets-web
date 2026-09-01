import { GateOperationsDashboard } from "@/components/GateOperationsDashboard";

export default async function GateOperationsPage({ params }: { params: Promise<{ eventId: string }> }) {
  const { eventId } = await params;
  return <GateOperationsDashboard eventId={Number(eventId)} />;
}
