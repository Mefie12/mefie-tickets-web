import { notFound } from "next/navigation";
import { Avatar, Box, Container, Group, Paper, Stack, Text, Title } from "@mantine/core";
import { IconCalendar, IconMapPin, IconWorld } from "@tabler/icons-react";
import { backendRequest } from "@/lib/backend";
import type { PublicEvent } from "@/lib/publicEventApi";
import { Checkout } from "@/components/Checkout";

function formatDateRange(startIso: string, endIso: string): string {
  const start = new Date(startIso);
  const end = new Date(endIso);
  const dateFmt: Intl.DateTimeFormatOptions = { weekday: "long", month: "long", day: "numeric", year: "numeric" };
  const timeFmt: Intl.DateTimeFormatOptions = { hour: "numeric", minute: "2-digit" };
  const sameDay = start.toDateString() === end.toDateString();

  if (sameDay) {
    return `${start.toLocaleDateString(undefined, dateFmt)} · ${start.toLocaleTimeString(undefined, timeFmt)} – ${end.toLocaleTimeString(undefined, timeFmt)}`;
  }
  return `${start.toLocaleDateString(undefined, dateFmt)} – ${end.toLocaleDateString(undefined, dateFmt)}`;
}

export default async function PublicEventPage({
  params,
}: {
  params: Promise<{ organizerSlug: string; eventSlug: string }>;
}) {
  const { organizerSlug, eventSlug } = await params;

  const result = await backendRequest<{ event: PublicEvent }>(
    `/api/public/organizers/${organizerSlug}/events/${eventSlug}`,
  );

  if (result.status !== 200) {
    notFound();
  }

  const { event } = result.data;
  const { location, organizer } = event;

  return (
    <Box>
      <Box
        h={260}
        style={{
          backgroundColor: "var(--mantine-color-dark-6)",
          backgroundImage: organizer.cover_image_url ? `url(${organizer.cover_image_url})` : undefined,
          backgroundSize: "cover",
          backgroundPosition: "center",
        }}
      />

      <Container size="md" py="xl">
        <Stack gap="xl">
          <Group gap="md" align="flex-start">
            <Avatar src={organizer.logo_url} size={56} radius="lg" color="brand" mt={-48}>
              {organizer.name[0]}
            </Avatar>
            <Stack gap={4}>
              <Text size="sm" c="dimmed" fw={500}>
                {organizer.name}
              </Text>
              <Title order={1} fz={34}>
                {event.title}
              </Title>
            </Stack>
          </Group>

          <Group gap="lg">
            <Group gap={6}>
              <IconCalendar size={18} />
              <Text size="sm">{formatDateRange(event.start_date, event.end_date)}</Text>
            </Group>
            <Group gap={6}>
              {location.is_online ? <IconWorld size={18} /> : <IconMapPin size={18} />}
              <Text size="sm">
                {location.is_online
                  ? "Online event"
                  : [location.venue_name, location.city, location.state].filter(Boolean).join(", ") || "Location TBA"}
              </Text>
            </Group>
          </Group>

          {organizer.description && (
            <Text c="dimmed" maw={640}>
              {organizer.description}
            </Text>
          )}

          <Paper withBorder radius="lg" p="lg">
            <Checkout event={event} />
          </Paper>
        </Stack>
      </Container>
    </Box>
  );
}
