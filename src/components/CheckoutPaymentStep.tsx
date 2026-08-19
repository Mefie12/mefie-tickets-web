"use client";

import { useMemo, useState } from "react";
import { loadStripe, type StripePaymentElementOptions } from "@stripe/stripe-js";
import { Elements, PaymentElement, useElements, useStripe } from "@stripe/react-stripe-js";
import { Alert, Button, Stack, Text } from "@mantine/core";
import { IconAlertCircle } from "@tabler/icons-react";
import { getOrderPaymentStatus, type Order } from "@/lib/checkoutApi";
import { formatMoney } from "@/lib/money";

const publishableKey = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY;
const paymentElementOptions: StripePaymentElementOptions = { layout: "tabs" };

/**
 * Stripe confirms the card interaction, but the browser is not allowed
 * to complete the order. After provider success we poll Mefie's
 * webhook-authoritative status before showing a confirmation.
 *
 * No "back" step here on purpose: the order is already RESERVED
 * server-side by this point, and there's no update-order endpoint —
 * going "back" to re-edit details and resubmitting would create a
 * second reservation against the same inventory. If a buyer abandons
 * here, the existing 10-minute reservation hold expires naturally.
 */
export function CheckoutPaymentStep({
  order,
  eventId,
  clientSecret,
  onPaid,
}: {
  order: Order;
  eventId: number;
  clientSecret: string;
  onPaid: () => void;
}) {
  // Held-funds policy: the PaymentIntent behind this client_secret is
  // created on Mefie's own platform Stripe account, not the organizer's
  // connected account (see StripeGateway::createPayment) — so Stripe.js
  // must NOT be scoped with `stripeAccount` here. Doing so previously
  // made Elements unable to resolve the PaymentIntent at all (confirmed
  // live: the payment step hung with the PaymentElement never usable).
  const stripePromise = useMemo(() => (publishableKey ? loadStripe(publishableKey) : null), []);

  if (!stripePromise) {
    return (
      <Alert color="red" icon={<IconAlertCircle size={18} />} title="Payment unavailable">
        Stripe isn&apos;t configured for this environment. Set NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY and reload.
      </Alert>
    );
  }

  return (
    <Elements stripe={stripePromise} options={{ clientSecret, appearance: { theme: "night" } }}>
      <PaymentForm eventId={eventId} order={order} onPaid={onPaid} />
    </Elements>
  );
}

function PaymentForm({ eventId, order, onPaid }: { eventId: number; order: Order; onPaid: () => void }) {
  const stripe = useStripe();
  const elements = useElements();
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!stripe || !elements) return;

    setSubmitting(true);
    setErrorMessage(null);

    const { error, paymentIntent } = await stripe.confirmPayment({
      elements,
      confirmParams: { return_url: window.location.href },
      redirect: "if_required",
    });

    if (error) {
      setErrorMessage(error.message ?? "Payment failed. Please try a different payment method.");
      setSubmitting(false);
      return;
    }

    if (paymentIntent?.status === "succeeded") {
      for (let attempt = 0; attempt < 15; attempt += 1) {
        const authoritative = await getOrderPaymentStatus(eventId, order.short_id);
        if (authoritative.status === "COMPLETED") {
          onPaid();
          return;
        }
        await new Promise((resolve) => window.setTimeout(resolve, 1000));
      }
      setErrorMessage("Your payment was received and is still being confirmed. Please wait a moment before trying again.");
      setSubmitting(false);
      return;
    }

    setErrorMessage("Payment did not complete. Please try again.");
    setSubmitting(false);
  }

  return (
    <form onSubmit={handleSubmit}>
      <Stack gap="md">
        <Text size="sm" c="dimmed">
          Paying {formatMoney(order.total_amount, order.currency)} for order {order.short_id}
        </Text>
        <PaymentElement options={paymentElementOptions} />
        {errorMessage && (
          <Alert color="red" icon={<IconAlertCircle size={18} />}>
            {errorMessage}
          </Alert>
        )}
        <Button type="submit" loading={submitting} disabled={!stripe || !elements} size="md">
          Pay {formatMoney(order.total_amount, order.currency)}
        </Button>
      </Stack>
    </form>
  );
}
