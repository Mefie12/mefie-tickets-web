import { notFound } from "next/navigation";
import { backendRequest } from "@/lib/backend";
import { getCurrentOrganization, getEventById } from "@/lib/session";
import type { Offer, OfferReport } from "@/lib/offersApi";
import type { Product } from "@/lib/productApi";
import { offerInventory } from "@/lib/offerInventory";
import { OfferDetail } from "@/components/OfferDetail";

export default async function OfferDetailPage({ params }: { params: Promise<{ eventId: string; offerId: string }> }) {
  const { eventId, offerId } = await params;
  const [event, organization, detail, offers, products] = await Promise.all([
    getEventById(eventId),
    getCurrentOrganization(),
    backendRequest<{ offer: Offer; report: OfferReport }>(`/api/events/${eventId}/offers/${offerId}`),
    backendRequest<{ offers: Offer[] }>(`/api/events/${eventId}/offers`),
    backendRequest<{ products: Product[] }>(`/api/events/${eventId}/products`),
  ]);
  if (!event || !organization || detail.status === 404) notFound();
  if (!detail.ok || !offers.ok || !products.ok) throw new Error("Unable to load this offer.");

  return (
    <OfferDetail
      eventId={event.id}
      currency={event.currency_code}
      timezone={event.timezone}
      eventStart={event.start_date}
      publicEventPath={`/${organization.slug}/${event.slug}`}
      inventory={offerInventory(products.data.products)}
      otherOffers={offers.data.offers}
      initialOffer={detail.data.offer}
      initialReport={detail.data.report}
    />
  );
}
