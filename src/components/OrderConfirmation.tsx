import { Badge, Box, Button, Card, Group, Stack, Text, Title } from "@mantine/core";
import { IconArrowLeft, IconCheck } from "@tabler/icons-react";
import type { Order } from "@/lib/checkoutApi";

// Not in the theme — a one-off Figma accent, same convention as the
// `#18794e` availability dot in EventTicketPanel.tsx.
const SUCCESS_BADGE_OUTER = "#d1fadf";
const SUCCESS_BADGE_INNER = "#34c759";

/**
 * Shown either immediately (a FREE order completes synchronously with
 * no payment step) or only after CheckoutPaymentStep verifies Mefie's
 * webhook-authoritative COMPLETED status. No dedicated URL: "Find My
 * Tickets" is out of MVP scope, so there's nothing durable to link to.
 *
 * Deliberately minimal — no order summary/cost breakdown/terms viewer
 * here. The buyer already has an itemized email receipt; this screen is
 * a celebratory confirmation moment, not a second receipt.
 */
export function OrderConfirmation({ eventTitle, order }: { eventTitle: string; order: Order }) {
  const ticketsTotal = order.items.reduce((sum, item) => sum + item.quantity, 0);

  return (
    <Stack gap="lg" align="center" ta="center">
      <Box
        w={{ base: 72, sm: 80 }}
        h={{ base: 72, sm: 80 }}
        style={{ borderRadius: 999, background: SUCCESS_BADGE_OUTER, display: "flex", alignItems: "center", justifyContent: "center" }}
      >
        <Box
          w={{ base: 48, sm: 56 }}
          h={{ base: 48, sm: 56 }}
          style={{ borderRadius: 999, background: SUCCESS_BADGE_INNER, display: "flex", alignItems: "center", justifyContent: "center" }}
        >
          <IconCheck size={28} color="white" stroke={3} />
        </Box>
      </Box>

      <Stack gap={4} maw={640}>
        <Title order={2} fz={{ base: 26, sm: 32 }}>
          Thank you for your purchase!
        </Title>
        <Text c="dimmed">
          Your order for <Text span fw={600}>{eventTitle}</Text> has been confirmed.
          We&apos;ve sent a confirmation email to {order.email}.
        </Text>
      </Stack>

      {order.unassigned_count > 0 && (
        <Card
          withBorder
          radius="lg"
          p="lg"
          w="100%"
          maw={480}
          style={{ background: "var(--mantine-color-grey-0)", borderColor: "var(--mantine-color-grey-2)" }}
        >
          <Stack gap="md" align="center">
            <Badge
              radius="xl"
              variant="light"
              styles={{
                root: { background: "#eff6ff", border: "1px solid #bfdbfe", color: "#1d4ed8", textTransform: "none" },
                label: { fontWeight: 500 },
              }}
            >
              {ticketsTotal} {ticketsTotal === 1 ? "Ticket" : "Tickets"} Secured
            </Badge>
            <Text size="sm" ta="center" c="var(--mantine-color-grey-6)">
              To assign attendees to each ticket, use the secure link we sent to your email or click the button
              below to update them directly.
            </Text>
            <Button component="a" href={`/tickets/orders/${order.short_id}`} size="md">
              Assign attendees
            </Button>
          </Stack>
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

      <Text component="a" href="/discover" size="sm" fw={500} style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
        <IconArrowLeft size={16} /> Return to events listing page
      </Text>
    </Stack>
  );
}
