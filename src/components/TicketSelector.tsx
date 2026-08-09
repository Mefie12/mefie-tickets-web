"use client";

import { Badge, Card, Group, NumberInput, Stack, Text } from "@mantine/core";
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

function TicketOptionRow({ product, option, quantity, onChange, currencyCode }: {
  product: PublicProduct; option: PublicTicketOption | null; quantity: number;
  onChange: (quantity: number) => void; currencyCode: string;
}) {
  const status = option?.status ?? (product.is_sold_out ? "SOLD_OUT" : product.is_on_sale ? "AVAILABLE" : "PAUSED");
  const available = option ? option.is_available : product.is_on_sale && !product.is_sold_out;
  const remaining = option?.quantity_remaining ?? product.quantity_remaining;
  const limit = option?.max_attendees_per_registration ?? product.max_attendees_per_registration ?? 10;
  return <Group justify="space-between" align="center" wrap="nowrap">
    <Stack gap={2} style={{ flex: 1 }}>
      {option && <Text fw={600} size="sm">{option.name}</Text>}
      <Text size="sm" c="dimmed">{formatMoney(option?.price ?? product.current_price, currencyCode)}</Text>
      {remaining !== null && <Text size="xs" c="dimmed">{remaining} remaining</Text>}
      {!available && <Badge color={status === "SOLD_OUT" ? "red" : "gray"} variant="light" size="sm">{status.replaceAll("_", " ")}</Badge>}
    </Stack>
    <NumberInput w={90} min={0} max={Math.min(10, limit, remaining ?? 10)} value={quantity}
      onChange={(value) => onChange(Number(value) || 0)} disabled={!available} />
  </Group>;
}
