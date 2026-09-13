"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation } from "@tanstack/react-query";
import { Alert, Box, Button, Grid, GridCol, Loader, Paper, Stack, Text, Title } from "@mantine/core";
import { IconAlertCircle, IconArrowLeft } from "@tabler/icons-react";
import { notifications } from "@mantine/notifications";
import { ApiError } from "@/lib/authApi";
import { createPaymentIntent, getOrderPaymentStatus, type Order } from "@/lib/checkoutApi";
import type { PublicEvent } from "@/lib/publicEventApi";
import { loadCart, clearCart, type StoredCartItem } from "@/lib/cartStorage";
import { summaryLinesFromCart } from "@/lib/orderSummaryLines";
import { CheckoutDetailsForm } from "@/components/CheckoutDetailsForm";
import { CheckoutPaymentStep } from "@/components/CheckoutPaymentStep";
import { CheckoutOrderSummary } from "@/components/CheckoutOrderSummary";
import { OrderConfirmation } from "@/components/OrderConfirmation";

type Step = "details" | "payment" | "confirmation";

type PersistedCheckout = { order: Order; clientSecret: string };

function checkoutStorageKey(eventId: number): string {
  return `mefie-checkout:${eventId}`;
}

/**
 * Owns the details → payment → confirmation flow on the dedicated
 * /checkout route — moved out of the old inline Checkout.tsx wizard.
 * Ticket selection itself stays on the event page (EventTicketPanel);
 * the picked quantities are handed off via sessionStorage (cartStorage.ts)
 * since a real navigation to this route unmounts that component tree.
 *
 * order/clientSecret persistence-and-reconciliation-on-mount is
 * unchanged from the old Checkout.tsx: once an order exists it's a real
 * RESERVED (or already-paid) reservation server-side, so a reload here
 * must resume it against the authoritative status, never silently drop
 * the buyer back to an empty flow while a real charge may have gone
 * through.
 */
export function CheckoutPage({ event, backUrl }: { event: PublicEvent; backUrl: string }) {
  const router = useRouter();
  const [cart, setCart] = useState<StoredCartItem[] | null | "loading">("loading");
  const [step, setStep] = useState<Step>("details");
  const [order, setOrder] = useState<Order | null>(null);
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const reconciling = useRef(false);

  // No cart handed off (direct visit, bookmark, expired tab) — nothing
  // to check out, send the buyer back to pick tickets. Deferred a tick
  // (rather than setCart() directly in the effect body) so this reads
  // as reacting to an external read, matching the reconciliation effect
  // below.
  useEffect(() => {
    Promise.resolve().then(() => setCart(loadCart(event.id)));
  }, [event.id]);

  useEffect(() => {
    if (cart === null) router.replace(backUrl);
  }, [cart, router, backUrl]);

  useEffect(() => {
    if (!order || !clientSecret) return;
    sessionStorage.setItem(checkoutStorageKey(event.id), JSON.stringify({ order, clientSecret } satisfies PersistedCheckout));
  }, [order, clientSecret, event.id]);

  // Reconcile against the authoritative status before resuming anywhere
  // — a persisted copy could be stale (e.g. the webhook that completes
  // the order arrived while this tab was closed/reloaded).
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
          clearCart(event.id);
          // Prefer the fresh order the status check just returned (real
          // unassigned_count/attendees) over the stale RESERVED snapshot
          // — the persisted copy predates payment completion.
          setOrder(authoritative.order ?? { ...persisted.order, status: "COMPLETED" });
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
  }, [event.id]);

  const cartItems = useMemo(() => {
    if (cart === "loading" || cart === null) return [];
    return cart.map((item) => {
      const product = event.products.find((p) => p.id === item.product_id);
      const option = item.ticket_option_id ? product?.options?.find((o) => o.id === item.ticket_option_id) : null;
      return {
        product_id: item.product_id,
        ticket_option_id: item.ticket_option_id,
        product_title: option ? `${product?.title ?? ""} — ${option.name}` : (product?.title ?? ""),
        quantity: item.quantity,
      };
    });
  }, [cart, event.products]);

  const total = useMemo(() => {
    return cartItems.reduce((sum, item) => {
      const product = event.products.find((p) => p.id === item.product_id);
      const option = item.ticket_option_id ? product?.options?.find((o) => o.id === item.ticket_option_id) : null;
      const price = option ? option.price : (product?.current_price ?? 0);
      return sum + Number(price) * item.quantity;
    }, 0);
  }, [cartItems, event.products]);

  const summaryLines = useMemo(() => summaryLinesFromCart(cartItems, event.products), [cartItems, event.products]);

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
      clearCart(event.id);
      setStep("confirmation");
    } else {
      setStep("payment");
      paymentIntentMutation.mutate(newOrder);
    }
  }

  // Full-page, no leftover "Complete your booking" chrome once the
  // buyer has actually finished — matches the Figma payment-success
  // frames, which have no such header above the success content.
  const showBookingHeader = step !== "confirmation";

  let content: React.ReactNode;
  if (cart === "loading") {
    content = (
      <Stack align="center" py="xl">
        <Loader />
      </Stack>
    );
  } else if (cart === null) {
    // Redirect effect above is already in flight — render nothing rather
    // than a flash of an empty checkout form.
    content = null;
  } else if (step === "confirmation" && order) {
    content = <OrderConfirmation eventTitle={event.title} order={order} />;
  } else {
    content = (
      <Grid gutter="xl">
        <GridCol span={{ base: 12, md: 7 }} order={{ base: 2, md: 1 }}>
          <Paper withBorder radius="lg" p={{ base: "md", sm: "lg" }}>
            {step === "payment" && order ? (
              paymentIntentMutation.isPending ? (
                <Stack align="center" py="xl" gap="xs">
                  <Loader />
                  <Text c="dimmed" size="sm">
                    Preparing payment…
                  </Text>
                </Stack>
              ) : clientSecret ? (
                <CheckoutPaymentStep
                  eventId={event.id}
                  order={order}
                  clientSecret={clientSecret}
                  defaultBillingCountry={event.location?.country}
                  onPaid={(updatedOrder) => {
                    sessionStorage.removeItem(checkoutStorageKey(event.id));
                    clearCart(event.id);
                    setOrder(updatedOrder);
                    setStep("confirmation");
                  }}
                />
              ) : (
                // Reservation was created but the payment-intent call failed —
                // retry against the same order rather than re-collecting details.
                <Stack align="center" py="xl" gap="md">
                  <Alert color="red" icon={<IconAlertCircle size={18} />} title="Couldn't start payment">
                    Your tickets are still reserved (order {order.short_id}). Try again below.
                  </Alert>
                  <Button onClick={() => paymentIntentMutation.mutate(order)}>Retry</Button>
                </Stack>
              )
            ) : (
              <CheckoutDetailsForm
                event={event}
                cartItems={cartItems}
                totalDue={total}
                onOrderCreated={handleOrderCreated}
                onBack={() => router.push(backUrl)}
              />
            )}
          </Paper>
        </GridCol>

        <GridCol span={{ base: 12, md: 5 }} order={{ base: 1, md: 2 }}>
          <Box pos={{ base: "static", md: "sticky" }} top={84}>
            <Paper withBorder radius="lg" p={{ base: "md", sm: "lg" }}>
              <CheckoutOrderSummary event={event} lines={order ? { order } : { lines: summaryLines }} />
            </Paper>
          </Box>
        </GridCol>
      </Grid>
    );
  }

  return (
    <Stack gap="lg">
      {showBookingHeader && (
        <Stack gap="lg">
          <Text component="a" href={backUrl} size="sm" fw={500} style={{ display: "inline-flex", alignItems: "center", gap: 6, width: "fit-content" }}>
            <IconArrowLeft size={16} /> Back to event details
          </Text>
          <Stack gap={4}>
            <Title order={1} fz={{ base: 24, sm: 30 }}>
              Complete your booking
            </Title>
            <Text c="dimmed">You&apos;re almost there — fill in your details and pay to confirm your tickets.</Text>
          </Stack>
        </Stack>
      )}
      {content}
    </Stack>
  );
}
