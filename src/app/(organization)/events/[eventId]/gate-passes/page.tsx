import { GatePassManager } from "@/components/GatePassManager";

export default async function GatePassesPage({ params }: { params: Promise<{ eventId: string }> }) {
  const { eventId } = await params;
  return <GatePassManager eventId={Number(eventId)} />;
}
