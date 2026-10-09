import { notFound } from "next/navigation";
import { getEventById } from "@/lib/session";
import { utcIsoToZonedParts, joinLocalDateTime } from "@/lib/eventDateTime";
import { VenueAccessManager } from "@/components/VenueAccessManager";

export default async function VenueAccessPage({ params }: { params: Promise<{ eventId: string }> }) {
  const { eventId } = await params;
  const event = await getEventById(eventId);
  if (!event) notFound();

  const startAt = event.start_date ? joinLocalDateTime(utcIsoToZonedParts(event.start_date, event.timezone)) : "";

  return <VenueAccessManager eventId={event.id} initialDoorsMinutes={event.doors_open_minutes_before_start ?? null} startAt={startAt} archived={event.status === "ARCHIVED"} />;
}
