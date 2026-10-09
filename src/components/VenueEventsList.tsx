"use client";

import { useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { Alert, Badge, Button, Card, Container, Group, Loader, Stack, Text, Title } from "@mantine/core";
import { IconChevronRight, IconMapPin } from "@tabler/icons-react";
import { formatInZone, groupVenueEvents, listVenueEvents, type VenueEventRow } from "@/lib/venueApi";

function EventRow({ event }: { event: VenueEventRow }) {
  return (
    <Card withBorder radius="lg" p="md" component={Link} href={`/venue/events/${event.id}`} style={{ textDecoration: "none", color: "inherit" }}>
      <Group justify="space-between" wrap="nowrap" gap="md">
        <Stack gap={4} style={{ minWidth: 0 }}>
          <Text fw={600} truncate>{event.title}</Text>
          <Text size="sm" c="dimmed" truncate>{event.organizer}</Text>
          <Group gap="xs" wrap="wrap">
            <Text size="sm">{formatInZone(event.start_date, event.timezone)}</Text>
            {event.venue_name && (
              <Group gap={4} wrap="nowrap">
                <IconMapPin size={14} aria-hidden />
                <Text size="sm" c="dimmed">{event.venue_name}</Text>
              </Group>
            )}
          </Group>
        </Stack>
        <Group gap="xs" wrap="nowrap">
          {event.phase === "LIVE_NOW" && <Badge color="green" styles={{ label: { overflow: "visible" } }}>Happening now</Badge>}
          {event.phase === "UPCOMING" && <Badge color="blue" variant="light" styles={{ label: { overflow: "visible" } }}>Upcoming</Badge>}
          {event.phase === "PAST" && <Badge color="gray" variant="light" styles={{ label: { overflow: "visible" } }}>Ended</Badge>}
          <IconChevronRight size={18} aria-hidden />
        </Group>
      </Group>
    </Card>
  );
}

function Section({ title, events }: { title: string; events: VenueEventRow[] }) {
  if (events.length === 0) return null;

  return (
    <Stack gap="sm">
      <Title order={4}>{title}</Title>
      {events.map((event) => <EventRow key={event.id} event={event} />)}
    </Stack>
  );
}

/** The venue agent's home: every event they can see, with no numbers — those live one tap deeper. */
export function VenueEventsList() {
  const query = useQuery({ queryKey: ["venue-events"], queryFn: listVenueEvents, retry: false });
  const [showPast, setShowPast] = useState(false);
  const grouped = groupVenueEvents(query.data?.events ?? []);

  return (
    <Container size="md" py="xl">
      <Stack gap="xl">
        <Stack gap={2}>
          <Title order={2}>Venue events</Title>
          <Text c="dimmed">Events you have been invited to follow. You can view how they are going; you cannot change anything.</Text>
        </Stack>

        {query.isLoading && <Loader />}
        {query.isError && <Alert color="yellow">Something went wrong loading your events. Try refreshing the page.</Alert>}
        {query.data && query.data.events.length === 0 && (
          <Card withBorder radius="lg" p="lg">
            <Stack gap={4}>
              <Text fw={600}>No events yet</Text>
              <Text size="sm" c="dimmed">When an organizer invites you to an event and you accept, it will appear here. If your access was removed or the event ended more than a week ago, it no longer shows.</Text>
            </Stack>
          </Card>
        )}

        <Section title="Happening now" events={grouped.live} />
        <Section title="Upcoming" events={grouped.upcoming} />
        {grouped.past.length > 0 && (
          <Stack gap="sm">
            <Group justify="space-between">
              <Title order={4}>Past</Title>
              <Button variant="subtle" size="compact-sm" onClick={() => setShowPast((v) => !v)} aria-expanded={showPast}>
                {showPast ? "Hide" : `Show ${grouped.past.length}`}
              </Button>
            </Group>
            {showPast && grouped.past.map((event) => <EventRow key={event.id} event={event} />)}
          </Stack>
        )}
      </Stack>
    </Container>
  );
}
