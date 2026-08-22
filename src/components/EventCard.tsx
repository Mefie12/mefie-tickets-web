import { Avatar, Badge, Box, Group, Image, Stack, Text } from "@mantine/core";
import { IconMapPin, IconWorld } from "@tabler/icons-react";
import { formatEventDate } from "@/lib/eventDateTime";
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

export function EventCard({ event }: { event: PublicEventCardData }) {
  const location = locationSummary(event);

  return (
    <LinkCard
      href={`/${event.organizer.slug}/${event.slug}`}
      withBorder
      radius="lg"
      p="md"
      style={{ textDecoration: "none" }}
    >
      {event.cover_image_url ? (
        <Image src={event.cover_image_url} alt={event.title} h={160} radius="md" />
      ) : (
        <Box h={160} style={{ backgroundColor: "var(--mantine-color-gray-light)", borderRadius: "var(--mantine-radius-md)" }} />
      )}

      <Stack gap="xs" pt="md">
        <Badge variant="light" size="sm" style={{ alignSelf: "flex-start" }}>
          {tagLabel(event)}
        </Badge>

        <Text fw={600} c="var(--mantine-color-text)" lineClamp={2}>
          {event.title}
        </Text>

        <Text size="sm" c="dimmed">
          {formatEventDate(event.start_date, event.timezone)}
        </Text>

        <Group gap={6}>
          {location.icon === "globe" ? <IconWorld size={14} /> : <IconMapPin size={14} />}
          <Text size="sm" c="dimmed">
            {location.text}
          </Text>
        </Group>

        <Group gap={6} mt={4}>
          <Avatar src={event.organizer.logo_url} size={20} radius="xl">
            {event.organizer.name[0]}
          </Avatar>
          <Text size="xs" c="dimmed">
            {event.organizer.name}
          </Text>
        </Group>
      </Stack>
    </LinkCard>
  );
}
