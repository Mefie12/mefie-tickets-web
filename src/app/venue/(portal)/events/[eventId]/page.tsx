import { notFound } from "next/navigation";
import { VenueEventSummary } from "@/components/VenueEventSummary";

export default async function VenueEventPage({ params }: { params: Promise<{ eventId: string }> }) {
  const { eventId } = await params;
  if (!/^\d+$/.test(eventId)) notFound();

  return <VenueEventSummary eventId={Number(eventId)} />;
}
