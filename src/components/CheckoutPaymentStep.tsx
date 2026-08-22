"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { loadStripe, type StripePaymentElementOptions } from "@stripe/stripe-js";
import { Elements, PaymentElement, useElements, useStripe } from "@stripe/react-stripe-js";
import { useQuery } from "@tanstack/react-query";
import { Alert, Button, Loader, Stack, Text } from "@mantine/core";
import { IconAlertCircle } from "@tabler/icons-react";
import { getOrderPaymentStatus, type Order } from "@/lib/checkoutApi";
import { formatMoney } from "@/lib/money";

const publishableKey = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY;

// How long we keep actively polling our own webhook-driven confirmation
// after Stripe itself already confirmed the charge, before switching to
// a "this is taking a while" message. Generous on purpose — the charge
// has already happened by this point (a delayed webhook is the only
// thing left to wait on), so there's no reason to rush the customer or
// ever invite them to pay again.
const CONFIRMATION_POLL_INTERVAL_MS = 2000;
const CONFIRMATION_POLL_CEILING_MS = 3 * 60 * 1000;

function paymentElementOptionsFor(defaultBillingCountry?: string | null): StripePaymentElementOptions {
  return {
    layout: "tabs",
    // Stripe's own default-guessing for this field is opaque (observed
    // live: it defaulted to an unrelated country) — so it's overridden
    // explicitly with the event's own venue country whenever one exists,
    // rather than leaving it to a guess. Left unset for an online event
    // (no venue country to guess from), which is correct there anyway.
    ...(defaultBillingCountry
      ? { defaultValues: { billingDetails: { address: { country: defaultBillingCountry } } } }
      : {}),
  };
}

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
  defaultBillingCountry,
  onPaid,
}: {
  order: Order;
  eventId: number;
  clientSecret: string;
  /** The event's own venue country (location.country) — see paymentElementOptionsFor. */
  defaultBillingCountry?: string | null;
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
      <PaymentForm
        eventId={eventId}
        order={order}
        clientSecret={clientSecret}
        defaultBillingCountry={defaultBillingCountry}
        onPaid={onPaid}
      />
    </Elements>
  );
}

function PaymentForm({
  eventId,
  order,
  clientSecret,
  defaultBillingCountry,
  onPaid,
}: {
  eventId: number;
  order: Order;
  clientSecret: string;
  defaultBillingCountry?: string | null;
  onPaid: () => void;
}) {
  const stripe = useStripe();
  const elements = useElements();
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  // Once Stripe itself confirms the charge, the payment is done — the
  // form must never become resubmittable again, no matter how long our
  // own webhook-driven confirmation takes. Re-confirming an
  // already-succeeded PaymentIntent produces a confusing Stripe-side
  // error for a payment that already went through fine (confirmed live:
  // the previous version left the Pay button enabled through this wait).
  const [paymentConfirmedByStripe, setPaymentConfirmedByStripe] = useState(false);
  const [checkingExistingStatus, setCheckingExistingStatus] = useState(true);
  const pollStartedAtRef = useRef<number | null>(null);

  // A reload (see Checkout.tsx's sessionStorage resume) re-mounts this
  // form fresh, with no memory of whether the underlying PaymentIntent
  // was already confirmed before the reload — confirmed live: without
  // this check, a resumed page shows a fresh, clickable Pay button even
  // when Stripe already marked the charge succeeded, risking exactly
  // the double-confirm error this component otherwise prevents.
  useEffect(() => {
    if (!stripe) return;
    let cancelled = false;
    stripe.retrievePaymentIntent(clientSecret).then(({ paymentIntent }) => {
      if (cancelled) return;
      if (paymentIntent?.status === "succeeded") {
        pollStartedAtRef.current = Date.now();
        setPaymentConfirmedByStripe(true);
      }
      setCheckingExistingStatus(false);
    });
    return () => {
      cancelled = true;
    };
  }, [stripe, clientSecret]);

  const paymentElementOptions = useMemo(() => paymentElementOptionsFor(defaultBillingCountry), [defaultBillingCountry]);

  const statusQuery = useQuery({
    queryKey: ["order-payment-status", eventId, order.short_id],
    queryFn: () => getOrderPaymentStatus(eventId, order.short_id),
    enabled: paymentConfirmedByStripe,
    // Mirrors the conditional-refetchInterval pattern already used in
    // ComplimentaryTicketsManager.tsx — poll steadily while unresolved,
    // stop once COMPLETED or once the generous ceiling above is hit,
    // rather than a hard-coded number of attempts.
    refetchInterval: (query) => {
      if (query.state.data?.status === "COMPLETED") return false;
      if (pollStartedAtRef.current !== null && Date.now() - pollStartedAtRef.current >= CONFIRMATION_POLL_CEILING_MS) return false;
      return CONFIRMATION_POLL_INTERVAL_MS;
    },
  });

  useEffect(() => {
    if (statusQuery.data?.status === "COMPLETED") onPaid();
  }, [statusQuery.data?.status, onPaid]);

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
      pollStartedAtRef.current = Date.now();
      setPaymentConfirmedByStripe(true);
      return;
    }

    setErrorMessage("Payment did not complete. Please try again.");
    setSubmitting(false);
  }

  if (checkingExistingStatus) {
    return (
      <Stack align="center" py="xl">
        <Loader size="sm" />
      </Stack>
    );
  }

  if (paymentConfirmedByStripe) {
    const withinCeiling =
      pollStartedAtRef.current === null || Date.now() - pollStartedAtRef.current < CONFIRMATION_POLL_CEILING_MS;

    return (
      <Stack gap="md" align="center" py="xl">
        <Loader size="sm" />
        <Text ta="center" fw={500}>
          {withinCeiling
            ? "Payment received — confirming your order…"
            : `Your payment was received. We're finalizing your order — this can take a few minutes. Reference: ${order.short_id}.`}
        </Text>
      </Stack>
    );
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
