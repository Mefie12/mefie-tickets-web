import { Badge, Card, Group, Stack, Text, Title } from "@mantine/core";
import { IconCalendarEvent, IconRepeat } from "@tabler/icons-react";
import { backendRequest } from "@/lib/backend";
import { formatEventDate } from "@/lib/eventDateTime";
import type { Event, EventStatus } from "@/lib/eventApi";
import type { EventSeries } from "@/lib/eventSeriesApi";
import { CreateEventMenu } from "@/components/CreateEventMenu";
import { LinkCard } from "@/components/LinkCard";

const STATUS_COLOR: Record<EventStatus, string> = {
  DRAFT: "gray",
  LIVE: "teal",
  ARCHIVED: "dark",
};

const FREQUENCY_LABEL: Record<EventSeries["frequency"], string> = {
  DAILY: "Daily", WEEKLY: "Weekly", MONTHLY: "Monthly",
};

function cadenceLabel(series: EventSeries): string {
  const label = FREQUENCY_LABEL[series.frequency];
  return series.interval > 1 ? `Every ${series.interval} ${label.toLowerCase().replace("ly", series.frequency === "DAILY" ? " days" : series.frequency === "WEEKLY" ? " weeks" : " months")}` : label;
}

export default async function EventsPage() {
  const [eventsResult, seriesResult] = await Promise.all([
    backendRequest<{ events: Event[] }>("/api/events"),
    backendRequest<{ event_series: EventSeries[] }>("/api/event-series"),
  ]);
  const events = eventsResult.status === 200 ? eventsResult.data.events : [];
  const series = seriesResult.status === 200 ? seriesResult.data.event_series : [];

  return (
    <Stack gap="xl" maw={720}>
      <Group justify="space-between">
        <Title order={2} fz={28}>
          Events
        </Title>
        <CreateEventMenu />
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
            <LinkCard
              key={event.id}
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
            </LinkCard>
          ))}
        </Stack>
      )}

      {series.length > 0 && (
        <>
          <Title order={3} fz={22} mt="md">
            Recurring series
          </Title>
          <Stack gap="sm">
            {series.map((s) => (
              <LinkCard key={s.id} href={`/event-series/${s.id}`} withBorder radius="lg" p="md" style={{ textDecoration: "none" }}>
                <Group justify="space-between">
                  <Stack gap={0}>
                    <Group gap={6}>
                      <IconRepeat size={14} opacity={0.6} />
                      <Text fw={600} c="var(--mantine-color-text)">
                        {s.title}
                      </Text>
                    </Group>
                    <Text size="sm" c="dimmed">
                      {cadenceLabel(s)} · starts {s.starts_on}
                    </Text>
                  </Stack>
                  <Badge color={STATUS_COLOR[s.status]} variant="light">
                    {s.status}
                  </Badge>
                </Group>
              </LinkCard>
            ))}
          </Stack>
        </>
      )}
    </Stack>
  );
}
