import { Badge, Group, Progress, Stack, Text, Title } from "@mantine/core";
import { IconChevronRight } from "@tabler/icons-react";
import { backendRequest } from "@/lib/backend";
import { formatEventDateRange } from "@/lib/eventDateTime";
import type { DashboardPayload, OrderCard } from "@/lib/portalApi";
import { LinkCard } from "@/components/LinkCard";

export const dynamic = "force-dynamic";

function assignedProgress(summary: OrderCard["entitlement_summary"]): { done: number; total: number } {
  const done = summary.issued + summary.checked_in + summary.pending_acceptance;
  return { done, total: summary.total };
}

export default async function PortalDashboard() {
  const result = await backendRequest<DashboardPayload>("/api/portal/dashboard");
  const orders = result.status === 200 ? result.data.orders : [];

  return (
    <Stack gap="lg" py="md">
      <Title order={1} fz={24}>
        Your orders
      </Title>

      {orders.length === 0 && (
        <Text c="dimmed" size="sm">
          Nothing to show yet. Open a ticket link from one of your confirmation emails to see it here.
        </Text>
      )}

      <Stack gap="sm">
        {orders.map((order) => {
          const { done, total } = assignedProgress(order.entitlement_summary);
          const pct = total > 0 ? (done / total) * 100 : 0;

          return (
            <LinkCard
              key={order.short_id}
              withBorder
              radius="lg"
              p="md"
              href={`/tickets/orders/${order.short_id}`}
              style={{ textDecoration: "none", color: "inherit" }}
            >
              <Group justify="space-between" wrap="nowrap" align="flex-start">
                <Stack gap={4} style={{ minWidth: 0 }}>
                  <Text fw={600} truncate>
                    {order.event.title ?? "Event"}
                  </Text>
                  <Text size="xs" c="dimmed">
                    {order.event.start_date
                      ? formatEventDateRange(order.event.start_date, null, order.event.timezone ?? "UTC")
                      : null}
                  </Text>
                  <Text size="xs" c="dimmed">
                    Order {order.short_id}
                  </Text>
                </Stack>
                <IconChevronRight size={18} style={{ flexShrink: 0, marginTop: 2 }} />
              </Group>

              {total > 0 && (
                <Stack gap={6} mt="sm">
                  <Group justify="space-between">
                    <Text size="xs" c="dimmed">
                      {done} of {total} tickets assigned
                    </Text>
                    {order.entitlement_summary.buyer_held > 0 && (
                      <Badge size="sm" variant="light" color="orange">
                        {order.entitlement_summary.buyer_held} to assign
                      </Badge>
                    )}
                  </Group>
                  <Progress value={pct} size="sm" radius="xl" />
                </Stack>
              )}
            </LinkCard>
          );
        })}
      </Stack>
    </Stack>
  );
}
