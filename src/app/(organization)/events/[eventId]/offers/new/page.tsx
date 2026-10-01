import { notFound } from "next/navigation";
import { Stack, Text, Title } from "@mantine/core";
import { backendRequest } from "@/lib/backend";
import { getCurrentOrganization, getEventById } from "@/lib/session";
import type { Offer } from "@/lib/offersApi";
import type { Product } from "@/lib/productApi";
import { offerInventory } from "@/lib/offerInventory";
import { OfferForm } from "@/components/OfferForm";

export default async function NewOfferPage({ params, searchParams }: {
  params: Promise<{ eventId: string }>;
  searchParams: Promise<{ template?: string }>;
}) {
  const { eventId } = await params;
  const { template } = await searchParams;
  const [event, organization, products, offers] = await Promise.all([
    getEventById(eventId),
    getCurrentOrganization(),
    backendRequest<{ products: Product[] }>(`/api/events/${eventId}/products`),
    backendRequest<{ offers: Offer[] }>(`/api/events/${eventId}/offers`),
  ]);
  if (!event || !organization) notFound();
  if (!products.ok || !offers.ok) throw new Error("Unable to load this event’s tickets.");

  return (
    <Stack gap="lg">
      <Stack gap={2}>
        <Title order={2} fz={24}>Create offer</Title>
        <Text size="sm" c="dimmed">Set up a discount, preview how buyers will see it, then activate it when you’re ready.</Text>
      </Stack>
      <OfferForm
        eventId={event.id}
        currency={event.currency_code}
        timezone={event.timezone}
        eventStart={event.start_date}
        inventory={offerInventory(products.data.products)}
        otherOffers={offers.data.offers}
        template={template === "fixed" || template === "automatic" || template === "percent" ? template : undefined}
        publicEventPath={`/${organization.slug}/${event.slug}`}
      />
    </Stack>
  );
}
