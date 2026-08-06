import Link from "next/link";
import { notFound } from "next/navigation";
import { Badge, Button, Card, Group, Stack, Text, Title } from "@mantine/core";
import { IconCalendarEvent, IconPlus } from "@tabler/icons-react";
import { backendRequest } from "@/lib/backend";
import type { Event, EventStatus } from "@/lib/eventApi";
import type { Organizer } from "@/lib/organizerApi";

const STATUS_COLOR: Record<EventStatus, string> = {
  DRAFT: "gray",
  LIVE: "teal",
  ARCHIVED: "dark",
};

export default async function OrganizerEventsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const [organizerResult, eventsResult] = await Promise.all([
    backendRequest<{ organizer: Organizer }>(`/api/organizers/${id}`),
    backendRequest<{ events: Event[] }>(`/api/events?organizer_id=${id}`),
  ]);

  if (organizerResult.status !== 200) {
    notFound();
  }

  const organizer = organizerResult.data.organizer;
  const events = eventsResult.status === 200 ? eventsResult.data.events : [];

  return (
    <Stack gap="xl" maw={720}>
      <Group justify="space-between">
        <Stack gap={0}>
          <Text size="sm" c="dimmed">
            {organizer.name}
          </Text>
          <Title order={2} fz={28}>
            Events
          </Title>
        </Stack>
        <Button component={Link} href={`/organizers/${id}/events/new`} leftSection={<IconPlus size={16} />}>
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
              href={`/organizers/${id}/events/${event.id}`}
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
                    {new Date(event.start_date).toLocaleDateString(undefined, {
                      month: "long",
                      day: "numeric",
                      year: "numeric",
                    })}
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
