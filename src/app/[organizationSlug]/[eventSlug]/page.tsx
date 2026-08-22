import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Alert, Avatar, Box, Breadcrumbs, Container, Group, Paper, Stack, Text, Title } from "@mantine/core";
import { IconCalendar, IconMapPin, IconWorld } from "@tabler/icons-react";
import { APP_URL, backendRequest } from "@/lib/backend";
import { formatEventDateRange } from "@/lib/eventDateTime";
import type { PublicEvent } from "@/lib/publicEventApi";
import { Checkout } from "@/components/Checkout";
import { TermsAndConditionsLink } from "@/components/TermsAndConditionsLink";
import { PublicSiteHeader } from "@/components/PublicSiteHeader";
import { PublicSiteFooter } from "@/components/PublicSiteFooter";
import { EventGallery } from "@/components/EventGallery";

async function getEvent(organizationSlug: string, eventSlug: string) {
  return backendRequest<{ event: PublicEvent }>(`/api/public/organizations/${encodeURIComponent(organizationSlug)}/events/${encodeURIComponent(eventSlug)}`);
}

export async function generateMetadata({ params }: { params: Promise<{ organizationSlug: string; eventSlug: string }> }): Promise<Metadata> {
  const { organizationSlug, eventSlug } = await params;
  const result = await getEvent(organizationSlug, eventSlug);
  if (result.status !== 200) return {};
  const { event } = result.data;
  const description = event.description.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim().slice(0, 200) || `Get tickets for ${event.title}.`;
  const canonical = `${APP_URL}/${event.organization.slug}/${event.slug}`;
  const image = event.cover_image_url ?? event.organization.cover_image_url;
  return {
    title: `${event.title} | Mefie Tickets`, description, alternates: { canonical },
    openGraph: { title: event.title, description, url: canonical, type: "website", ...(image ? { images: [image] } : {}) },
    twitter: { card: "summary_large_image", title: event.title, description, ...(image ? { images: [image] } : {}) },
  };
}

export default async function PublicEventPage({
  params,
}: {
  params: Promise<{ organizationSlug: string; eventSlug: string }>;
}) {
  const { organizationSlug, eventSlug } = await params;

  const result = await getEvent(organizationSlug, eventSlug);

  if (result.status !== 200) {
    notFound();
  }

  const { event } = result.data;
  const { location, organization } = event;

  const showVenue = location?.location_type === "IN_PERSON" || location?.location_type === "HYBRID";
  const showOnline = location?.location_type === "ONLINE" || location?.location_type === "HYBRID";
  const venueLabel =
    [location?.venue_name, location?.city, location?.state].filter(Boolean).join(", ") || "Location TBA";

  // Coordinates give the accurate pin; the text-query fallback covers
  // manual entry or a missing Mapbox token — either way "Get directions"
  // still works, just less precisely.
  const directionsUrl = showVenue
    ? location?.latitude != null && location?.longitude != null
      ? `https://www.google.com/maps/search/?api=1&query=${location.latitude},${location.longitude}`
      : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
          [location?.venue_name, location?.address_line1, location?.city, location?.state, location?.postal_code, location?.country]
            .filter(Boolean)
            .join(", "),
        )}`
    : null;

  return (
    <Box>
      <PublicSiteHeader />
      <Box
        h="clamp(190px, 30vw, 300px)"
        style={{
          backgroundColor: "var(--mantine-color-gray-light)",
          // Prefer the event's own cover image (the actual "event detail
          // hero") — the organization's cover is a reasonable fallback for
          // an event that hasn't uploaded media yet.
          backgroundImage: (event.cover_image_url ?? organization.cover_image_url)
            ? `url(${event.cover_image_url ?? organization.cover_image_url})`
            : undefined,
          backgroundSize: "cover",
          backgroundPosition: "center",
        }}
      />

      <Container size="md" py="xl">
        <Stack gap="xl">
          <Breadcrumbs separator="/">
            <Text component="a" href="/discover" size="sm" c="dimmed">
              Discover events
            </Text>
            <Text component="a" href={`/${organization.slug}`} size="sm" c="dimmed" lineClamp={1}>
              {organization.name}
            </Text>
            <Text size="sm" c="dimmed" lineClamp={1}>
              {event.title}
            </Text>
          </Breadcrumbs>

          <Group gap="md" align="flex-start">
            <Avatar src={organization.logo_url} size={56} radius="lg" color="brand" mt={-48}>
              {organization.name[0]}
            </Avatar>
            <Stack gap={4}>
              <Text component="a" href={`/${organization.slug}`} size="sm" c="dimmed" fw={500}>
                {organization.name}
              </Text>
              <Title order={1} fz={34}>
                {event.title}
              </Title>
            </Stack>
          </Group>

          <Group gap="lg">
            <Group gap={6}>
              <IconCalendar size={18} />
              {/* Always the event's own timezone, with its label — not the
                  viewer's and not the server's. */}
              <Text size="sm">{formatEventDateRange(event.start_date, event.end_date, event.timezone)}</Text>
            </Group>
            {showVenue && (
              <Group gap={6}>
                <IconMapPin size={18} />
                <Text size="sm">{venueLabel}</Text>
                {directionsUrl && (
                  <Text size="sm" component="a" href={directionsUrl} target="_blank" rel="noopener noreferrer">
                    Get directions
                  </Text>
                )}
              </Group>
            )}
            {showOnline && (
              <Group gap={6}>
                <IconWorld size={18} />
                <Text size="sm">Online event{location?.platform_name ? ` · ${location.platform_name}` : ""}</Text>
              </Group>
            )}
            {!showVenue && !showOnline && (
              <Group gap={6}>
                <IconMapPin size={18} />
                <Text size="sm">Location TBA</Text>
              </Group>
            )}
          </Group>

          {organization.description && (
            <Text c="dimmed" maw={640}>
              {organization.description}
            </Text>
          )}

          {event.description && <Box maw={700} dangerouslySetInnerHTML={{ __html: event.description }} />}

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
              <TermsAndConditionsLink eventId={event.id} terms={event.terms} />
            </Group>
          )}

          {/* `has_ended` is server-computed so it can't disagree with the
              server render, nor with the order endpoint's own guard. */}
          {event.has_ended ? (
            <Alert color="gray" variant="light" title="This event has ended">
              Tickets are no longer available for this event.
            </Alert>
          ) : (
            <Paper withBorder radius="lg" p="lg">
              <Checkout event={event} />
            </Paper>
          )}
        </Stack>
      </Container>
      <PublicSiteFooter />
    </Box>
  );
}
