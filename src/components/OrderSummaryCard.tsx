import { Divider, Group, Stack, Text } from "@mantine/core";
import type { Order } from "@/lib/checkoutApi";
import { formatMinorAmount } from "@/lib/money";

export type OrderSummaryLine = { label: string; quantity: number; totalMinor: number };

function linesFromOrder(order: Order): OrderSummaryLine[] {
  return order.items.map((item) => ({
    label: item.ticket_display_name,
    quantity: item.quantity,
    totalMinor: Math.round(Number(item.item_total) * 100),
  }));
}

/**
 * Per-ticket-type line items ("VIP × 2  ₦165,000") plus their own
 * total — what the buyer is actually purchasing. Deliberately distinct
 * from OrderCostBreakdown, which shows how the final charge is made up
 * (subtotal/fees/tax) — this card answers "what did I buy", that one
 * answers "how is the price made up"; the two are meant to sit
 * together in the details/payment/confirmation steps.
 *
 * Accepts either a real Order (payment/confirmation, post-checkout) or
 * pre-order `lines` computed from the cart (details step) — same dual
 * shape as OrderCostBreakdown.
 */
export function OrderSummaryCard(props: { order: Order } | { lines: OrderSummaryLine[]; currency: string }) {
  const lines = "order" in props ? linesFromOrder(props.order) : props.lines;
  const currency = "order" in props ? props.order.currency : props.currency;
  const totalMinor = lines.reduce((sum, line) => sum + line.totalMinor, 0);

  // This card's background is deliberately light regardless of the
  // site's own color scheme (matches the Figma design, which is
  // light-only) — so every Text below sets an explicit dark color
  // rather than relying on Mantine's theme-default text color, which
  // resolves to a *light* grey in dark mode and would be nearly
  // invisible against this card's light background.
  const textColor = "var(--mantine-color-grey-9)";
  const mutedColor = "var(--mantine-color-grey-6)";

  return (
    <Stack
      gap="md"
      p="md"
      style={{
        background: "var(--mantine-color-grey-0)",
        border: "1px solid var(--mantine-color-grey-2)",
        borderRadius: "var(--mantine-radius-lg)",
      }}
    >
      <Text fw={500} c={textColor}>
        Order summary
      </Text>
      <Stack gap={10}>
        {lines.map((line, index) => (
          <Group key={index} justify="space-between" wrap="nowrap" align="flex-start" gap="sm">
            <Text size="sm" c={mutedColor}>
              {line.label} × {line.quantity}
            </Text>
            <Text size="sm" fw={500} c={textColor} style={{ whiteSpace: "nowrap" }}>
              {formatMinorAmount(line.totalMinor, currency)}
            </Text>
          </Group>
        ))}
      </Stack>
      <Divider color="var(--mantine-color-grey-2)" />
      <Group justify="space-between">
        <Text fw={500} c={textColor}>
          Total
        </Text>
        <Text fw={500} fz="lg" c={textColor}>
          {formatMinorAmount(totalMinor, currency)}
        </Text>
      </Group>
    </Stack>
  );
}
