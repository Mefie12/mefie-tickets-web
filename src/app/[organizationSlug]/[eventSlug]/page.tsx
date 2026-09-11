import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Alert, Avatar, Badge, Box, Container, Grid, GridCol, Group, Paper, Stack, Text, Title } from "@mantine/core";
import { IconCalendar, IconMapPin, IconWorld } from "@tabler/icons-react";
import { APP_URL } from "@/lib/backend";
import { formatEventDateRange } from "@/lib/eventDateTime";
import { cheapestPriceLabel, TICKET_DELIVERY_NOTE } from "@/lib/publicEventApi";
import { getPublicEvent, getPublicSeries } from "@/lib/publicEventFetchers";
import { staticMapImageUrl } from "@/lib/mapbox";
import { EventTicketPanel } from "@/components/EventTicketPanel";
import { TermsAndConditionsLink } from "@/components/TermsAndConditionsLink";
import { PublicSiteHeader } from "@/components/PublicSiteHeader";
import { PublicSiteFooter } from "@/components/PublicSiteFooter";
import { EventHeroGallery } from "@/components/EventHeroGallery";
import { EventGallery } from "@/components/EventGallery";
import { EventTopActions } from "@/components/EventTopActions";
import { EventVenueCard } from "@/components/EventVenueCard";
import { ExpandableHtml } from "@/components/ExpandableHtml";
import { PublicContentSections } from "@/components/PublicContentSections";
import { PublicEventSeriesView } from "@/components/PublicEventSeriesView";
import { MobileBuyBar } from "@/components/MobileBuyBar";

export async function generateMetadata({ params }: { params: Promise<{ organizationSlug: string; eventSlug: string }> }): Promise<Metadata> {
  const { organizationSlug, eventSlug } = await params;

  // A 1200×630 crop dedicated to link previews; fall back to the sized
  // hero, then the organiser's cover. Explicit dimensions let Next emit
  // og:image:width/height so crawlers don't have to fetch-and-measure.
  const ogImages = (socialUrl: string | null, heroUrl: string | null, orgUrl: string | null, alt: string) => {
    const url = socialUrl ?? heroUrl ?? orgUrl;
    return url ? { images: [{ url, width: 1200, height: 630, alt }] } : {};
  };

  const eventResult = await getPublicEvent(organizationSlug, eventSlug);
  if (eventResult.status === 200) {
    const { event } = eventResult.data;
    const description = event.description.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim().slice(0, 200) || `Get tickets for ${event.title}.`;
    const canonical = `${APP_URL}/${event.organization.slug}/${event.slug}`;
    const images = ogImages(event.cover_social_url, event.cover_image_url, event.organization.cover_image_url, event.title);
    return {
      title: `${event.title} | Mefie Tickets`, description, alternates: { canonical },
      openGraph: { title: event.title, description, url: canonical, type: "website", ...images },
      twitter: { card: "summary_large_image", title: event.title, description, ...images },
    };
  }

  const seriesResult = await getPublicSeries(organizationSlug, eventSlug);
  if (seriesResult.status !== 200) return {};
  const { event_series: series } = seriesResult.data;
  const description = series.description.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim().slice(0, 200) || `Get tickets for ${series.title}.`;
  const canonical = `${APP_URL}/${series.organization.slug}/${series.slug}`;
  const images = ogImages(series.cover_social_url, series.cover_image_url, series.organization.cover_image_url, series.title);
  return {
    title: `${series.title} | Mefie Tickets`, description, alternates: { canonical },
    openGraph: { title: series.title, description, url: canonical, type: "website", ...images },
    twitter: { card: "summary_large_image", title: series.title, description, ...images },
  };
}

export default async function PublicEventPage({
  params,
}: {
  params: Promise<{ organizationSlug: string; eventSlug: string }>;
}) {
  const { organizationSlug, eventSlug } = await params;

  const result = await getPublicEvent(organizationSlug, eventSlug);

  if (result.status !== 200) {
    const seriesResult = await getPublicSeries(organizationSlug, eventSlug);
    if (seriesResult.status !== 200) {
      notFound();
    }
    return (
      <Box>
        <PublicSiteHeader />
        <PublicEventSeriesView series={seriesResult.data.event_series} />
        <PublicSiteFooter />
      </Box>
    );
  }

  const { event } = result.data;
  const { location, organization } = event;

  const showVenue = location?.location_type === "IN_PERSON" || location?.location_type === "HYBRID";
  const showOnline = location?.location_type === "ONLINE" || location?.location_type === "HYBRID";
  const venueLabel =
    [location?.venue_name, location?.city, location?.state].filter(Boolean).join(", ") || "Location TBA";

  // Coordinates give the accurate pin; the text-query fallback covers
  // manual entry or a missing Mapbox token — either way "Preview
  // directions" still works, just less precisely.
  const locationQuery = () =>
    location?.latitude != null && location?.longitude != null
      ? `${location.latitude},${location.longitude}`
      : encodeURIComponent(
          [location?.venue_name, location?.address_line1, location?.city, location?.state, location?.postal_code, location?.country]
            .filter(Boolean)
            .join(", "),
        );
  const directionsUrl = showVenue ? `https://www.google.com/maps/search/?api=1&query=${locationQuery()}` : null;
  // A `/maps/dir/` deep link, not `/maps/search/` — this button is a
  // committed "take me there" action on the Venue card, so it should
  // open real turn-by-turn navigation rather than just drop a pin.
  const navigationUrl = showVenue ? `https://www.google.com/maps/dir/?api=1&destination=${locationQuery()}` : null;

  const canonicalUrl = `${APP_URL}/${organization.slug}/${event.slug}`;
  const addressLine = [location?.address_line1, location?.city].filter(Boolean).join(", ") || null;
  const checkoutUrl = `/${organization.slug}/${event.slug}/checkout`;

  return (
    <Box>
      <PublicSiteHeader />

      <Container size="xl" pt="md">
        <EventTopActions
          shareUrl={canonicalUrl}
          shareTitle={event.title}
          shareText={`Check out ${event.title} on Mefie Tickets`}
        />
      </Container>

      <Container size="xl" pt="md">
        <EventHeroGallery
          coverImageUrl={event.cover_image_url ?? organization.cover_image_url}
          coverPlaceholderUrl={event.cover_placeholder_url}
          gallery={event.gallery}
        />
      </Container>

      <Container size="xl" py="xl" pb={{ base: 90, md: "xl" }}>
        <Grid gutter="xl">
          <GridCol span={{ base: 12, md: 7, lg: 8 }}>
            <Stack gap="xl">
              <Stack gap={10}>
                {event.category && (
                  <Badge
                    radius="xl"
                    tt="none"
                    w="fit-content"
                    styles={{ root: { backgroundColor: "#d8ff72", color: "#171717" } }}
                  >
                    {event.category.name}
                  </Badge>
                )}
                <Title order={1} fz={{ base: 26, sm: 34 }} style={{ overflowWrap: "anywhere" }}>
                  {event.title}
                </Title>
                <Group gap={10} align="center" wrap="nowrap">
                  <Avatar src={organization.logo_url} size={32} radius="lg" color="brand" style={{ flexShrink: 0 }}>
                    {organization.name[0]}
                  </Avatar>
                  <Text component="a" href={`/${organization.slug}`} size="sm" c="dimmed" fw={500}>
                    Hosted by {organization.name}
                  </Text>
                </Group>
              </Stack>

              <Stack gap={6}>
                {/* Always the event's own timezone, with its label — not the
                    viewer's and not the server's. */}
                <Group gap={8}>
                  <IconCalendar size={20} />
                  <Text size="lg" fw={700}>
                    {formatEventDateRange(event.start_date, event.end_date, event.timezone)}
                  </Text>
                </Group>
                <Group gap="lg">
                  {showVenue && (
                    <Group gap={6}>
                      <IconMapPin size={16} />
                      <Text size="sm" c="dimmed">{venueLabel}</Text>
                      {directionsUrl && (
                        <Text size="sm" component="a" href={directionsUrl} target="_blank" rel="noopener noreferrer">
                          Preview directions
                        </Text>
                      )}
                    </Group>
                  )}
                  {showOnline && (
                    <Group gap={6}>
                      <IconWorld size={16} />
                      <Text size="sm" c="dimmed">Online event{location?.platform_name ? ` · ${location.platform_name}` : ""}</Text>
                    </Group>
                  )}
                  {!showVenue && !showOnline && (
                    <Group gap={6}>
                      <IconMapPin size={16} />
                      <Text size="sm" c="dimmed">Location TBA</Text>
                    </Group>
                  )}
                </Group>
              </Stack>

              {organization.description && (
                <Text c="dimmed" maw={640}>
                  {organization.description}
                </Text>
              )}

              {event.description && <ExpandableHtml html={event.description} maw={700} />}

              <Text c="dimmed" maw={700}>
                {TICKET_DELIVERY_NOTE}
              </Text>

              {event.content_sections.length > 0 && <PublicContentSections sections={event.content_sections} />}

              {/* Purely a visual preview — the "Preview directions" link above
                  is the actual navigation action and is unrelated to this. */}
              {showVenue && (
                <EventVenueCard
                  venueName={venueLabel}
                  addressLine={addressLine}
                  mapImageUrl={
                    location?.latitude != null && location?.longitude != null
                      ? staticMapImageUrl(location.latitude, location.longitude)
                      : null
                  }
                  navigationUrl={navigationUrl}
                />
              )}

              {event.gallery.length > 0 && <EventGallery gallery={event.gallery} />}

              {/* Always visible, never gated behind purchase: the event can be
                  months out and there's no ticket-email system yet to deliver
                  this another way, so hiding it here would just make it
                  unreachable. */}
              {showOnline && (
                <Paper withBorder radius="lg" p="lg" maw={700}>
                  <Stack gap={4}>
                    <Text fw={600}>How to join</Text>
                    {location?.platform_name && <Text size="sm">{location.platform_name}</Text>}
                    {location?.online_url && (
                      <Text size="sm" component="a" href={location.online_url} target="_blank" rel="noopener noreferrer">
                        {location.online_url}
                      </Text>
                    )}
                    {location?.access_instructions && (
                      <Text size="sm" c="dimmed">
                        {location.access_instructions}
                      </Text>
                    )}
                  </Stack>
                </Paper>
              )}

              {event.terms && (
                <Group gap={6}>
                  <Text size="sm" fw={600}>
                    Terms &amp; Conditions
                  </Text>
                  <TermsAndConditionsLink document={event.terms} pdfUrl={`/api/public/events/${event.id}/terms/pdf`} />
                </Group>
              )}
            </Stack>
          </GridCol>

          <GridCol span={{ base: 12, md: 5, lg: 4 }}>
            <Box id="checkout-section" pos={{ base: "static", md: "sticky" }} top={84}>
              {/* `has_ended` is server-computed so it can't disagree with the
                  server render, nor with the order endpoint's own guard. */}
              {event.has_ended ? (
                <Alert color="gray" variant="light" title="This event has ended">
                  Tickets are no longer available for this event.
                </Alert>
              ) : (
                <Paper withBorder radius="lg" p={{ base: "md", sm: "lg" }}>
                  <EventTicketPanel event={event} checkoutUrl={checkoutUrl} />
                </Paper>
              )}
            </Box>
          </GridCol>
        </Grid>
      </Container>
      <MobileBuyBar targetId="checkout-section" priceLabel={cheapestPriceLabel(event)} disabled={event.has_ended} />
      <PublicSiteFooter />
    </Box>
  );
}
