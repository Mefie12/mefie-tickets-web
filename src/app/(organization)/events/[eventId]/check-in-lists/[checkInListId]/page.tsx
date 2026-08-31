import Link from "next/link";
import { notFound } from "next/navigation";
import { Anchor, Badge, Card, Code, Group, Stack, Text, Title } from "@mantine/core";
import { backendRequest } from "@/lib/backend";
import type { CheckInList } from "@/lib/checkInListApi";
import type { Event } from "@/lib/eventApi";
import { CopyLinkButton } from "@/components/CopyLinkButton";

export default async function CheckInListDetailPage({
  params,
}: {
  params: Promise<{ eventId: string; checkInListId: string }>;
}) {
  const { eventId, checkInListId } = await params;

  const [eventResult, listResult] = await Promise.all([
    backendRequest<{ event: Event }>(`/api/events/${eventId}`),
    backendRequest<{ check_in_list: CheckInList }>(`/api/events/${eventId}/check-in-lists/${checkInListId}`),
  ]);

  if (eventResult.status !== 200 || listResult.status !== 200) {
    notFound();
  }

  const event = eventResult.data.event;
  const { check_in_list: list } = listResult.data;

  return (
    <Stack gap="xl" maw={560}>
      <Stack gap={0}>
        <Text size="sm" c="dimmed">
          {event.title}
        </Text>
        <Title order={2} fz={28}>
          {list.name}
        </Title>
      </Stack>

      <Card withBorder radius="lg" p="xl">
        <Stack gap="md">
          <Group justify="space-between">
            <Text fw={600}>Gate access</Text>
            <Badge color={list.product_ids === null ? "gray" : "violet"} variant="light">
              {list.product_ids === null ? "All ticket types" : `${list.product_ids.length} ticket type(s)`}
            </Badge>
          </Group>
          <Text size="sm" c="dimmed">
            Gate staff open <Code>/gate</Code> and sign in with a gate pass for this event plus the list code below.
            Manage passes on the{" "}
            <Anchor component={Link} href={`/events/${eventId}/gate-passes`}>
              gate passes
            </Anchor>{" "}
            page.
          </Text>
          <Group gap="xs" wrap="nowrap">
            <Text size="sm" c="dimmed">
              List code
            </Text>
            <Code>{list.short_id}</Code>
            <CopyLinkButton value={list.short_id} />
          </Group>
        </Stack>
      </Card>
    </Stack>
  );
}
