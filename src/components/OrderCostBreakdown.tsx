import { Divider, Group, Stack, Text } from "@mantine/core";
import type { Order } from "@/lib/checkoutApi";
import { formatMinorAmount } from "@/lib/money";

/**
 * Buyer-facing cost breakdown. The platform fee and the card-processing
 * fee — whichever of them was passed to the buyer — are shown as a
 * single "Service fee"; a card-labelled surcharge is prohibited for
 * consumer cards in the UK/EEA. A fee the organizer absorbed never
 * appears here. Row order (Subtotal / Service fee / Tax / Total) matches
 * the emailed receipt so the two always reconcile.
 *
 * Accepts either a real Order (payment/confirmation screens) or the
 * pre-order figures computed by src/lib/fees.ts (ticket-selection and
 * details steps) — both normalise to the same four minor-unit numbers.
 */
type Amounts = {
  currency: string;
  /** Pre-discount subtotal when a discount applies, otherwise the subtotal. */
  subtotalMinor: number;
  serviceFeeMinor: number;
  taxMinor: number;
  totalMinor: number;
  /** Offers: shown as a "Discount" row between Subtotal and the fees. */
  discountMinor?: number;
  discountLabel?: string | null;
};

// Theme-aware savings colour (AA on both the light and dark card surfaces).
const SAVINGS_COLOR = "light-dark(#18794e, #5fd39a)";

function toMinor(amount: string | number): number {
  return Math.round(Number(amount) * 100);
}

function fromOrder(order: Order): Amounts {
  const serviceFeeMinor =
    (order.platform_fee_bearer === "ATTENDEE" ? toMinor(order.platform_fee) : 0) +
    (order.processing_fee_bearer === "ATTENDEE" ? toMinor(order.processing_fee) : 0);
  const taxMinor = order.tax_bearer === "ATTENDEE" ? toMinor(order.tax_amount) : 0;
  const discountMinor = order.discount_total_minor ?? 0;
  return {
    currency: order.currency,
    // order.subtotal is the post-discount subtotal; show the original above the discount row.
    subtotalMinor: toMinor(order.subtotal) + discountMinor,
    serviceFeeMinor,
    taxMinor,
    totalMinor: toMinor(order.total_amount),
    discountMinor,
    discountLabel: order.offer_name ?? null,
  };
}

export function OrderCostBreakdown(props: { order: Order } | { amounts: Amounts }) {
  const a = "order" in props ? fromOrder(props.order) : props.amounts;

  const rows: Array<{ label: string; minor: number }> = [];
  if (a.serviceFeeMinor > 0) rows.push({ label: "Service fee", minor: a.serviceFeeMinor });
  if (a.taxMinor > 0) rows.push({ label: "Tax", minor: a.taxMinor });

  return (
    <Stack gap="xs">
      <Group justify="space-between">
        <Text size="sm" c="dimmed">
          Subtotal
        </Text>
        <Text size="sm">{formatMinorAmount(a.subtotalMinor, a.currency)}</Text>
      </Group>

      {(a.discountMinor ?? 0) > 0 && (
        <Group justify="space-between" wrap="nowrap" gap="sm">
          <Text size="sm" c="dimmed" style={{ overflowWrap: "anywhere" }}>
            Discount{a.discountLabel ? ` (${a.discountLabel})` : ""}
          </Text>
          <Text size="sm" fw={500} c={SAVINGS_COLOR} style={{ whiteSpace: "nowrap" }}>
            −{formatMinorAmount(a.discountMinor ?? 0, a.currency)}
          </Text>
        </Group>
      )}

      {rows.map((row) => (
        <Group key={row.label} justify="space-between">
          <Text size="sm" c="dimmed">
            {row.label}
          </Text>
          <Text size="sm">{formatMinorAmount(row.minor, a.currency)}</Text>
        </Group>
      ))}

      <Divider />

      <Group justify="space-between">
        <Text fw={600}>Total</Text>
        <Text fw={600}>{formatMinorAmount(a.totalMinor, a.currency)}</Text>
      </Group>
    </Stack>
  );
}
