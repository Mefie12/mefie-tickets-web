"use client";

import { Badge, Card, Divider, Group, Stack, Text, ThemeIcon, Title } from "@mantine/core";
import { IconCircleCheck } from "@tabler/icons-react";
import type { Order } from "@/lib/checkoutApi";

/**
 * Shown either immediately (a FREE order completes synchronously with
 * no payment step) or right after CheckoutPaymentStep's confirmPayment()
 * resolves "succeeded". Trusts that client-side signal rather than
 * re-polling the backend for the webhook-driven COMPLETED status — in
 * practice webhook delivery is near-instant, and there's no public
 * order-status endpoint to poll against yet. No dedicated URL: "Find My
 * Tickets" is out of MVP scope, so there's nothing durable to link to.
 */
export function OrderConfirmation({ order }: { order: Order }) {
  return (
    <Stack gap="lg" align="center" ta="center">
      <ThemeIcon size={64} radius="xl" color="teal" variant="light">
        <IconCircleCheck size={36} />
      </ThemeIcon>

      <Stack gap={4}>
        <Title order={2} fz={26}>
          You&apos;re all set!
        </Title>
        <Text c="dimmed">
          Order <Text span fw={600}>{order.short_id}</Text> confirmed. A confirmation was sent to {order.email}.
        </Text>
      </Stack>

      <Card withBorder radius="lg" p="lg" w="100%" maw={480} ta="left">
        <Stack gap="sm">
          {order.items.map((item, index) => (
            <Group key={index} justify="space-between">
              <Stack gap={0}>
                <Text size="sm" fw={500}>
                  {item.product_title}
                  {item.tier_name ? ` — ${item.tier_name}` : ""}
                </Text>
                <Text size="xs" c="dimmed">
                  Qty {item.quantity}
                </Text>
              </Stack>
              <Text size="sm">{Number(item.item_total) === 0 ? "Free" : `${order.currency} ${item.item_total}`}</Text>
            </Group>
          ))}

          <Divider />

          <Group justify="space-between">
            <Text fw={600}>Total paid</Text>
            <Text fw={600}>{Number(order.total_amount) === 0 ? "Free" : `${order.currency} ${order.total_amount}`}</Text>
          </Group>
        </Stack>
      </Card>

      {order.attendees.length > 0 && (
        <Card withBorder radius="lg" p="lg" w="100%" maw={480} ta="left">
          <Stack gap="xs">
            <Text size="sm" fw={600}>
              Attendees
            </Text>
            {order.attendees.map((attendee) => (
              <Group key={attendee.short_id} justify="space-between">
                <Text size="sm">
                  {attendee.first_name} {attendee.last_name}
                </Text>
                <Badge variant="light" size="sm">
                  {attendee.product_title}
                </Badge>
              </Group>
            ))}
          </Stack>
        </Card>
      )}
    </Stack>
  );
}
