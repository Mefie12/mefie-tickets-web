import { notFound } from "next/navigation";
import { Alert, Box, Container, Stack, Text, Title } from "@mantine/core";
import { IconArrowLeft } from "@tabler/icons-react";
import { getPublicEvent, getPublicSeries } from "@/lib/publicEventFetchers";
import { CheckoutPage } from "@/components/CheckoutPage";
import { PublicSiteHeader } from "@/components/PublicSiteHeader";
import { PublicSiteFooter } from "@/components/PublicSiteFooter";

/**
 * Standalone event checkout (and a series' default occurrence, same
 * event/series-lookup fallback the event page itself uses) — see
 * [publicOccurrenceId]/checkout/page.tsx for a specific series date.
 */
export default async function CheckoutRoutePage({
  params,
}: {
  params: Promise<{ organizationSlug: string; eventSlug: string }>;
}) {
  const { organizationSlug, eventSlug } = await params;

  const result = await getPublicEvent(organizationSlug, eventSlug);

  let event;
  let backUrl;
  if (result.status === 200) {
    event = result.data.event;
    backUrl = `/${organizationSlug}/${eventSlug}`;
  } else {
    const seriesResult = await getPublicSeries(organizationSlug, eventSlug);
    if (seriesResult.status !== 200) notFound();
    event = seriesResult.data.event_series.selected_occurrence;
    backUrl = `/${organizationSlug}/${eventSlug}`;
  }

  return (
    <Box>
      <PublicSiteHeader />
      <Container size="xl" py="xl">
        <Stack gap="lg">
          <Text component="a" href={backUrl} size="sm" fw={500} style={{ display: "inline-flex", alignItems: "center", gap: 6, width: "fit-content" }}>
            <IconArrowLeft size={16} /> Back to event details
          </Text>
          <Stack gap={4}>
            <Title order={1} fz={{ base: 24, sm: 30 }}>
              Complete your booking
            </Title>
            <Text c="dimmed">You&apos;re almost there — fill in your details and pay to confirm your tickets.</Text>
          </Stack>

          {event.has_ended ? (
            <Alert color="gray" variant="light" title="This event has ended">
              Tickets are no longer available for this event.
            </Alert>
          ) : (
            <CheckoutPage event={event} backUrl={backUrl} />
          )}
        </Stack>
      </Container>
      <PublicSiteFooter />
    </Box>
  );
}
