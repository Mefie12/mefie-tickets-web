"use client";

import { Group, Stack, Text } from "@mantine/core";
import { IconDiscount2 } from "@tabler/icons-react";
import type { LineNudge } from "@/lib/offerNudge";

/**
 * "Add 1 more ticket to get 2 for GHS 350" under the ticket list. Polite live region so it is announced when the
 * buyer changes a quantity without stealing focus. Renders nothing when there is nothing true to suggest.
 */
export function OfferNudge({ nudges }: { nudges: LineNudge[] }) {
  if (nudges.length === 0) return null;
  return (
    <Stack gap={6} role="status" aria-live="polite">
      {nudges.map((nudge) => (
        <Group key={nudge.key} gap={8} wrap="nowrap" align="flex-start">
          <IconDiscount2 size={16} style={{ flexShrink: 0, marginTop: 2 }} color="#18794e" aria-hidden />
          {/* Savings colour: 4.5:1+ on a light card; the page background is light too. */}
          <Text size="sm" fw={500} c="#18794e">{nudge.message}</Text>
        </Group>
      ))}
    </Stack>
  );
}
