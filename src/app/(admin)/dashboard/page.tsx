import { Badge, Card, Group, SimpleGrid, Stack, Text, Title } from "@mantine/core";
import { IconConfetti, IconPlus } from "@tabler/icons-react";
import { backendRequest } from "@/lib/backend";
import { formatEventDate } from "@/lib/eventDateTime";
import type { Event, EventStatus } from "@/lib/eventApi";
import { LinkButton } from "@/components/LinkButton";
import { LinkCard } from "@/components/LinkCard";

const STATUS_COLOR: Record<EventStatus, string> = {
  DRAFT: "gray",
  LIVE: "teal",
  ARCHIVED: "dark",
};

export default async function DashboardPage() {
  const result = await backendRequest<{ events: Event[] }>("/api/events");
  const events = result.status === 200 ? result.data.events : [];

  if (events.length === 0) {
    return (
      <Stack gap="xl" maw={640}>
        <Title order={2} fz={28}>
          Dashboard
        </Title>
        <Card withBorder radius="lg" p="xl" shadow="md">
          <Stack align="center" gap="sm" py="lg">
            <IconConfetti size={40} />
            <Title order={3} fz={22} ta="center">
              Organization ready — create your first event
            </Title>
            <Text c="dimmed" ta="center" maw={420}>
              Your organization is set up. The next step is creating an event so you can start selling tickets.
            </Text>
            <LinkButton href="/events/new" leftSection={<IconPlus size={16} />} mt="sm" size="md">
              Create your first event
            </LinkButton>
          </Stack>
        </Card>
      </Stack>
    );
  }

  const live = events.filter((event) => event.status === "LIVE").length;
  const draft = events.filter((event) => event.status === "DRAFT").length;
  const recentEvents = [...events]
    .sort((a, b) => (b.created_at > a.created_at ? 1 : -1))
    .slice(0, 5);

  return (
    <Stack gap="xl" maw={720}>
      <Group justify="space-between">
        <Title order={2} fz={28}>
          Dashboard
        </Title>
        <LinkButton href="/events/new" leftSection={<IconPlus size={16} />}>
          Create event
        </LinkButton>
      </Group>

      <SimpleGrid cols={{ base: 1, sm: 3 }} spacing="md">
        <Card withBorder radius="lg" p="lg">
          <Text size="xs" c="dimmed">
            Total events
          </Text>
          <Text fz={28} fw={700}>
            {events.length}
          </Text>
        </Card>
        <Card withBorder radius="lg" p="lg">
          <Text size="xs" c="dimmed">
            Live
          </Text>
          <Text fz={28} fw={700} c="teal">
            {live}
          </Text>
        </Card>
        <Card withBorder radius="lg" p="lg">
          <Text size="xs" c="dimmed">
            Drafts
          </Text>
          <Text fz={28} fw={700} c="gray">
            {draft}
          </Text>
        </Card>
      </SimpleGrid>

      <Stack gap="sm">
        <Group justify="space-between">
          <Text fw={600}>Recent events</Text>
          <LinkButton href="/events" variant="subtle" size="compact-sm">
            View all
          </LinkButton>
        </Group>
        {recentEvents.map((event) => (
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
    </Stack>
  );
}
