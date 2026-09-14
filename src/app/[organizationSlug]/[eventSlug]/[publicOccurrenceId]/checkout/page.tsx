import { notFound } from "next/navigation";
import { Alert, Box, Container, Stack, Text, Title } from "@mantine/core";
import { IconArrowLeft } from "@tabler/icons-react";
import { getPublicSeriesOccurrence } from "@/lib/publicEventFetchers";
import { CheckoutPage } from "@/components/CheckoutPage";
import { PublicSiteHeader } from "@/components/PublicSiteHeader";
import { PublicSiteFooter } from "@/components/PublicSiteFooter";

/** Checkout for a specific, bookmarkable series occurrence — mirrors ../checkout/page.tsx. */
export default async function OccurrenceCheckoutRoutePage({
  params,
}: {
  params: Promise<{ organizationSlug: string; eventSlug: string; publicOccurrenceId: string }>;
}) {
  const { organizationSlug, eventSlug, publicOccurrenceId } = await params;

  const result = await getPublicSeriesOccurrence(organizationSlug, eventSlug, publicOccurrenceId);
  if (result.status !== 200) notFound();

  const event = result.data.event_series.selected_occurrence;
  const backUrl = `/${organizationSlug}/${eventSlug}/${publicOccurrenceId}`;

  return (
    <Box>
      <PublicSiteHeader />
      <Container size="xl" py="xl">
        {event.has_ended ? (
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
            <Alert color="gray" variant="light" title="This date has ended">
              Tickets are no longer available for this date.
            </Alert>
          </Stack>
        ) : (
          <CheckoutPage event={event} backUrl={backUrl} />
        )}
      </Container>
      <PublicSiteFooter />
    </Box>
  );
}
