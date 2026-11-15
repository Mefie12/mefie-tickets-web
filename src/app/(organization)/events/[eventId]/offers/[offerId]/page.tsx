import { notFound } from "next/navigation";
import { backendRequest } from "@/lib/backend";
import { getCurrentOrganization, getEventById } from "@/lib/session";
import type { Offer, OfferReport, OfferWarning } from "@/lib/offersApi";
import type { Bundle, Product } from "@/lib/productApi";
import { offerInventory } from "@/lib/offerInventory";
import { OfferDetail } from "@/components/OfferDetail";

export default async function OfferDetailPage({ params }: { params: Promise<{ eventId: string; offerId: string }> }) {
  const { eventId, offerId } = await params;
  const [event, organization, detail, offers, products, bundlesResult] = await Promise.all([
    getEventById(eventId),
    getCurrentOrganization(),
    backendRequest<{ offer: Offer; report: OfferReport; warnings?: OfferWarning[] }>(`/api/events/${eventId}/offers/${offerId}`),
    backendRequest<{ offers: Offer[] }>(`/api/events/${eventId}/offers`),
    backendRequest<{ products: Product[] }>(`/api/events/${eventId}/products`),
    // 404 while bundles are off — then simply no bundles to target.
    backendRequest<{ bundles: Bundle[] }>(`/api/events/${eventId}/bundles`),
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
      eventStatus={event.status}
      inventory={offerInventory(products.data.products, event.currency_code, bundlesResult.ok ? bundlesResult.data.bundles : [])}
      otherOffers={offers.data.offers}
      initialOffer={detail.data.offer}
      initialReport={detail.data.report}
      initialWarnings={detail.data.warnings ?? []}
    />
  );
}
