"use client";

import { useMemo, useState } from "react";
import { Badge, Button, Card, Group, Stack, Text, TextInput } from "@mantine/core";
import { useDebouncedValue } from "@mantine/hooks";
import { IconSearch } from "@tabler/icons-react";
import type { CheckInAttendee } from "@/lib/publicCheckInApi";

export function AttendeeSearch({
  attendees,
  onCheckIn,
  onUndo,
  isBusy,
}: {
  attendees: CheckInAttendee[];
  onCheckIn: (attendeeShortId: string) => void;
  onUndo: (checkInShortId: string) => void;
  isBusy: boolean;
}) {
  const [query, setQuery] = useState("");
  const [debouncedQuery] = useDebouncedValue(query, 200);

  const results = useMemo(() => {
    const q = debouncedQuery.trim().toLowerCase();
    if (q.length === 0) return [];

    return attendees
      .filter(
        (a) =>
          `${a.first_name} ${a.last_name}`.toLowerCase().includes(q) || a.email.toLowerCase().includes(q),
      )
      .slice(0, 20);
  }, [attendees, debouncedQuery]);

  return (
    <Stack gap="sm">
      <TextInput
        leftSection={<IconSearch size={16} />}
        placeholder="Search by name or email"
        value={query}
        onChange={(e) => setQuery(e.currentTarget.value)}
      />

      {debouncedQuery.trim().length > 0 && results.length === 0 && (
        <Text size="sm" c="dimmed" ta="center" py="md">
          No matching attendees.
        </Text>
      )}

      <Stack gap="xs">
        {results.map((attendee) => (
          <Card key={attendee.short_id} withBorder radius="md" p="sm">
            <Group justify="space-between" wrap="nowrap">
              <Stack gap={0}>
                <Text fw={600} size="sm">
                  {attendee.first_name} {attendee.last_name}
                </Text>
                <Text size="xs" c="dimmed">
                  {attendee.email} · {attendee.product_title}
                </Text>
              </Stack>

              {attendee.active_check_in ? (
                <Group gap="xs">
                  <Badge color="teal" variant="light">
                    Checked in
                  </Badge>
                  <Button
                    size="xs"
                    variant="subtle"
                    color="red"
                    disabled={isBusy}
                    onClick={() => onUndo(attendee.active_check_in!.short_id)}
                  >
                    Undo
                  </Button>
                </Group>
              ) : attendee.is_checked_in ? (
                <Badge color="gray" variant="light">
                  Checked in elsewhere
                </Badge>
              ) : (
                <Button size="xs" disabled={isBusy} onClick={() => onCheckIn(attendee.short_id)}>
                  Check in
                </Button>
              )}
            </Group>
          </Card>
        ))}
      </Stack>
    </Stack>
  );
}
