import { ActionIcon, Avatar, Badge, Box, Button, Divider, Group, Image, Stack, Text } from "@mantine/core";
import { IconCalendar, IconHeart, IconMapPin, IconWorld } from "@tabler/icons-react";
import { formatEventCardDate } from "@/lib/eventDateTime";
import { formatMoney } from "@/lib/money";
import type { PublicEventCard as PublicEventCardData } from "@/lib/publicEventApi";
import { LinkCard } from "@/components/LinkCard";

/**
 * One tag, never both: subcategory if the organizer set one, else the
 * category — the exact rule from this feature's spec.
 */
function tagLabel(event: PublicEventCardData): string {
  return event.subcategory?.name ?? event.category?.name ?? "Uncategorized";
}

function locationSummary(event: PublicEventCardData): { icon: "pin" | "globe"; text: string } {
  const location = event.location;
  if (!location) return { icon: "pin", text: "Location TBA" };
  if (location.location_type === "ONLINE") return { icon: "globe", text: "Online event" };
  const parts = [location.city, location.country].filter(Boolean);
  return { icon: "pin", text: parts.length > 0 ? parts.join(", ") : "Location TBA" };
}

/**
 * `compact` is only for the fixed-width mobile carousel tile (always
 * small, regardless of viewport — it's a 240px card by design). Every
 * other card — including the "desktop" 3-column grid AND the flat
 * filtered grid, which spans mobile through desktop widths — scales
 * its own type/image size down on narrow screens via responsive `fz`/
 * `h`/`p` breakpoints rather than a single fixed desktop size, so a
 * one-column mobile card doesn't render with the same font size as a
 * three-column desktop one.
 */
export function EventCard({ event, compact = false }: { event: PublicEventCardData; compact?: boolean }) {
  const location = locationSummary(event);
  const priceLabel = event.starts_from_price !== null ? formatMoney(event.starts_from_price, event.currency_code) : null;

  return (
    <LinkCard
      href={`/${event.organizer.slug}/${event.slug}`}
      withBorder
      radius="md"
      p={0}
      style={{ textDecoration: "none", width: compact ? 240 : "100%", flexShrink: 0, scrollSnapAlign: "start" }}
    >
      <Box pos="relative" h={compact ? 151 : { base: 180, md: 240 }}>
        {event.cover_image_url ? (
          <Image src={event.cover_image_url} alt={event.title} h="100%" fit="cover" />
        ) : (
          <Box h="100%" style={{ backgroundColor: "var(--mantine-color-gray-light)" }} />
        )}
        <Badge
          size={compact ? "xs" : "sm"}
          radius="xl"
          tt="none"
          pos="absolute"
          bottom={10}
          left={10}
          styles={{ root: { backgroundColor: "var(--mantine-color-white)", color: "var(--mantine-color-grey-9)" } }}
        >
          {tagLabel(event)}
        </Badge>
        <ActionIcon
          aria-label="Save event"
          radius="xl"
          size={compact ? "sm" : "md"}
          pos="absolute"
          top={10}
          right={10}
          variant="filled"
          color="dark"
        >
          <IconHeart size={compact ? 12 : 16} />
        </ActionIcon>
      </Box>

      <Stack gap={compact ? 8 : 12} p={compact ? 12 : { base: 16, md: 24 }}>
        <Stack gap={6}>
          <Text fw={500} fz={compact ? 16 : { base: 16, md: 20 }} c="var(--mantine-color-text)" lineClamp={1}>
            {event.title}
          </Text>
          <Group gap={8} wrap="nowrap">
            <Avatar src={event.organizer.logo_url} size={20} radius="xl">
              {event.organizer.name[0]}
            </Avatar>
            <Text size="xs" c="dimmed" lineClamp={1}>
              {event.organizer.name}
            </Text>
          </Group>
        </Stack>

        <Stack gap={6}>
          <Group gap={8} wrap="nowrap">
            <IconCalendar size={compact ? 12 : 14} />
            <Text size="xs" c="dimmed" lineClamp={1}>
              {formatEventCardDate(event.start_date, event.timezone)}
            </Text>
          </Group>
          <Group gap={8} wrap="nowrap">
            {location.icon === "globe" ? <IconWorld size={compact ? 12 : 14} /> : <IconMapPin size={compact ? 12 : 14} />}
            <Text size="xs" c="var(--mantine-color-text)" lineClamp={1}>
              {location.text}
            </Text>
          </Group>
        </Stack>

        <Divider />

        <Group justify="space-between" align="center" wrap="nowrap">
          <Stack gap={2}>
            <Text size="xs" c="dimmed">
              Starts From
            </Text>
            <Text fw={600} fz={compact ? 14 : { base: 14, md: 18 }}>
              {priceLabel ?? "—"}
            </Text>
          </Stack>
          {/* Not its own link — the whole card is already the LinkCard anchor below; a nested anchor here would be invalid HTML. */}
          <Button component="span" size={compact ? "xs" : "sm"}>
            {event.is_free ? "Register" : "Buy Ticket"}
          </Button>
        </Group>
      </Stack>
    </LinkCard>
  );
}
