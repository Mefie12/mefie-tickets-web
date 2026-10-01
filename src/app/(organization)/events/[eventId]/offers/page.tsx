import { notFound } from "next/navigation";
import { backendRequest } from "@/lib/backend";
import { getEventById } from "@/lib/session";
import type { Offer } from "@/lib/offersApi";
import { OffersList } from "@/components/OffersList";

export default async function OffersPage({ params }: { params: Promise<{ eventId: string }> }) {
  const { eventId } = await params;
  const [event, offers] = await Promise.all([
    getEventById(eventId),
    backendRequest<{ offers: Offer[] }>(`/api/events/${eventId}/offers`),
  ]);
  if (!event || offers.status === 404) notFound();
  if (!offers.ok) throw new Error("Unable to load offers.");

  return <OffersList eventId={event.id} timezone={event.timezone} initialOffers={offers.data.offers} />;
}
