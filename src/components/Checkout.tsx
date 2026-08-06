"use client";

import { useMemo, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Alert, Button, Group, Loader, Stack, Text, Title } from "@mantine/core";
import { IconAlertCircle } from "@tabler/icons-react";
import { notifications } from "@mantine/notifications";
import { ApiError } from "@/lib/authApi";
import { createPaymentIntent, type Order } from "@/lib/checkoutApi";
import type { PublicEvent } from "@/lib/publicEventApi";
import { TicketSelector } from "@/components/TicketSelector";
import { CheckoutDetailsForm } from "@/components/CheckoutDetailsForm";
import { CheckoutPaymentStep } from "@/components/CheckoutPaymentStep";
import { OrderConfirmation } from "@/components/OrderConfirmation";

type Step = "cart" | "details" | "payment" | "confirmation";

function formatPrice(price: string | null): string {
  if (price === null) return "Free";
  const amount = Number(price);
  return amount === 0 ? "Free" : `$${amount.toFixed(2)}`;
}

/**
 * Owns the whole checkout wizard's state — cart selection through
 * confirmation, all on one page (no separate /checkout route). Cart
 * data doesn't need to survive a route change since nothing else on
 * this page needs it, so keeping it in one component avoids inventing
 * a cart-passing mechanism between routes for no benefit.
 *
 * Once `order` is set, CheckoutDetailsForm is never re-rendered: the
 * order is already RESERVED server-side by then, and there's no
 * update-order endpoint — resubmitting the details form would create a
 * second reservation against the same inventory. A failed
 * payment-intent call retries against the *existing* order instead.
 */
export function Checkout({ event }: { event: PublicEvent }) {
  const [step, setStep] = useState<Step>("cart");
  const [quantities, setQuantities] = useState<Record<number, number>>({});
  const [selectedTierId, setSelectedTierId] = useState<Record<number, number | null>>({});
  const [order, setOrder] = useState<Order | null>(null);
  const [clientSecret, setClientSecret] = useState<string | null>(null);

  const cartItems = useMemo(
    () =>
      event.products
        .filter((p) => (quantities[p.id] ?? 0) > 0)
        .map((p) => ({ product_id: p.id, product_title: p.title, quantity: quantities[p.id] })),
    [event.products, quantities],
  );

  const total = useMemo(() => {
    return event.products.reduce((sum, product) => {
      const qty = quantities[product.id] ?? 0;
      if (qty === 0) return sum;
      const price =
        product.type === "TIERED"
          ? product.tiers?.find((t) => t.id === (selectedTierId[product.id] ?? product.active_tier_id))?.price
          : product.current_price;
      return sum + (price ? Number(price) * qty : 0);
    }, 0);
  }, [event.products, quantities, selectedTierId]);

  const paymentIntentMutation = useMutation({
    mutationFn: (o: Order) => createPaymentIntent(event.id, o.short_id),
    onSuccess: (data: { client_secret: string }) => {
      setClientSecret(data.client_secret);
      setStep("payment");
    },
    onError: (error: Error) =>
      notifications.show({
        color: "red",
        message: error instanceof ApiError ? error.message : "Could not start payment. Please try again.",
      }),
  });

  function handleOrderCreated(newOrder: Order) {
    setOrder(newOrder);
    if (newOrder.status === "COMPLETED") {
      setStep("confirmation");
    } else {
      setStep("payment");
      paymentIntentMutation.mutate(newOrder);
    }
  }

  if (step === "confirmation" && order) {
    return <OrderConfirmation order={order} />;
  }

  if (step === "payment" && order) {
    if (paymentIntentMutation.isPending) {
      return (
        <Stack align="center" py="xl" gap="xs">
          <Loader />
          <Text c="dimmed" size="sm">
            Preparing payment…
          </Text>
        </Stack>
      );
    }

    if (clientSecret) {
      return <CheckoutPaymentStep order={order} clientSecret={clientSecret} onPaid={() => setStep("confirmation")} />;
    }

    // Reservation was created but the payment-intent call failed —
    // retry against the same order rather than re-collecting details.
    return (
      <Stack align="center" py="xl" gap="md">
        <Alert color="red" icon={<IconAlertCircle size={18} />} title="Couldn't start payment">
          Your tickets are still reserved (order {order.short_id}). Try again below.
        </Alert>
        <Button onClick={() => paymentIntentMutation.mutate(order)}>Retry</Button>
      </Stack>
    );
  }

  if (step === "details") {
    return (
      <CheckoutDetailsForm
        event={event}
        cartItems={cartItems}
        onOrderCreated={handleOrderCreated}
        onBack={() => setStep("cart")}
      />
    );
  }

  return (
    <Stack gap="md">
      <Title order={2} fz={22}>
        Tickets
      </Title>
      <TicketSelector
        products={event.products}
        quantities={quantities}
        onQuantityChange={(productId, qty) => setQuantities((prev) => ({ ...prev, [productId]: qty }))}
        selectedTierId={selectedTierId}
        onTierChange={(productId, tierId) => setSelectedTierId((prev) => ({ ...prev, [productId]: tierId }))}
      />

      <Group justify="space-between" pt="sm">
        <Text fw={600}>Total</Text>
        <Text fw={600}>{formatPrice(total === 0 ? "0" : String(total))}</Text>
      </Group>

      <Button size="md" fullWidth disabled={cartItems.length === 0} onClick={() => setStep("details")}>
        {cartItems.length === 0 ? "Select at least one ticket" : "Continue"}
      </Button>
    </Stack>
  );
}
