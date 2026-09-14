"use client";

import { Badge, Group, Stack, Text } from "@mantine/core";
import { IconLock, IconPencil } from "@tabler/icons-react";

/**
 * "Gate configuration: Editable / Locked for operations" — the always-on
 * indicator so an organizer understands *why* Add Entrance / Add Lane is
 * disabled, instead of assuming the app is broken. Shown on Entrances &
 * ticket routing and on Scanner setup.
 *
 * `locked` should already fold in every reason the structure can't be
 * edited (scanner setups outstanding, a device activated, a staged
 * routing change in flight); `reason` is the message to explain it.
 */
export function GateConfigStatus({
  locked,
  reason,
  eventStatus,
}: {
  locked: boolean;
  reason?: string | null;
  eventStatus: string;
}) {
  // Structure is only ever "locked for operations" once the event is live.
  // A draft event is always freely editable.
  const effectivelyLocked = eventStatus === "LIVE" && locked;

  return (
    <Stack gap={4}>
      <Group gap="xs">
        <Text size="sm" fw={600}>Gate configuration</Text>
        {effectivelyLocked ? (
          <Badge color="orange" variant="light" leftSection={<IconLock size={12} />}>
            Locked for operations
          </Badge>
        ) : (
          <Badge color="teal" variant="light" leftSection={<IconPencil size={12} />}>
            Editable
          </Badge>
        )}
      </Group>
      {effectivelyLocked && reason && (
        <Text size="xs" c="dimmed">{reason}</Text>
      )}
    </Stack>
  );
}
