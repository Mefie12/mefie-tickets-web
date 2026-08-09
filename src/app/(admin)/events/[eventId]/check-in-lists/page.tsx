import Link from "next/link";
import { notFound } from "next/navigation";
import { Badge, Button, Card, Group, Stack, Text, Title } from "@mantine/core";
import { IconPlus, IconQrcode } from "@tabler/icons-react";
import { backendRequest } from "@/lib/backend";
import type { CheckInListWithLinks } from "@/lib/checkInListApi";
import type { Event } from "@/lib/eventApi";

export default async function CheckInListsPage({
  params,
}: {
  params: Promise<{ eventId: string }>;
}) {
  const { eventId } = await params;

  const [eventResult, listsResult] = await Promise.all([
    backendRequest<{ event: Event }>(`/api/events/${eventId}`),
    backendRequest<{ check_in_lists: CheckInListWithLinks[] }>(`/api/events/${eventId}/check-in-lists`),
  ]);

  if (eventResult.status !== 200) {
    notFound();
  }

  const event = eventResult.data.event;
  const lists = listsResult.status === 200 ? listsResult.data.check_in_lists : [];

  return (
    <Stack gap="xl" maw={720}>
      <Group justify="space-between" align="flex-start">
        <Stack gap={0}>
          <Text size="sm" c="dimmed">
            {event.title}
          </Text>
          <Title order={2} fz={28}>
            Check-In Lists
          </Title>
        </Stack>
        <Button
          component={Link}
          href={`/events/${eventId}/check-in-lists/new`}
          leftSection={<IconPlus size={16} />}
        >
          New check-in list
        </Button>
      </Group>

      {lists.length === 0 ? (
        <Card withBorder radius="lg" p="xl">
          <Stack align="center" gap="xs" py="lg">
            <IconQrcode size={32} opacity={0.5} />
            <Text c="dimmed" ta="center">
              No check-in lists yet. Create one to get a scannable gate link.
            </Text>
          </Stack>
        </Card>
      ) : (
        <Stack gap="sm">
          {lists.map((list) => (
            <Card
              key={list.id}
              component={Link}
              href={`/events/${eventId}/check-in-lists/${list.id}`}
              withBorder
              radius="lg"
              p="md"
              style={{ textDecoration: "none" }}
            >
              <Group justify="space-between">
                <Stack gap={0}>
                  <Text fw={600} c="var(--mantine-color-text)">
                    {list.name}
                  </Text>
                  <Text size="sm" c="dimmed">
                    {list.short_id}
                  </Text>
                </Stack>
                <Badge color={list.product_ids === null ? "gray" : "violet"} variant="light">
                  {list.product_ids === null ? "All ticket types" : `${list.product_ids.length} ticket type(s)`}
                </Badge>
              </Group>
            </Card>
          ))}
        </Stack>
      )}
    </Stack>
  );
}
