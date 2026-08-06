"use client";

import { useState } from "react";
import { loadStripe, type StripePaymentElementOptions } from "@stripe/stripe-js";
import { Elements, PaymentElement, useElements, useStripe } from "@stripe/react-stripe-js";
import { Alert, Button, Stack, Text } from "@mantine/core";
import { IconAlertCircle } from "@tabler/icons-react";
import type { Order } from "@/lib/checkoutApi";

const publishableKey = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY;
const stripePromise = publishableKey ? loadStripe(publishableKey) : null;

const paymentElementOptions: StripePaymentElementOptions = { layout: "tabs" };

/**
 * The PaymentIntent is created server-side with
 * automatic_payment_methods.allow_redirects = 'never' (single platform
 * Stripe account, card-only MVP checkout — see
 * StripePaymentService::createPaymentIntent), so confirmPayment() below
 * never actually redirects; `redirect: 'if_required'` keeps it that way
 * and resolves in place instead of leaving the page.
 *
 * No "back" step here on purpose: the order is already RESERVED
 * server-side by this point, and there's no update-order endpoint —
 * going "back" to re-edit details and resubmitting would create a
 * second reservation against the same inventory. If a buyer abandons
 * here, the existing 10-minute reservation hold expires naturally.
 */
export function CheckoutPaymentStep({
  order,
  clientSecret,
  onPaid,
}: {
  order: Order;
  clientSecret: string;
  onPaid: () => void;
}) {
  if (!stripePromise) {
    return (
      <Alert color="red" icon={<IconAlertCircle size={18} />} title="Payment unavailable">
        Stripe isn&apos;t configured for this environment. Set NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY and reload.
      </Alert>
    );
  }

  return (
    <Elements stripe={stripePromise} options={{ clientSecret, appearance: { theme: "night" } }}>
      <PaymentForm order={order} onPaid={onPaid} />
    </Elements>
  );
}

function PaymentForm({ order, onPaid }: { order: Order; onPaid: () => void }) {
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
      onPaid();
      return;
    }

    setErrorMessage("Payment did not complete. Please try again.");
    setSubmitting(false);
  }

  return (
    <form onSubmit={handleSubmit}>
      <Stack gap="md">
        <Text size="sm" c="dimmed">
          Paying {order.currency} {order.total_amount} for order {order.short_id}
        </Text>
        <PaymentElement options={paymentElementOptions} />
        {errorMessage && (
          <Alert color="red" icon={<IconAlertCircle size={18} />}>
            {errorMessage}
          </Alert>
        )}
        <Button type="submit" loading={submitting} disabled={!stripe || !elements} size="md">
          Pay {order.currency} {order.total_amount}
        </Button>
      </Stack>
    </form>
  );
}
