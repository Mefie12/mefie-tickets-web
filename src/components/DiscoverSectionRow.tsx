import { Group, SimpleGrid, Stack, Text, Title } from "@mantine/core";
import type { PublicEventCard as PublicEventCardData } from "@/lib/publicEventApi";
import { EventCard } from "@/components/EventCard";
import { LinkButton } from "@/components/LinkButton";

/**
 * One curated row (Featured Events, Coming up next, Happening this
 * weekend). Below `md` the cards become a horizontally-scrollable,
 * snap-scrolling carousel (Figma's mobile "Horizontal Scroll Row"); at
 * `md` and up they're a fixed row of full-size cards.
 *
 * Renders nothing at all when there are no events for this section —
 * an empty curated row (with no data to browse) isn't worth a title,
 * subtitle, and empty-state card taking up space on the landing page.
 */
export function DiscoverSectionRow({
  title,
  subtitle,
  events,
  viewAllHref,
}: {
  title: string;
  subtitle: string;
  events: PublicEventCardData[];
  viewAllHref: string;
}) {
  if (events.length === 0) return null;

  return (
    <Stack gap="md" w="100%">
      <Group justify="space-between" align="flex-end" wrap="nowrap" gap="sm">
        <Stack gap={4} style={{ flex: 1, minWidth: 0 }}>
          <Title order={2} fz={{ base: 20, md: 28 }}>
            {title}
          </Title>
          <Text fz={{ base: 13, md: 16 }} c="dimmed">
            {subtitle}
          </Text>
        </Stack>
        <LinkButton
          href={viewAllHref}
          variant="transparent"
          px={0}
          style={{ textDecoration: "underline", flexShrink: 0 }}
        >
          View all events
        </LinkButton>
      </Group>

      <Group
        gap="md"
        wrap="nowrap"
        hiddenFrom="md"
        style={{ overflowX: "auto", scrollSnapType: "x mandatory", width: "100%" }}
      >
        {events.map((event) => (
          <EventCard key={event.id} event={event} compact />
        ))}
      </Group>
      <SimpleGrid cols={{ md: 3 }} visibleFrom="md" spacing="lg">
        {events.slice(0, 3).map((event) => (
          <EventCard key={event.id} event={event} compact={false} />
        ))}
      </SimpleGrid>
    </Stack>
  );
}
