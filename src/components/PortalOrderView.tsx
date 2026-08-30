"use client";

import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Anchor, Badge, Button, Card, Checkbox, Group, Paper, Stack, Text, Title } from "@mantine/core";
import { IconArrowLeft, IconLink } from "@tabler/icons-react";
import Link from "next/link";
import { getOrder, type EntitlementRow, type OrderDetailPayload } from "@/lib/portalApi";
import { assignmentStatusMeta, ticketLabel } from "@/lib/portalStatus";
import { formatEventDateRange } from "@/lib/eventDateTime";
import { AssignEntitlementModal } from "@/components/AssignEntitlementModal";
import { BulkAssignModal } from "@/components/BulkAssignModal";

/**
 * Consumer order-detail: one row per purchased admission unit with its
 * live status and the actions valid for that state. Backed by a TanStack
 * query every mutation invalidates. Assign is FE-WP3; claim links,
 * revoke/reassign, delivery fixes, refund requests and the re-acceptance
 * prompt are layered on by later work packages.
 */
export function PortalOrderView({ shortId, initialData }: { shortId: string; initialData: OrderDetailPayload }) {
  const qc = useQueryClient();
  const { data } = useQuery({
    queryKey: ["portal-order", shortId],
    queryFn: () => getOrder(shortId),
    initialData,
  });

  const { order, entitlements } = data;
  const invalidate = () => qc.invalidateQueries({ queryKey: ["portal-order", shortId] });

  const [assignTarget, setAssignTarget] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkOpen, setBulkOpen] = useState(false);

  const assignable = useMemo(
    () => entitlements.filter((e) => e.assignment_status === "BUYER_HELD" && !e.claim_link),
    [entitlements],
  );
  const selectedRows = entitlements.filter((e) => selected.has(e.public_id));

  const toggle = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  return (
    <Stack gap="lg" py="md" pb={80}>
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

      {assignable.length > 1 && (
        <Group gap="xs">
          <Checkbox
            size="sm"
            label={`Select all ${assignable.length} unassigned`}
            checked={selected.size === assignable.length && assignable.length > 0}
            indeterminate={selected.size > 0 && selected.size < assignable.length}
            onChange={(e) =>
              setSelected(e.currentTarget.checked ? new Set(assignable.map((a) => a.public_id)) : new Set())
            }
          />
        </Group>
      )}

      <Stack gap="sm">
        {entitlements.map((e) => (
          <EntitlementCard
            key={e.public_id}
            e={e}
            selectable={assignable.some((a) => a.public_id === e.public_id)}
            selected={selected.has(e.public_id)}
            onToggle={() => toggle(e.public_id)}
            onAssign={() => setAssignTarget(e.public_id)}
          />
        ))}
      </Stack>

      {selected.size > 0 && (
        <Paper
          withBorder
          shadow="md"
          radius="lg"
          p="sm"
          pos="fixed"
          bottom={16}
          left="50%"
          style={{ transform: "translateX(-50%)", zIndex: 200, maxWidth: "min(560px, 92vw)", width: "100%" }}
        >
          <Group justify="space-between" wrap="nowrap">
            <Text size="sm" fw={500}>
              {selected.size} selected
            </Text>
            <Group gap="xs">
              <Button size="xs" variant="subtle" onClick={() => setSelected(new Set())}>
                Clear
              </Button>
              <Button size="xs" onClick={() => setBulkOpen(true)}>
                Assign {selected.size}
              </Button>
            </Group>
          </Group>
        </Paper>
      )}

      <AssignEntitlementModal
        entitlementPublicId={assignTarget}
        opened={assignTarget !== null}
        onClose={() => setAssignTarget(null)}
        onDone={() => {
          setAssignTarget(null);
          invalidate();
        }}
      />

      <BulkAssignModal
        entitlements={selectedRows}
        opened={bulkOpen}
        onClose={() => setBulkOpen(false)}
        onDone={() => {
          setBulkOpen(false);
          setSelected(new Set());
          invalidate();
        }}
      />
    </Stack>
  );
}

function EntitlementCard({
  e,
  selectable,
  selected,
  onToggle,
  onAssign,
}: {
  e: EntitlementRow;
  selectable: boolean;
  selected: boolean;
  onToggle: () => void;
  onAssign: () => void;
}) {
  const meta = assignmentStatusMeta(e.assignment_status);

  return (
    <Card withBorder radius="lg" p="md">
      <Group justify="space-between" wrap="nowrap" align="flex-start">
        <Group gap="sm" wrap="nowrap" align="flex-start" style={{ minWidth: 0 }}>
          {selectable && <Checkbox checked={selected} onChange={onToggle} mt={2} aria-label="Select ticket" />}
          <Stack gap={4} style={{ minWidth: 0 }}>
            <Text fw={600} size="sm" truncate>
              {ticketLabel(e.ticket)}{" "}
              <Text span c="dimmed" fw={400}>
                #{e.sequence_number}
              </Text>
            </Text>
            <Text size="sm">
              {e.attendee ? `${e.attendee.first_name} ${e.attendee.last_name}` : "No attendee yet"}
            </Text>
            {e.claim_link && (
              <Group gap={4} c="dimmed">
                <IconLink size={13} />
                <Text size="xs">Invite link active{e.claim_link.delivery_locked ? " · delivery locked" : ""}</Text>
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
        </Group>
        <Stack gap="xs" align="flex-end" style={{ flexShrink: 0 }}>
          <Badge color={meta.color} variant="light">
            {meta.label}
          </Badge>
          {e.assignment_status === "BUYER_HELD" && !e.claim_link && (
            <Button size="xs" variant="light" onClick={onAssign}>
              Assign
            </Button>
          )}
        </Stack>
      </Group>
    </Card>
  );
}
