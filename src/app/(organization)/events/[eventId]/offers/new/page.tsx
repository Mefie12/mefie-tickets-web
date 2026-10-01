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
  searchParams: Promise<{ template?: string; from?: string }>;
}) {
  const { eventId } = await params;
  const { template, from } = await searchParams;
  const [event, organization, products, offers] = await Promise.all([
    getEventById(eventId),
    getCurrentOrganization(),
    backendRequest<{ products: Product[] }>(`/api/events/${eventId}/products`),
    backendRequest<{ offers: Offer[] }>(`/api/events/${eventId}/offers`),
  ]);
  // ?from=<offer id> duplicates one of THIS event's offers (looked up in the event's own list, so
  // an id from elsewhere is simply ignored).
  const source = from && offers.ok ? offers.data.offers.find((o) => String(o.id) === from) : undefined;
  if (!event || !organization) notFound();
  if (!products.ok || !offers.ok) throw new Error("Unable to load this event’s tickets.");

  return (
    <Stack gap="lg">
      <Stack gap={2}>
        <Title order={2} fz={24}>{source ? "Duplicate offer" : "Create offer"}</Title>
        <Text size="sm" c="dimmed">Set up a discount, preview how buyers will see it, then activate it when you’re ready.</Text>
      </Stack>
      <OfferForm
        eventId={event.id}
        currency={event.currency_code}
        timezone={event.timezone}
        eventStart={event.start_date}
        inventory={offerInventory(products.data.products)}
        otherOffers={offers.data.offers}
        prefill={source}
        template={template === "fixed" || template === "automatic" || template === "percent" ? template : undefined}
        publicEventPath={`/${organization.slug}/${event.slug}`}
      />
    </Stack>
  );
}
