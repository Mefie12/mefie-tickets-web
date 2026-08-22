"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Alert, Button, Group, Loader, Stack, Text, Title } from "@mantine/core";
import { IconAlertCircle } from "@tabler/icons-react";
import { notifications } from "@mantine/notifications";
import { ApiError } from "@/lib/authApi";
import { createPaymentIntent, getOrderPaymentStatus, type Order } from "@/lib/checkoutApi";
import type { PublicEvent } from "@/lib/publicEventApi";
import { formatMoney } from "@/lib/money";
import { TicketSelector, ticketLineKey } from "@/components/TicketSelector";
import { CheckoutDetailsForm } from "@/components/CheckoutDetailsForm";
import { CheckoutPaymentStep } from "@/components/CheckoutPaymentStep";
import { OrderConfirmation } from "@/components/OrderConfirmation";

type Step = "cart" | "details" | "payment" | "confirmation";

type PersistedCheckout = { order: Order; clientSecret: string };

function checkoutStorageKey(eventId: number): string {
  return `mefie-checkout:${eventId}`;
}

/**
 * Owns the whole checkout wizard's state — cart selection through
 * confirmation, all on one page (no separate /checkout route). Cart
 * quantities don't need to survive a reload (re-picking tickets is
 * cheap), but `order`/`clientSecret` do: once an order exists, it's a
 * real RESERVED (or already-paid) reservation server-side, so those two
 * are mirrored to sessionStorage and reconciled against the
 * authoritative order status on mount — a reload during the payment
 * step must resume it, not silently drop the customer back to the bare
 * cart while a real charge may already have gone through (confirmed
 * live: this used to happen).
 *
 * Once `order` is set, CheckoutDetailsForm is never re-rendered: the
 * order is already RESERVED server-side by then, and there's no
 * update-order endpoint — resubmitting the details form would create a
 * second reservation against the same inventory. A failed
 * payment-intent call retries against the *existing* order instead.
 */
export function Checkout({ event }: { event: PublicEvent }) {
  const [step, setStep] = useState<Step>("cart");
  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const [order, setOrder] = useState<Order | null>(null);
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const reconciling = useRef(false);

  // Mirror order/clientSecret to sessionStorage whenever both exist —
  // client_secret is explicitly safe to store/reuse client-side across
  // a reload (Stripe's own recommended pattern for exactly this case).
  useEffect(() => {
    if (!order || !clientSecret) return;
    sessionStorage.setItem(checkoutStorageKey(event.id), JSON.stringify({ order, clientSecret } satisfies PersistedCheckout));
  }, [order, clientSecret, event.id]);

  // On mount, don't blindly trust a persisted copy — it could be stale
  // (e.g. the webhook that completes the order arrived while this tab
  // was closed/reloaded, exactly as happened during live testing).
  // Reconcile against the authoritative status before resuming anywhere.
  useEffect(() => {
    if (reconciling.current) return;
    reconciling.current = true;

    const raw = sessionStorage.getItem(checkoutStorageKey(event.id));
    if (!raw) return;

    let persisted: PersistedCheckout;
    try {
      persisted = JSON.parse(raw) as PersistedCheckout;
    } catch {
      sessionStorage.removeItem(checkoutStorageKey(event.id));
      return;
    }

    getOrderPaymentStatus(event.id, persisted.order.short_id)
      .then((authoritative) => {
        if (authoritative.status === "COMPLETED") {
          sessionStorage.removeItem(checkoutStorageKey(event.id));
          setOrder({ ...persisted.order, status: "COMPLETED" });
          setStep("confirmation");
        } else if (authoritative.status === "RESERVED") {
          setOrder(persisted.order);
          setClientSecret(persisted.clientSecret);
          setStep("payment");
        } else {
          sessionStorage.removeItem(checkoutStorageKey(event.id));
        }
      })
      .catch(() => sessionStorage.removeItem(checkoutStorageKey(event.id)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [event.id]);

  const cartItems = useMemo(
    () =>
      event.products.flatMap((product) => {
        const lines = product.type === "TIERED" ? (product.options ?? []) : [null];
        return lines.flatMap((option) => {
          const quantity = quantities[ticketLineKey(product.id, option?.id ?? null)] ?? 0;
          return quantity > 0 ? [{ product_id: product.id, ticket_option_id: option?.id ?? null,
            product_title: option ? `${product.title} — ${option.name}` : product.title, quantity }] : [];
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

  const paymentIntentMutation = useMutation({
    mutationFn: (o: Order) => createPaymentIntent(event.id, o.short_id),
    onSuccess: (data: { client_secret: string; provider: "STRIPE"; provider_account_id: string }) => {
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
    return <OrderConfirmation eventId={event.id} order={order} />;
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
      return (
        <CheckoutPaymentStep
          eventId={event.id}
          order={order}
          clientSecret={clientSecret}
          defaultBillingCountry={event.location?.country}
          onPaid={() => {
            sessionStorage.removeItem(checkoutStorageKey(event.id));
            setStep("confirmation");
          }}
        />
      );
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
        totalDue={total}
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
        onQuantityChange={(productId, optionId, qty) => setQuantities((prev) => ({ ...prev, [ticketLineKey(productId, optionId)]: qty }))}
        currencyCode={event.currency_code}
      />

      <Group justify="space-between" pt="sm">
        <Text fw={600}>Total</Text>
        <Text fw={600}>{formatMoney(total, event.currency_code)}</Text>
      </Group>

      <Button size="md" fullWidth disabled={cartItems.length === 0} onClick={() => setStep("details")}>
        {cartItems.length === 0 ? "Select at least one ticket" : "Continue"}
      </Button>
    </Stack>
  );
}
