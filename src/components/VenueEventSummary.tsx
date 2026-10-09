"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { Alert, Button, Card, Container, Group, Loader, Progress, SimpleGrid, Stack, Table, Text, Title } from "@mantine/core";
import { IconArrowLeft, IconRefresh } from "@tabler/icons-react";
import { ApiError } from "@/lib/authApi";
import { formatInZone, getVenueEventSummary, timeInZone } from "@/lib/venueApi";

function Stat({ label, value, hint }: { label: string; value: number; hint?: string }) {
  return (
    <Card withBorder radius="lg" p="md">
      <Text size="sm" c="dimmed">{label}</Text>
      <Text fz={32} fw={700} lh={1.1}>{value.toLocaleString()}</Text>
      {hint && <Text size="xs" c="dimmed" mt={4}>{hint}</Text>}
    </Card>
  );
}

/** One event's live numbers for a venue agent. Counts only; the Refresh button is the only way it updates. */
export function VenueEventSummary({ eventId }: { eventId: number }) {
  const query = useQuery({
    queryKey: ["venue-event", eventId],
    queryFn: () => getVenueEventSummary(eventId),
    retry: false,
    refetchOnWindowFocus: false,
    staleTime: Infinity,
    gcTime: 0,
  });
  const back = (
    <Button component={Link} href="/venue" variant="subtle" leftSection={<IconArrowLeft size={16} />} px={0} w="fit-content">
      All events
    </Button>
  );

  if (query.isLoading) return <Container size="md" py="xl"><Loader /></Container>;

  if (query.isError || !query.data) {
    const gone = query.error instanceof ApiError && (query.error.status === 404 || query.error.status === 403);

    return (
      <Container size="md" py="xl">
        <Stack gap="md">
          {back}
          <Alert color={gone ? "gray" : "yellow"} title={gone ? "No access to this event" : "Could not load this event"}>
            {gone ? "You no longer have access to this event, or it has ended." : "Something went wrong. Try again in a moment."}
          </Alert>
          {!gone && <Button onClick={() => query.refetch()} loading={query.isFetching} w="fit-content">Try again</Button>}
        </Stack>
      </Container>
    );
  }

  const data = query.data;
  const { event } = data;
  const progress = data.expected_attendance > 0 ? Math.min(100, Math.round((data.checked_in / data.expected_attendance) * 100)) : 0;
  const showRegistrations = data.registrations > 0 || data.by_category.some((c) => c.registrations > 0);

  return (
    <Container size="md" py="xl">
      <Stack gap="lg">
        {back}

        <Stack gap={4}>
          <Title order={2}>{event.title}</Title>
          <Text c="dimmed">{event.organizer}{event.venue_name ? ` · ${event.venue_name}` : ""}{event.city ? `, ${event.city}` : ""}</Text>
        </Stack>

        <SimpleGrid cols={{ base: 1, xs: event.doors_open_at ? 3 : 2 }} spacing="sm">
          <Card withBorder radius="lg" p="md"><Text size="sm" c="dimmed">Starts</Text><Text fw={600}>{formatInZone(event.start_date, event.timezone)}</Text></Card>
          {event.doors_open_at && <Card withBorder radius="lg" p="md"><Text size="sm" c="dimmed">Doors open</Text><Text fw={600}>{formatInZone(event.doors_open_at, event.timezone)}</Text></Card>}
          <Card withBorder radius="lg" p="md"><Text size="sm" c="dimmed">Finishes</Text><Text fw={600}>{formatInZone(event.end_date, event.timezone)}</Text></Card>
        </SimpleGrid>

        <Group justify="space-between" align="center">
          <Text size="sm" c="dimmed" aria-live="polite">Updated at {timeInZone(data.generated_at, event.timezone)}</Text>
          <Button variant="light" leftSection={<IconRefresh size={16} />} loading={query.isFetching} onClick={() => query.refetch()}>Refresh</Button>
        </Group>

        <SimpleGrid cols={{ base: 1, xs: 2 }} spacing="sm">
          <Stat label="Tickets sold" value={data.ticket_sales} />
          <Stat label="Expected attendance" value={data.expected_attendance} hint={data.allocated_not_issued > 0 ? `Plus ${data.allocated_not_issued.toLocaleString()} complimentary tickets allocated but not yet issued` : undefined} />
          {data.complimentary > 0 && <Stat label="Complimentary tickets" value={data.complimentary} />}
          {showRegistrations && <Stat label="Registrations" value={data.registrations} />}
        </SimpleGrid>

        <Card withBorder radius="lg" p="md">
          <Stack gap="sm">
            <Text fw={600}>Check-in</Text>
            <Progress value={progress} aria-label={`${progress}% checked in`} size="lg" radius="xl" />
            <SimpleGrid cols={2}>
              <Stack gap={0}><Text fz={28} fw={700} lh={1.1}>{data.checked_in.toLocaleString()}</Text><Text size="sm" c="dimmed">Checked in</Text></Stack>
              <Stack gap={0}><Text fz={28} fw={700} lh={1.1}>{data.still_expected.toLocaleString()}</Text><Text size="sm" c="dimmed">Still expected</Text></Stack>
            </SimpleGrid>
          </Stack>
        </Card>

        {data.by_category.length > 0 && (
          <Card withBorder radius="lg" p="md">
            <Text fw={600} mb="sm">By ticket type</Text>
            <Table.ScrollContainer minWidth={420}>
              <Table verticalSpacing="xs">
                <Table.Thead>
                  <Table.Tr>
                    <Table.Th>Ticket</Table.Th>
                    <Table.Th ta="right">Sold</Table.Th>
                    {showRegistrations && <Table.Th ta="right">Registered</Table.Th>}
                    <Table.Th ta="right">Complimentary</Table.Th>
                    <Table.Th ta="right">Checked in</Table.Th>
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {data.by_category.map((category) => (
                    <Table.Tr key={category.name}>
                      <Table.Td>{category.name}</Table.Td>
                      <Table.Td ta="right">{category.ticket_sales.toLocaleString()}</Table.Td>
                      {showRegistrations && <Table.Td ta="right">{category.registrations.toLocaleString()}</Table.Td>}
                      <Table.Td ta="right">{category.complimentary.toLocaleString()}</Table.Td>
                      <Table.Td ta="right">{category.checked_in.toLocaleString()}</Table.Td>
                    </Table.Tr>
                  ))}
                </Table.Tbody>
              </Table>
            </Table.ScrollContainer>
          </Card>
        )}

        <Text size="xs" c="dimmed">Figures cover tickets issued through Mefie Tickets. Tickets sold through other outlets are not included, so this is not a venue capacity count.</Text>
      </Stack>
    </Container>
  );
}
