import { notFound } from "next/navigation";
import { Badge, Card, Group, Stack, Text, Title } from "@mantine/core";
import { IconReceipt } from "@tabler/icons-react";
import { backendRequest } from "@/lib/backend";
import { formatEventDate } from "@/lib/eventDateTime";
import { formatAmount } from "@/lib/money";
import type { OrderListResponse, OrderStatus } from "@/lib/orderApi";
import type { Event } from "@/lib/eventApi";
import { OrdersPagination } from "@/components/OrdersPagination";
import { LinkCard } from "@/components/LinkCard";

const STATUS_COLOR: Record<OrderStatus, string> = {
  RESERVED: "yellow",
  COMPLETED: "teal",
  CANCELLED: "red",
  AWAITING_OFFLINE_PAYMENT: "gray",
  ABANDONED: "dark",
};

export default async function EventOrdersPage({
  params,
  searchParams,
}: {
  params: Promise<{ eventId: string }>;
  searchParams: Promise<{ page?: string }>;
}) {
  const { eventId } = await params;
  const { page } = await searchParams;
  const currentPage = Number(page ?? 1);

  const [eventResult, ordersResult] = await Promise.all([
    backendRequest<{ event: Event }>(`/api/events/${eventId}`),
    backendRequest<OrderListResponse>(`/api/events/${eventId}/orders?page=${currentPage}`),
  ]);

  if (eventResult.status !== 200) {
    notFound();
  }

  const event = eventResult.data.event;
  const orders = ordersResult.status === 200 ? ordersResult.data.orders : [];
  const meta = ordersResult.status === 200 ? ordersResult.data.meta : null;

  return (
    <Stack gap="xl" maw={720}>
      <Stack gap={0}>
        <Text size="sm" c="dimmed">
          {event.title}
        </Text>
        <Title order={2} fz={28}>
          Orders
        </Title>
      </Stack>

      {orders.length === 0 ? (
        <Card withBorder radius="lg" p="xl">
          <Stack align="center" gap="xs" py="lg">
            <IconReceipt size={32} opacity={0.5} />
            <Text c="dimmed" ta="center">
              No orders yet.
            </Text>
          </Stack>
        </Card>
      ) : (
        <Stack gap="sm">
          {orders.map((order) => (
            <LinkCard
              key={order.id}
              href={`/events/${eventId}/orders/${order.id}`}
              withBorder
              radius="lg"
              p="md"
              style={{ textDecoration: "none" }}
            >
              <Group justify="space-between">
                <Stack gap={0}>
                  <Text fw={600} c="var(--mantine-color-text)">
                    {order.short_id} — {order.first_name} {order.last_name}
                  </Text>
                  <Text size="sm" c="dimmed">
                    {order.attendees_count} attendee{order.attendees_count === 1 ? "" : "s"} ·{" "}
                    {formatEventDate(order.created_at, event.timezone)}
                  </Text>
                </Stack>
                <Stack gap={4} align="flex-end">
                  <Badge color={STATUS_COLOR[order.status]} variant="light">
                    {order.status}
                  </Badge>
                  <Text size="sm">{formatAmount(order.total_amount, order.currency)}</Text>
                </Stack>
              </Group>
            </LinkCard>
          ))}
        </Stack>
      )}

      {meta && meta.last_page > 1 && (
        <OrdersPagination
          basePath={`/events/${eventId}/orders`}
          currentPage={meta.current_page}
          totalPages={meta.last_page}
        />
      )}
    </Stack>
  );
}
