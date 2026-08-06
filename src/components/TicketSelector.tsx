"use client";

import { Badge, Card, Group, NumberInput, Select, Stack, Text } from "@mantine/core";
import type { PublicProduct } from "@/lib/publicEventApi";

function formatPrice(price: string | null): string {
  if (price === null) return "Free";
  const amount = Number(price);
  return amount === 0 ? "Free" : `$${amount.toFixed(2)}`;
}

/**
 * Controlled — cart state lives in the parent Checkout wizard (needed
 * once "continue to details" has to read it), not locally. Renders
 * just the per-product rows; the running total and continue button are
 * the wizard's job.
 */
export function TicketSelector({
  products,
  quantities,
  onQuantityChange,
  selectedTierId,
  onTierChange,
}: {
  products: PublicProduct[];
  quantities: Record<number, number>;
  onQuantityChange: (productId: number, quantity: number) => void;
  selectedTierId: Record<number, number | null>;
  onTierChange: (productId: number, tierId: number | null) => void;
}) {
  if (products.length === 0) {
    return (
      <Text c="dimmed" size="sm">
        No tickets available for this event yet.
      </Text>
    );
  }

  return (
    <Stack gap="md">
      {products.map((product) => (
        <ProductRow
          key={product.id}
          product={product}
          quantity={quantities[product.id] ?? 0}
          onQuantityChange={(qty) => onQuantityChange(product.id, qty)}
          selectedTierId={selectedTierId[product.id] ?? product.active_tier_id ?? null}
          onTierChange={(tierId) => onTierChange(product.id, tierId)}
        />
      ))}
    </Stack>
  );
}

function ProductRow({
  product,
  quantity,
  onQuantityChange,
  selectedTierId,
  onTierChange,
}: {
  product: PublicProduct;
  quantity: number;
  onQuantityChange: (qty: number) => void;
  selectedTierId: number | null;
  onTierChange: (tierId: number | null) => void;
}) {
  const soldOut = product.is_sold_out || (product.type === "TIERED" && product.active_tier_id == null);
  const activeTier = product.tiers?.find((t) => t.id === selectedTierId);
  const displayPrice = product.type === "TIERED" ? (activeTier?.price ?? null) : product.current_price;

  return (
    <Card withBorder radius="lg" p="md">
      <Group justify="space-between" align="flex-start" wrap="nowrap">
        <Stack gap={4} style={{ flex: 1 }}>
          <Group gap="xs">
            <Text fw={600}>{product.title}</Text>
            {soldOut && (
              <Badge color="red" variant="light" size="sm">
                Sold out
              </Badge>
            )}
          </Group>

          {product.type === "TIERED" && product.tiers && product.tiers.length > 0 && (
            <Select
              size="xs"
              maw={220}
              data={product.tiers.map((tier) => ({
                value: String(tier.id),
                label: `${tier.name} — ${formatPrice(tier.price)}${tier.is_available ? "" : " (unavailable)"}`,
                disabled: !tier.is_available,
              }))}
              value={selectedTierId !== null ? String(selectedTierId) : null}
              onChange={(value) => onTierChange(value ? Number(value) : null)}
              placeholder="Select a tier"
            />
          )}

          {product.type !== "TIERED" && (
            <Text size="sm" c="dimmed">
              {formatPrice(displayPrice)}
            </Text>
          )}

          {product.quantity_remaining !== null && !soldOut && (
            <Text size="xs" c="dimmed">
              {product.quantity_remaining} remaining
            </Text>
          )}
        </Stack>

        <NumberInput
          w={90}
          min={0}
          max={10}
          value={quantity}
          onChange={(value) => onQuantityChange(Number(value) || 0)}
          disabled={soldOut}
        />
      </Group>
    </Card>
  );
}
