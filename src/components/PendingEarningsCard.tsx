"use client";

import { useQuery } from "@tanstack/react-query";
import { Badge, Card, Divider, Group, Stack, Text, Title } from "@mantine/core";
import { listOrganizerTransfers, type PendingEarnings } from "@/lib/paymentAccountApi";
import { formatMinorAmount } from "@/lib/money";

const STATUS_COLOR: Record<string, string> = {
  PENDING: "gray",
  PROCESSING: "blue",
  SUCCEEDED: "teal",
  FAILED: "red",
};

/**
 * Held-funds policy: sale proceeds sit with the platform and are
 * released to the organizer's connected account by an admin, not
 * automatically — see OrganizerTransferBatchService on the API. This
 * card is the organizer-facing view of that held balance and release
 * history.
 */
export function PendingEarningsCard({ earnings, currency }: { earnings: PendingEarnings; currency: string }) {
  const transfers = useQuery({ queryKey: ["organizer-transfers"], queryFn: listOrganizerTransfers });

  return (
    <Card withBorder radius="lg" p="xl">
      <Stack gap="md">
        <Title order={3} fz={20}>
          Earnings
        </Title>

        <Group grow>
          <Stack gap={0}>
            <Text size="xs" c="dimmed">
              Held
            </Text>
            <Text fw={600}>{formatMinorAmount(earnings.held_minor, currency)}</Text>
          </Stack>
          <Stack gap={0}>
            <Text size="xs" c="dimmed">
              Ready to release
            </Text>
            <Text fw={600} c="brand">
              {formatMinorAmount(earnings.release_eligible_minor, currency)}
            </Text>
          </Stack>
          <Stack gap={0}>
            <Text size="xs" c="dimmed">
              Paid out
            </Text>
            <Text fw={600}>{formatMinorAmount(earnings.transferred_minor, currency)}</Text>
          </Stack>
        </Group>

        <Text size="xs" c="dimmed">
          Ticket sale proceeds are held for a short period after your event ends, then released to your bank via
          your connected account — this protects attendees if an event doesn&apos;t go ahead as planned.
        </Text>

        {transfers.data && transfers.data.length > 0 && (
          <>
            <Divider label="Payout history" labelPosition="left" />
            <Stack gap="xs">
              {transfers.data.map((transfer) => (
                <Group key={transfer.id} justify="space-between" align="flex-start">
                  <Text size="sm">{formatMinorAmount(transfer.amount_minor, transfer.currency)}</Text>
                  <Stack gap={0} align="flex-end">
                    <Badge variant="light" size="sm" color={STATUS_COLOR[transfer.status] ?? "gray"}>
                      {transfer.status}
                    </Badge>
                    <Text size="xs" c="dimmed">
                      {new Date(transfer.requested_at).toLocaleDateString()}
                    </Text>
                  </Stack>
                </Group>
              ))}
            </Stack>
          </>
        )}
      </Stack>
    </Card>
  );
}
