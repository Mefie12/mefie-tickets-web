"use client";

import { Button, Card, Group, Stack, Text } from "@mantine/core";
import { formatEventTime } from "@/lib/eventDateTime";
import type { RecentCheckIn } from "@/lib/publicCheckInApi";

export function CheckInActivityFeed({
  checkIns,
  timezone,
  onUndo,
  isBusy,
}: {
  checkIns: RecentCheckIn[];
  timezone: string;
  onUndo: (checkInShortId: string) => void;
  isBusy: boolean;
}) {
  if (checkIns.length === 0) {
    return (
      <Text size="sm" c="dimmed" ta="center" py="md">
        No check-ins yet.
      </Text>
    );
  }

  return (
    <Stack gap="xs">
      {checkIns.map((checkIn) => (
        <Card key={checkIn.short_id} withBorder radius="md" p="sm">
          <Group justify="space-between" wrap="nowrap">
            <Stack gap={0}>
              <Text fw={600} size="sm">
                {checkIn.attendee_name}
              </Text>
              <Text size="xs" c="dimmed">
                {formatEventTime(checkIn.created_at, timezone)}
              </Text>
            </Stack>
            <Button size="xs" variant="subtle" color="red" disabled={isBusy} onClick={() => onUndo(checkIn.short_id)}>
              Undo
            </Button>
          </Group>
        </Card>
      ))}
    </Stack>
  );
}
