import { notFound } from "next/navigation";
import { backendRequest } from "@/lib/backend";
import { getCurrentOrganization, getEventById } from "@/lib/session";
import type { Offer } from "@/lib/offersApi";
import type { Bundle, Product } from "@/lib/productApi";
import { offerInventory } from "@/lib/offerInventory";
import { OffersList } from "@/components/OffersList";

export default async function OffersPage({ params }: { params: Promise<{ eventId: string }> }) {
  const { eventId } = await params;
  const [event, organization, offers, products, bundlesResult] = await Promise.all([
    getEventById(eventId),
    getCurrentOrganization(),
    backendRequest<{ offers: Offer[] }>(`/api/events/${eventId}/offers`),
    backendRequest<{ products: Product[] }>(`/api/events/${eventId}/products`),
    // 404 while bundles are off — then simply no bundles to target.
    backendRequest<{ bundles: Bundle[] }>(`/api/events/${eventId}/bundles`),
  ]);
  if (!event || !organization || offers.status === 404) notFound();
  if (!offers.ok || !products.ok) throw new Error("Unable to load offers.");

  return (
    <OffersList
      eventId={event.id}
      timezone={event.timezone}
      initialOffers={offers.data.offers}
      inventory={offerInventory(products.data.products, event.currency_code, bundlesResult.ok ? bundlesResult.data.bundles : [])}
      publicEventPath={`/${organization.slug}/${event.slug}`}
    />
  );
}
