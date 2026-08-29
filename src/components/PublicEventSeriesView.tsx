import { Alert, Avatar, Badge, Box, Breadcrumbs, Container, Grid, GridCol, Group, Paper, Stack, Text, Title } from "@mantine/core";
import { IconCalendar, IconMapPin, IconWorld } from "@tabler/icons-react";
import { formatEventDate, formatEventDateRange, formatEventTime } from "@/lib/eventDateTime";
import { cheapestPriceLabel } from "@/lib/publicEventApi";
import type { PublicEventSeries } from "@/lib/publicEventSeriesApi";
import { staticMapImageUrl } from "@/lib/mapbox";
import { Checkout } from "@/components/Checkout";
import { TermsAndConditionsLink } from "@/components/TermsAndConditionsLink";
import { EventGallery } from "@/components/EventGallery";
import { ExpandableHtml } from "@/components/ExpandableHtml";
import { PublicContentSections } from "@/components/PublicContentSections";
import { MobileBuyBar } from "@/components/MobileBuyBar";

/**
 * §7.2/§7.3 — the public series page, rendered for both
 * `/{organizationSlug}/{seriesSlug}` (defaulting to the next available
 * occurrence) and `/{organizationSlug}/{seriesSlug}/{publicOccurrenceId}`
 * (a specific, independently bookmarkable date). Deliberately mirrors
 * the standalone public event page's structure (`[eventSlug]/page.tsx`)
 * field-for-field where the content is series-owned (§4.1) — the only
 * series-specific addition is the date switcher below the schedule line
 * and the availability badges it carries.
 */
export function PublicEventSeriesView({ series }: { series: PublicEventSeries }) {
  const { location, organization, selected_occurrence: occurrence } = series;

  const showVenue = location?.location_type === "IN_PERSON" || location?.location_type === "HYBRID";
  const showOnline = location?.location_type === "ONLINE" || location?.location_type === "HYBRID";
  const venueLabel =
    [location?.venue_name, location?.city, location?.state].filter(Boolean).join(", ") || "Location TBA";

  const directionsUrl = showVenue
    ? location?.latitude != null && location?.longitude != null
      ? `https://www.google.com/maps/search/?api=1&query=${location.latitude},${location.longitude}`
      : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
          [location?.venue_name, location?.address_line1, location?.city, location?.state, location?.postal_code, location?.country]
            .filter(Boolean)
            .join(", "),
        )}`
    : null;

  const upcoming = series.occurrences.filter((o) => !o.is_past);
  const badgeFor = (availability: PublicEventSeries["occurrences"][number]["availability"]) =>
    availability === "cancelled" ? (
      <Badge color="gray" variant="light" size="sm">
        Cancelled
      </Badge>
    ) : availability === "sold_out" ? (
      <Badge color="orange" variant="light" size="sm">
        Sold out
      </Badge>
    ) : null;

  return (
    <Box>
      <Box
        h="clamp(190px, 30vw, 300px)"
        style={{
          backgroundColor: "var(--mantine-color-gray-light)",
          backgroundImage: (series.cover_image_url ?? organization.cover_image_url)
            ? `url(${series.cover_image_url ?? organization.cover_image_url})`
            : undefined,
          backgroundSize: "cover",
          backgroundPosition: "center",
        }}
      />

      <Container size="xl" py="xl" pb={{ base: 90, md: "xl" }}>
        <Grid gutter="xl">
          <GridCol span={{ base: 12, md: 7, lg: 8 }}>
            <Stack gap="xl">
              <Breadcrumbs separator="/">
                <Text component="a" href="/discover" size="sm" c="dimmed">
                  Discover events
                </Text>
                <Text component="a" href={`/${organization.slug}`} size="sm" c="dimmed" lineClamp={1}>
                  {organization.name}
                </Text>
                <Text size="sm" c="dimmed" lineClamp={1}>
                  {series.title}
                </Text>
              </Breadcrumbs>

              <Group gap="md" align="flex-start" wrap="nowrap">
                <Avatar src={organization.logo_url} size={56} radius="lg" color="brand" style={{ flexShrink: 0 }}>
                  {organization.name[0]}
                </Avatar>
                <Stack gap={4}>
                  <Text component="a" href={`/${organization.slug}`} size="sm" c="dimmed" fw={500}>
                    {organization.name}
                  </Text>
                  <Title order={1} fz={{ base: 26, sm: 34 }} style={{ overflowWrap: "anywhere" }}>
                    {series.title}
                  </Title>
                </Stack>
              </Group>

              <Stack gap={6}>
                <Group gap={8}>
                  <IconCalendar size={20} />
                  <Text size="lg" fw={700}>
                    {formatEventDateRange(occurrence.start_date, occurrence.end_date, series.timezone)}
                  </Text>
                </Group>
                <Group gap="lg">
                  {showVenue && (
                    <Group gap={6}>
                      <IconMapPin size={16} />
                      <Text size="sm" c="dimmed">{venueLabel}</Text>
                      {directionsUrl && (
                        <Text size="sm" component="a" href={directionsUrl} target="_blank" rel="noopener noreferrer">
                          Get directions
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

              {upcoming.length > 1 && (
                <Paper withBorder radius="lg" p="md" maw={700}>
                  <Stack gap="xs">
                    <Text fw={600} size="sm">
                      Upcoming dates
                    </Text>
                    <Stack gap={4}>
                      {upcoming.map((o) => (
                        <Group
                          key={o.public_occurrence_id}
                          justify="space-between"
                          py={4}
                          style={o.is_selected ? { fontWeight: 600 } : undefined}
                        >
                          {o.is_selected ? (
                            <Text size="sm" fw={600}>
                              {formatEventDate(o.date, series.timezone)} · {formatEventTime(o.start_date ?? "", series.timezone)} (selected)
                            </Text>
                          ) : (
                            <Text
                              size="sm"
                              component="a"
                              href={`/${organization.slug}/${series.slug}/${o.public_occurrence_id}`}
                            >
                              {formatEventDate(o.date, series.timezone)} · {formatEventTime(o.start_date ?? "", series.timezone)}
                            </Text>
                          )}
                          {badgeFor(o.availability)}
                        </Group>
                      ))}
                    </Stack>
                  </Stack>
                </Paper>
              )}

              {organization.description && (
                <Text c="dimmed" maw={640}>
                  {organization.description}
                </Text>
              )}

              {series.description && <ExpandableHtml html={series.description} maw={700} />}

              {series.gallery.length > 0 && <EventGallery gallery={series.gallery} />}

              {/* From the *selected occurrence*, not the series template — a
                  special one-off lineup/rotation must show only on its own
                  date, never bleed into every occurrence's page. */}
              {occurrence.content_sections.length > 0 && <PublicContentSections sections={occurrence.content_sections} />}

              {/* Purely a visual preview — the "Get directions" link above
                  is the actual navigation action and is unrelated to this. */}
              {showVenue && location?.latitude != null && location?.longitude != null && (
                <Box
                  component="img"
                  src={staticMapImageUrl(location.latitude, location.longitude) ?? undefined}
                  alt={`Map showing ${venueLabel}`}
                  maw={700}
                  style={{ width: "100%", borderRadius: "var(--mantine-radius-lg)", display: staticMapImageUrl(location.latitude, location.longitude) ? "block" : "none" }}
                />
              )}

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

              {occurrence.terms && (
                <Group gap={6}>
                  <Text size="sm" fw={600}>
                    Terms &amp; Conditions
                  </Text>
                  <TermsAndConditionsLink eventId={occurrence.id} terms={occurrence.terms} />
                </Group>
              )}
            </Stack>
          </GridCol>

          <GridCol span={{ base: 12, md: 5, lg: 4 }}>
            <Box id="checkout-section" pos={{ base: "static", md: "sticky" }} top={84}>
              {occurrence.has_ended ? (
                <Alert color="gray" variant="light" title="This date has ended">
                  Tickets are no longer available for this date{upcoming.length > 0 ? " — see the upcoming dates above." : "."}
                </Alert>
              ) : (
                <Paper withBorder radius="lg" p={{ base: "md", sm: "lg" }}>
                  <Checkout event={occurrence} />
                </Paper>
              )}
            </Box>
          </GridCol>
        </Grid>
      </Container>
      <MobileBuyBar targetId="checkout-section" priceLabel={cheapestPriceLabel(occurrence)} disabled={occurrence.has_ended} />
    </Box>
  );
}
