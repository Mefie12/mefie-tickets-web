import { notFound } from "next/navigation";
import { Badge, Card, Group, Image, Progress, Stack, Text, Title } from "@mantine/core";
import { backendRequest } from "@/lib/backend";
import type { CheckInList, ShareLinks } from "@/lib/checkInListApi";
import type { CheckInListPayload } from "@/lib/publicCheckInApi";
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
    backendRequest<{ check_in_list: CheckInList; share_links: ShareLinks }>(
      `/api/events/${eventId}/check-in-lists/${checkInListId}`,
    ),
  ]);

  if (eventResult.status !== 200 || listResult.status !== 200) {
    notFound();
  }

  const event = eventResult.data.event;
  const { check_in_list: list, share_links: shareLinks } = listResult.data;

  const publicResult = await backendRequest<CheckInListPayload>(`/api/public/check-in-lists/${list.short_id}`);
  const stats = publicResult.status === 200 ? publicResult.data.stats : null;

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

      {stats && (
        <Card withBorder radius="lg" p="xl">
          <Stack gap="xs">
            <Group justify="space-between">
              <Text fw={600}>
                {stats.checked_in} / {stats.total} checked in
              </Text>
              <Badge color={list.product_ids === null ? "gray" : "violet"} variant="light">
                {list.product_ids === null ? "All ticket types" : `${list.product_ids.length} ticket type(s)`}
              </Badge>
            </Group>
            <Progress value={stats.total > 0 ? (stats.checked_in / stats.total) * 100 : 0} size="lg" radius="xl" />
          </Stack>
        </Card>
      )}

      <Card withBorder radius="lg" p="xl">
        <Stack align="center" gap="md">
          <Text size="sm" c="dimmed" ta="center">
            Share this link or QR code with gate staff — no login required to scan or search.
          </Text>

          <Image src={shareLinks.qr_code_data_uri} alt="QR code for the gate check-in scanner" w={220} h={220} />

          <Group gap="xs" wrap="nowrap" w="100%">
            <Text
              size="sm"
              ff="monospace"
              style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}
            >
              {shareLinks.public_url}
            </Text>
            <CopyLinkButton value={shareLinks.public_url} />
          </Group>
        </Stack>
      </Card>
    </Stack>
  );
}
