import { redirect } from "next/navigation";

export default async function AttendeesPage({ params }: { params: Promise<{ eventId: string }> }) {
  const { eventId } = await params;
  redirect(`/events/${eventId}/orders?view=attendees`);
}
