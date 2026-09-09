"use client";

import { ActionIcon, Badge, Card, Group, NumberInput, Stack, Text } from "@mantine/core";
import { IconMinus, IconPlus } from "@tabler/icons-react";
import type { PublicProduct, PublicTicketOption } from "@/lib/publicEventApi";
import { formatMoney } from "@/lib/money";

export const ticketLineKey = (productId: number, optionId: number | null) => `${productId}:${optionId ?? "direct"}`;

export function TicketSelector({ products, quantities, onQuantityChange, currencyCode }: {
  products: PublicProduct[];
  quantities: Record<string, number>;
  onQuantityChange: (productId: number, optionId: number | null, quantity: number) => void;
  currencyCode: string;
}) {
  if (products.length === 0) return <Text c="dimmed" size="sm">No tickets available for this event yet.</Text>;

  return <Stack gap="md">{products.map((product) => (
    <Card key={product.id} withBorder radius="lg" p="md">
      <Stack gap="sm">
        <Text fw={700}>{product.title}</Text>
        {product.type === "TIERED" ? product.options?.map((option) => (
          <TicketOptionRow key={option.id} product={product} option={option}
            quantity={quantities[ticketLineKey(product.id, option.id)] ?? 0}
            onChange={(quantity) => onQuantityChange(product.id, option.id, quantity)} currencyCode={currencyCode} />
        )) : (
          <TicketOptionRow product={product} option={null}
            quantity={quantities[ticketLineKey(product.id, null)] ?? 0}
            onChange={(quantity) => onQuantityChange(product.id, null, quantity)} currencyCode={currencyCode} />
        )}
      </Stack>
    </Card>
  ))}</Stack>;
}

/**
 * −  [n]  +  quantity control. Big square tap targets for the buttons, and
 * the middle is a real number field so a buyer after 20 or 30 tickets can
 * just type it instead of tapping + twenty times. Value is clamped to
 * 0–max (on blur, so mid-typing "2" -> "20" isn't fought) and rejects
 * decimals / negatives.
 */
function QuantityStepper({ value, onChange, max, disabled }: {
  value: number; onChange: (value: number) => void; max: number; disabled?: boolean;
}) {
  const clamp = (n: number) => Math.min(max, Math.max(0, Math.trunc(n)));
  return (
    <Group gap={4} wrap="nowrap" style={{ flex: "0 0 auto" }}>
      <ActionIcon
        variant="default" size="lg" radius="md" aria-label="Remove one"
        disabled={disabled || value <= 0}
        onClick={() => onChange(Math.max(0, value - 1))}
      >
        <IconMinus size={16} />
      </ActionIcon>
      <NumberInput
        aria-label="Quantity"
        value={value}
        onChange={(v) => onChange(clamp(typeof v === "number" && Number.isFinite(v) ? v : 0))}
        min={0}
        max={max}
        step={1}
        allowDecimal={false}
        allowNegative={false}
        hideControls
        clampBehavior="blur"
        disabled={disabled}
        size="sm"
        w={52}
        styles={{ input: { textAlign: "center", fontWeight: 600, paddingInline: 4, fontVariantNumeric: "tabular-nums" } }}
      />
      <ActionIcon
        variant="default" size="lg" radius="md" aria-label="Add one"
        disabled={disabled || value >= max}
        onClick={() => onChange(Math.min(max, value + 1))}
      >
        <IconPlus size={16} />
      </ActionIcon>
    </Group>
  );
}

function TicketOptionRow({ product, option, quantity, onChange, currencyCode }: {
  product: PublicProduct; option: PublicTicketOption | null; quantity: number;
  onChange: (quantity: number) => void; currencyCode: string;
}) {
  const status = option?.status ?? (product.is_sold_out ? "SOLD_OUT" : product.is_on_sale ? "AVAILABLE" : "PAUSED");
  const available = option ? option.is_available : product.is_on_sale && !product.is_sold_out;
  const remaining = option?.quantity_remaining ?? product.quantity_remaining;
  // Per-order cap: the organizer's max-per-registration (10 when unset),
  // further limited by what's actually left. No extra hardcoded ceiling —
  // an organizer allowing 50 per order should get 50.
  const limit = option?.max_attendees_per_registration ?? product.max_attendees_per_registration ?? 10;
  const price = option?.price ?? product.current_price;
  return <Group justify="space-between" align="center" gap="sm" wrap="nowrap">
    <Stack gap={2} style={{ flex: 1, minWidth: 0 }}>
      {option && <Text fw={600} size="sm" style={{ overflowWrap: "anywhere" }}>{option.name}</Text>}
      <Text size="sm" c="dimmed">
        {formatMoney(price, currencyCode)}
        {Number(price ?? 0) > 0 && " + fees"}
      </Text>
      {remaining !== null && <Text size="xs" c="dimmed">{remaining} remaining</Text>}
      {!available && <Badge color={status === "SOLD_OUT" ? "red" : "gray"} variant="light" size="sm">{status.replaceAll("_", " ")}</Badge>}
    </Stack>
    <QuantityStepper
      value={quantity}
      onChange={onChange}
      max={Math.min(limit, remaining ?? limit)}
      disabled={!available}
    />
  </Group>;
}
