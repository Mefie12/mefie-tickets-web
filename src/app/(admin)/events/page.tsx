import Link from "next/link";
import { Badge, Button, Card, Group, Stack, Text, Title } from "@mantine/core";
import { IconCalendarEvent, IconPlus } from "@tabler/icons-react";
import { backendRequest } from "@/lib/backend";
import { formatEventDate } from "@/lib/eventDateTime";
import type { Event, EventStatus } from "@/lib/eventApi";

const STATUS_COLOR: Record<EventStatus, string> = {
  DRAFT: "gray",
  LIVE: "teal",
  ARCHIVED: "dark",
};

export default async function EventsPage() {
  const eventsResult = await backendRequest<{ events: Event[] }>("/api/events");
  const events = eventsResult.status === 200 ? eventsResult.data.events : [];

  return (
    <Stack gap="xl" maw={720}>
      <Group justify="space-between">
        <Title order={2} fz={28}>
          Events
        </Title>
        <Button component={Link} href="/events/new" leftSection={<IconPlus size={16} />}>
          Create event
        </Button>
      </Group>

      {events.length === 0 ? (
        <Card withBorder radius="lg" p="xl">
          <Stack align="center" gap="xs" py="lg">
            <IconCalendarEvent size={32} opacity={0.5} />
            <Text c="dimmed" ta="center">
              No events yet. Create one to start selling tickets.
            </Text>
          </Stack>
        </Card>
      ) : (
        <Stack gap="sm">
          {events.map((event) => (
            <Card
              key={event.id}
              component={Link}
              href={`/events/${event.id}`}
              withBorder
              radius="lg"
              p="md"
              style={{ textDecoration: "none" }}
            >
              <Group justify="space-between">
                <Stack gap={0}>
                  <Text fw={600} c="var(--mantine-color-text)">
                    {event.title}
                  </Text>
                  <Text size="sm" c="dimmed">
                    {/* In the event's zone — this is a Server Component, so
                        an unqualified toLocaleDateString would render in the
                        Node process's timezone. */}
                    {formatEventDate(event.start_date, event.timezone)}
                  </Text>
                </Stack>
                <Badge color={STATUS_COLOR[event.status]} variant="light">
                  {event.status}
                </Badge>
              </Group>
            </Card>
          ))}
        </Stack>
      )}
    </Stack>
  );
}
