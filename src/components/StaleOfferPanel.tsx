"use client";

import { Alert, Button, Group, Stack, Text } from "@mantine/core";
import { IconAlertTriangle } from "@tabler/icons-react";
import { offerErrorMessage } from "@/lib/offerErrors";
import { formatMinorAmount } from "@/lib/money";

/**
 * Shown when order creation came back 409 because the offer is no longer
 * what the buyer was quoted (capacity gone, ended, paused). Non-blocking
 * and explicit: old total next to the new one, and the buyer must choose
 * to continue at the new price — they are never charged a price they
 * didn't see.
 */
export function StaleOfferPanel({ code, currency, previousTotalMinor, newTotalMinor, busy, onAccept, onBack }: {
  code: string;
  currency: string;
  previousTotalMinor: number | null;
  newTotalMinor: number | null;
  busy: boolean;
  onAccept: () => void;
  onBack: () => void;
}) {
  const changed = previousTotalMinor !== null && newTotalMinor !== null && previousTotalMinor !== newTotalMinor;

  return (
    <Alert color="yellow" radius="md" icon={<IconAlertTriangle size={18} />} title="Your price changed" role="alert">
      <Stack gap="sm">
        <Text size="sm">{offerErrorMessage(code)}</Text>
        {changed && (
          <Group gap="xs" align="baseline">
            <Text size="sm" td="line-through" c="dimmed">{formatMinorAmount(previousTotalMinor, currency)}</Text>
            <Text size="lg" fw={600}>{formatMinorAmount(newTotalMinor, currency)}</Text>
          </Group>
        )}
        <Group gap="xs" wrap="wrap">
          <Button size="sm" onClick={onAccept} loading={busy}>Continue at new price</Button>
          <Button size="sm" variant="default" onClick={onBack} disabled={busy}>Back to tickets</Button>
        </Group>
      </Stack>
    </Alert>
  );
}
