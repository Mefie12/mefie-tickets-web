"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Button, Group, Stack, Text } from "@mantine/core";
import { IconTicket } from "@tabler/icons-react";
import { cheapestPriceLabel, type PublicEvent } from "@/lib/publicEventApi";
import { computeBuyerCosts } from "@/lib/fees";
import { TicketSelector, ticketLineKey } from "@/components/TicketSelector";
import { OrderCostBreakdown } from "@/components/OrderCostBreakdown";
import { saveCart, type StoredCartItem } from "@/lib/cartStorage";

/**
 * Ticket selection only — the event page's sidebar card. Buyer
 * details, payment, and confirmation now live on the dedicated
 * `/checkout` route (see CheckoutPage.tsx); "Continue" hands the picked
 * quantities off via sessionStorage (a real navigation unmounts this
 * component, so they can't stay in React state) and pushes there.
 */
export function EventTicketPanel({ event, checkoutUrl }: { event: PublicEvent; checkoutUrl: string }) {
  const router = useRouter();
  const [quantities, setQuantities] = useState<Record<string, number>>({});

  const cartItems = useMemo(
    () =>
      event.products.flatMap((product) => {
        const lines = product.type === "TIERED" ? (product.options ?? []) : [null];
        return lines.flatMap((option) => {
          const quantity = quantities[ticketLineKey(product.id, option?.id ?? null)] ?? 0;
          return quantity > 0 ? [{ product_id: product.id, ticket_option_id: option?.id ?? null, quantity } satisfies StoredCartItem] : [];
        });
      }),
    [event.products, quantities],
  );

  const total = useMemo(() => {
    return event.products.reduce((sum, product) => {
      if (product.type !== "TIERED") return sum + Number(product.current_price ?? 0) * (quantities[ticketLineKey(product.id, null)] ?? 0);
      return sum + (product.options ?? []).reduce((optionTotal, option) =>
        optionTotal + Number(option.price) * (quantities[ticketLineKey(product.id, option.id)] ?? 0), 0);
    }, 0);
  }, [event.products, quantities]);

  // All-in figures shown up front (mandatory fees + tax included), so the
  // "Total" the buyer sees before Continue is the amount they'll actually
  // pay — matches the server order to the penny (frozen rates + identical
  // integer maths, see src/lib/fees.ts).
  const costs = useMemo(
    () => computeBuyerCosts(Math.round(total * 100), event.pricing),
    [total, event.pricing],
  );

  // "Available" whenever at least one line a buyer could actually pick
  // still has stock — mirrors the same is_on_sale/is_sold_out/option
  // availability rules TicketSelector uses per line, just rolled up to
  // one panel-level status.
  const anyAvailable = event.products.some((product) =>
    product.type === "TIERED"
      ? (product.options ?? []).some((option) => option.is_available)
      : product.is_on_sale && !product.is_sold_out,
  );
  const startingPrice = cheapestPriceLabel(event);

  return (
    <Stack gap="md">
      <Group justify="space-between" align="flex-end" wrap="nowrap">
        <Stack gap={4}>
          <Text size="sm" c="dimmed">
            Tickets from
          </Text>
          <Text fz={28} fw={600} style={{ lineHeight: 1 }}>
            {startingPrice ?? "—"}
          </Text>
        </Stack>
        <Group gap={8} wrap="nowrap">
          <div style={{ width: 8, height: 8, borderRadius: 999, background: anyAvailable ? "#18794e" : "var(--mantine-color-gray-6)" }} />
          <Text size="sm" c={anyAvailable ? "#18794e" : "dimmed"}>
            {anyAvailable ? "Tickets available" : "Sold out"}
          </Text>
        </Group>
      </Group>
      <TicketSelector
        products={event.products}
        quantities={quantities}
        onQuantityChange={(productId, optionId, qty) => setQuantities((prev) => ({ ...prev, [ticketLineKey(productId, optionId)]: qty }))}
        currencyCode={event.currency_code}
      />

      {cartItems.length > 0 && (
        <Stack gap="xs" pt="sm">
          <OrderCostBreakdown
            amounts={{
              currency: event.currency_code,
              subtotalMinor: costs.subtotalMinor,
              serviceFeeMinor: costs.serviceFeeMinor,
              taxMinor: costs.taxMinor,
              totalMinor: costs.totalMinor,
            }}
          />
        </Stack>
      )}

      <Button
        size="md"
        fullWidth
        disabled={cartItems.length === 0}
        onClick={() => {
          saveCart(event.id, cartItems);
          router.push(checkoutUrl);
        }}
      >
        {cartItems.length === 0 ? "Select at least one ticket" : "Continue"}
      </Button>

      <Group gap={8} wrap="nowrap" align="flex-start">
        <IconTicket size={16} style={{ flexShrink: 0, marginTop: 3 }} />
        <Text size="xs" c="dimmed">
          Secure checkout. Inventory is held for {event.reservation_hold_minutes} minutes while you pay.
        </Text>
      </Group>
    </Stack>
  );
}
