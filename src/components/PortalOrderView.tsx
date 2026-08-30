"use client";

import { useQuery } from "@tanstack/react-query";
import { Anchor, Badge, Card, Group, Stack, Text, Title } from "@mantine/core";
import { IconArrowLeft, IconLink } from "@tabler/icons-react";
import Link from "next/link";
import { getOrder, type OrderDetailPayload } from "@/lib/portalApi";
import { assignmentStatusMeta, ticketLabel } from "@/lib/portalStatus";
import { formatEventDateRange } from "@/lib/eventDateTime";

/**
 * The consumer order-detail surface: one row per purchased admission
 * unit with its live status. Row actions (assign, reassign, claim
 * links, delivery fixes, refund requests) are layered in by later FE
 * work packages — this is the read shell they hang off, backed by a
 * TanStack query the mutations invalidate.
 */
export function PortalOrderView({
  shortId,
  initialData,
}: {
  shortId: string;
  initialData: OrderDetailPayload;
}) {
  const { data } = useQuery({
    queryKey: ["portal-order", shortId],
    queryFn: () => getOrder(shortId),
    initialData,
  });

  const { order, entitlements } = data;

  return (
    <Stack gap="lg" py="md">
      <Anchor component={Link} href="/tickets" size="sm">
        <Group gap={4}>
          <IconArrowLeft size={14} /> All orders
        </Group>
      </Anchor>

      <Stack gap={4}>
        <Title order={1} fz={22}>
          {order.event.title ?? "Event"}
        </Title>
        <Text size="sm" c="dimmed">
          {order.event.start_date
            ? formatEventDateRange(order.event.start_date, null, order.event.timezone ?? "UTC")
            : null}
        </Text>
        <Text size="xs" c="dimmed">
          Order {order.short_id} · {order.status}
        </Text>
      </Stack>

      <Stack gap="sm">
        {entitlements.map((e) => {
          const meta = assignmentStatusMeta(e.assignment_status);
          return (
            <Card key={e.public_id} withBorder radius="lg" p="md">
              <Group justify="space-between" wrap="nowrap" align="flex-start">
                <Stack gap={4} style={{ minWidth: 0 }}>
                  <Text fw={600} size="sm" truncate>
                    {ticketLabel(e.ticket)} <Text span c="dimmed" fw={400}>#{e.sequence_number}</Text>
                  </Text>
                  <Text size="sm">
                    {e.attendee ? `${e.attendee.first_name} ${e.attendee.last_name}` : "No attendee yet"}
                  </Text>
                  {e.claim_link && (
                    <Group gap={4} c="dimmed">
                      <IconLink size={13} />
                      <Text size="xs">
                        Invite link active{e.claim_link.delivery_locked ? " · delivery locked" : ""}
                      </Text>
                    </Group>
                  )}
                  {e.delivery?.workflow_status === "FAILED" && (
                    <Text size="xs" c="red">
                      Ticket delivery failed
                    </Text>
                  )}
                  {e.reacceptance_required && (
                    <Text size="xs" c="orange">
                      Updated terms need confirming
                    </Text>
                  )}
                </Stack>
                <Badge color={meta.color} variant="light" style={{ flexShrink: 0 }}>
                  {meta.label}
                </Badge>
              </Group>
            </Card>
          );
        })}
      </Stack>
    </Stack>
  );
}
