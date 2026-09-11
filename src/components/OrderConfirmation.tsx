"use client";

import { useState } from "react";
import { Alert, Badge, Box, Card, Group, Modal, Stack, Text, ThemeIcon, Title } from "@mantine/core";
import { IconCircleCheck, IconTicket } from "@tabler/icons-react";
import type { Order } from "@/lib/checkoutApi";
import { OrderCostBreakdown } from "@/components/OrderCostBreakdown";
import { OrderSummaryCard } from "@/components/OrderSummaryCard";

/**
 * Shown either immediately (a FREE order completes synchronously with
 * no payment step) or only after CheckoutPaymentStep verifies Mefie's
 * webhook-authoritative COMPLETED status. No dedicated URL: "Find My
 * Tickets" is out of MVP scope, so there's nothing durable to link to.
 */
export function OrderConfirmation({ eventId, order }: { eventId: number; order: Order }) {
  const [viewingTerms, setViewingTerms] = useState(false);
  const ticketsTotal = order.items.reduce((sum, item) => sum + item.quantity, 0);

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

      {order.unassigned_count > 0 && (
        <Alert
          icon={<IconTicket size={18} />}
          color="brand"
          variant="light"
          radius="lg"
          w="100%"
          maw={480}
          ta="left"
          title={`${order.unassigned_count} of ${ticketsTotal} ${ticketsTotal === 1 ? "ticket" : "tickets"} still to assign`}
        >
          <Text size="sm">
            We&apos;ve emailed <Text span fw={600}>{order.email}</Text> a secure link to assign the rest — open it
            anytime to add each attendee, send an invite, or take a ticket yourself.
          </Text>
        </Alert>
      )}

      <Box w="100%" maw={480} ta="left">
        <OrderSummaryCard order={order} />
      </Box>

      <Card withBorder radius="lg" p="lg" w="100%" maw={480} ta="left">
        <OrderCostBreakdown order={order} />
      </Card>

      {order.terms_acceptance && (
        <Card withBorder radius="lg" p="lg" w="100%" maw={480} ta="left">
          <Group justify="space-between" align="center">
            <Text size="sm">
              Terms &amp; Conditions accepted (v{order.terms_acceptance.version_number})
            </Text>
            {order.terms_acceptance.content_type === "PDF" ? (
              <Text
                size="sm"
                component="a"
                href={`/api/public/events/${eventId}/terms/pdf`}
                target="_blank"
                rel="noopener noreferrer"
              >
                View
              </Text>
            ) : (
              <Text size="sm" component="button" type="button" onClick={() => setViewingTerms(true)} style={{ cursor: "pointer" }}>
                View
              </Text>
            )}
          </Group>
        </Card>
      )}

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
                  {attendee.ticket_display_name}
                </Badge>
              </Group>
            ))}
          </Stack>
        </Card>
      )}

      <Modal opened={viewingTerms} onClose={() => setViewingTerms(false)} title="Terms & Conditions" size="lg">
        <Box dangerouslySetInnerHTML={{ __html: order.terms_acceptance?.rich_text_content ?? "" }} />
      </Modal>
    </Stack>
  );
}
