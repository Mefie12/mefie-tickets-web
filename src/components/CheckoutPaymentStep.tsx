"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { loadStripe, type StripePaymentElementOptions } from "@stripe/stripe-js";
import { Elements, PaymentElement, useElements, useStripe } from "@stripe/react-stripe-js";
import { useQuery } from "@tanstack/react-query";
import { Alert, Button, Card, Group, Loader, Stack, Text, Title } from "@mantine/core";
import { IconAlertCircle, IconClock } from "@tabler/icons-react";
import { ApiError } from "@/lib/authApi";
import { beginPaymentConfirmation, getOrderPaymentStatus, type Order } from "@/lib/checkoutApi";
import { formatMoney } from "@/lib/money";
import { OrderCostBreakdown } from "@/components/OrderCostBreakdown";

const publishableKey = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY;

// How long we keep actively polling our own webhook-driven confirmation
// after a payment confirmation has genuinely begun (beginPaymentConfirmation
// succeeded), before switching to a "this is taking a while" message. One
// timer covers both sub-phases — waiting on Stripe itself, and waiting on
// our own webhook after Stripe already said succeeded — rather than two
// separate ones, since by the time a confirmation has begun the charge may
// already be in flight and there's no reason to rush the customer.
const CONFIRMATION_POLL_INTERVAL_MS = 2000;
const CONFIRMATION_POLL_SLOW_INTERVAL_MS = 20000;
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

/** Whole seconds remaining until `isoString`, floored at 0, or null if there's nothing to count down to. */
function secondsUntil(isoString: string | null | undefined): number | null {
  if (!isoString) return null;
  return Math.max(0, Math.round((new Date(isoString).getTime() - Date.now()) / 1000));
}

function formatMMSS(totalSeconds: number): string {
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

/**
 * Traffic-light urgency for the reservation countdown, using this app's
 * existing semantic color conventions rather than inventing new ones:
 * `teal` already means "good/available" (EventTicketPanel's availability
 * dot, Platform Settings' success toasts), `yellow` already means
 * "running low" (AdminMfaPanel's dwindling attempts-remaining warning),
 * and `red` is this codebase's overwhelmingly dominant "critical" color.
 * Thresholds match what was requested: amber at 5:00, red at 2:00.
 */
function reservationUrgencyColor(secondsLeft: number): "teal" | "yellow" | "red" {
  if (secondsLeft <= 120) return "red";
  if (secondsLeft <= 300) return "yellow";
  return "teal";
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
 * here, the existing reservation hold expires naturally — see
 * reservationExpiresAt/onExpired below for how the buyer is told about
 * that rather than being left to discover it by trying to pay.
 */
export function CheckoutPaymentStep({
  order,
  eventId,
  clientSecret,
  reservationExpiresAt,
  defaultBillingCountry,
  onPaid,
  onExpired,
}: {
  order: Order;
  eventId: number;
  clientSecret: string;
  /** Server-authoritative deadline for this order's checkout window — null once the order is no longer RESERVED. */
  reservationExpiresAt: string | null;
  /** The event's own venue country (location.country) — see paymentElementOptionsFor. */
  defaultBillingCountry?: string | null;
  onPaid: (order: Order) => void;
  /** The reservation expired before any payment confirmation began — safe to restart checkout from scratch. */
  onExpired: () => void;
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
    <Stack gap="md">
      <Title order={2} fz={22}>
        2. Payment Details
      </Title>
      <Elements
        stripe={stripePromise}
        options={{
          clientSecret,
          // `fontSizeBase: 16px` pinned so the card fields inside Stripe's
          // iframe never fall under 16px — the threshold below which iOS
          // Safari zooms into a focused input and leaves the page zoomed.
          appearance: { theme: "night", variables: { fontSizeBase: "16px" } },
        }}
      >
        <PaymentForm
          eventId={eventId}
          order={order}
          clientSecret={clientSecret}
          reservationExpiresAt={reservationExpiresAt}
          defaultBillingCountry={defaultBillingCountry}
          onPaid={onPaid}
          onExpired={onExpired}
        />
      </Elements>
    </Stack>
  );
}

function PaymentForm({
  eventId,
  order,
  clientSecret,
  reservationExpiresAt,
  defaultBillingCountry,
  onPaid,
  onExpired,
}: {
  eventId: number;
  order: Order;
  clientSecret: string;
  reservationExpiresAt: string | null;
  defaultBillingCountry?: string | null;
  onPaid: (order: Order) => void;
  onExpired: () => void;
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
  // True from the moment beginPaymentConfirmation() succeeds (before
  // Stripe is ever called) through to a final resolved outcome. A
  // confirmation that has genuinely begun may have actually charged the
  // card even if it later turns out ambiguous — see the render logic
  // below for why this one-way flag exists and what it does (and does
  // NOT) suppress.
  const [confirmationInFlight, setConfirmationInFlight] = useState(false);
  // Flips from the "confirming" to the "taking a while" message once
  // CONFIRMATION_POLL_CEILING_MS has passed since a confirmation began —
  // driven by its own timer rather than recomputed from Date.now() on
  // render, since ref/Date.now() reads aren't allowed during render (see
  // pollStartedAtRef below).
  const [showConfirmingMessage, setShowConfirmingMessage] = useState(true);
  const pollStartedAtRef = useRef<number | null>(null);

  const [secondsLeft, setSecondsLeft] = useState<number | null>(() => secondsUntil(reservationExpiresAt));
  const [expiredBeforeConfirmation, setExpiredBeforeConfirmation] = useState(false);

  // Resync the countdown whenever the server hands back a fresh deadline
  // (e.g. a later payment-status poll) — mirrors VerifyEmailPanel.tsx's
  // countdown pattern.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSecondsLeft(secondsUntil(reservationExpiresAt));
  }, [reservationExpiresAt]);

  useEffect(() => {
    if (confirmationInFlight) return;
    if (secondsLeft === null || secondsLeft <= 0) return;
    const timer = setInterval(() => setSecondsLeft((s) => (s === null ? s : Math.max(0, s - 1))), 1000);
    return () => clearInterval(timer);
  }, [secondsLeft, confirmationInFlight]);

  // The countdown reaching zero is a client-clock signal, not an
  // authoritative one — before declaring the reservation expired,
  // confirm with the server, retrying every few seconds rather than a
  // single check: the sweep that actually abandons the order only runs
  // once a minute, so the deadline can genuinely pass on the client
  // before the server-side order record catches up, and a single
  // sample would leave the buyer stuck looking at a frozen 0:00 with a
  // still-clickable Pay button until they tried it themselves. Never
  // runs once a confirmation has genuinely begun: the countdown has no
  // concept of the separate, short confirmation grace that protects the
  // order past its normal deadline in that case. A `useQuery` here
  // (rather than a hand-rolled effect) avoids a self-cancelling-effect
  // bug: an earlier version stored the "checking" flag as a dependency
  // of the same effect that set it, so setting it immediately cancelled
  // the very request it had just started, leaving the spinner stuck
  // forever (confirmed live).
  const expiryCheckQuery = useQuery({
    queryKey: ["order-payment-status", "expiry-check", eventId, order.short_id],
    queryFn: () => getOrderPaymentStatus(eventId, order.short_id),
    enabled: !confirmationInFlight && !expiredBeforeConfirmation && secondsLeft !== null && secondsLeft <= 0,
    refetchInterval: (query) => (query.state.data?.status === "RESERVED" ? 3000 : false),
  });

  useEffect(() => {
    if (!expiryCheckQuery.data) return;
    if (expiryCheckQuery.data.status === "RESERVED") {
      // False alarm (clock drift, or the sweep hasn't caught up yet) —
      // resync from the server's own value; the query above keeps
      // retrying until this genuinely changes.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setSecondsLeft(secondsUntil(expiryCheckQuery.data.reservation_expires_at));
    } else {
      setExpiredBeforeConfirmation(true);
    }
  }, [expiryCheckQuery.data]);

  useEffect(() => {
    if (!paymentConfirmedByStripe) return;
    const timer = setTimeout(() => setShowConfirmingMessage(false), CONFIRMATION_POLL_CEILING_MS);
    return () => clearTimeout(timer);
  }, [paymentConfirmedByStripe]);

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
        setConfirmationInFlight(true);
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
    // Runs from the moment a confirmation genuinely begins, not just once
    // Stripe itself has confirmed — so a hung/never-resolving
    // confirmPayment() call still eventually learns the order's
    // authoritative fate rather than leaving the buyer on a stuck
    // spinner forever.
    enabled: confirmationInFlight,
    // Mirrors the conditional-refetchInterval pattern already used in
    // ComplimentaryTicketsManager.tsx — poll steadily while unresolved,
    // stop only once COMPLETED. The ceiling below only ever changes
    // wording (see showConfirmingMessage); it never stops the poll.
    refetchInterval: (query) => {
      if (query.state.data?.status === "COMPLETED") return false;
      return paymentConfirmedByStripe ? CONFIRMATION_POLL_INTERVAL_MS : CONFIRMATION_POLL_SLOW_INTERVAL_MS;
    },
  });

  useEffect(() => {
    // statusQuery.data.order is the fresh, post-completion order (real
    // unassigned_count/attendees) — falling back to the pre-payment
    // `order` prop only guards a response shape that should never
    // actually happen once status is COMPLETED.
    if (statusQuery.data?.status === "COMPLETED") onPaid(statusQuery.data.order ?? order);
  }, [statusQuery.data, onPaid, order]);

  // The order was abandoned server-side AFTER a confirmation had
  // genuinely begun — the card may have actually been charged (the
  // existing PAYMENT_CAPTURED_AFTER_EXPIRY/REVIEW_REQUIRED backend path
  // exists precisely for this). Deliberately no "Start over" here: an
  // extra 10-60 seconds of polling cannot turn a genuinely uncertain
  // Stripe outcome into a certain one, so this screen never claims it's
  // safe to pay again. The buyer isn't trapped — they can navigate away
  // and start an independent new checkout whenever they choose.
  const outcomeIsUncertain =
    confirmationInFlight && statusQuery.data !== undefined && !["RESERVED", "COMPLETED"].includes(statusQuery.data.status);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!stripe || !elements) return;

    setSubmitting(true);
    setErrorMessage(null);

    try {
      await beginPaymentConfirmation(eventId, order.short_id);
    } catch (error) {
      setSubmitting(false);
      if (error instanceof ApiError && error.code === "ORDER_NOT_PAYABLE") {
        // The reservation is genuinely gone and Stripe was never called —
        // unambiguous and safe to resolve immediately.
        setExpiredBeforeConfirmation(true);
        return;
      }
      // ApiError "PAYMENT_ATTEMPT_NOT_READY" (or anything else) is NOT
      // the same as an expired reservation — it may still have time
      // left — so this stays an ordinary retryable error, not the
      // expired-reservation UI.
      setErrorMessage(error instanceof ApiError ? error.message : "Could not start your payment. Please try again.");
      return;
    }

    pollStartedAtRef.current = Date.now();
    setConfirmationInFlight(true);

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

  if (outcomeIsUncertain) {
    return (
      <Stack gap="md" align="center" py="xl">
        <Loader size="sm" />
        <Text ta="center" fw={500}>
          {showConfirmingMessage
            ? "We're checking your payment status — please don't submit another payment."
            : `This is taking longer than expected. If you were charged, we'll follow up — please don't submit another payment. Reference: ${order.short_id}.`}
        </Text>
      </Stack>
    );
  }

  if (paymentConfirmedByStripe) {
    return (
      <Stack gap="md" align="center" py="xl">
        <Loader size="sm" />
        <Text ta="center" fw={500}>
          {showConfirmingMessage
            ? "Payment received — confirming your order…"
            : `Your payment was received. We're finalizing your order — this can take a few minutes. Reference: ${order.short_id}.`}
        </Text>
      </Stack>
    );
  }

  if (expiredBeforeConfirmation) {
    return (
      <Stack gap="md" align="center" py="xl">
        <Alert color="orange" icon={<IconAlertCircle size={18} />} title="Your reservation has expired" w="100%">
          We released these tickets because the payment window ended. Your selections are still saved, but
          availability will be re-checked when you start over.
        </Alert>
        <Button onClick={onExpired}>Start over</Button>
      </Stack>
    );
  }

  // The countdown hit zero but the server hasn't confirmed either way
  // yet (expiryCheckQuery still retrying) — disable Pay rather than let
  // the buyer submit against a reservation that's very likely already
  // gone, without yet claiming outright that it has.
  const verifyingExpiry = secondsLeft !== null && secondsLeft <= 0;
  const urgencyColor = reservationUrgencyColor(Math.max(secondsLeft ?? 0, 0));

  return (
    <form onSubmit={handleSubmit}>
      <Stack gap="md">
        {secondsLeft !== null && (
          <Group
            gap={8}
            justify="center"
            wrap="nowrap"
            py={6}
            px={12}
            style={{ borderRadius: "var(--mantine-radius-md)", backgroundColor: `var(--mantine-color-${urgencyColor}-light)` }}
            aria-live={verifyingExpiry ? "polite" : "off"}
          >
            <IconClock size={16} color={`var(--mantine-color-${urgencyColor}-6)`} style={{ flexShrink: 0 }} />
            <Text size="sm" c={urgencyColor}>
              Reservation holds for
            </Text>
            <Text size="sm" fw={700} c={urgencyColor} ff="monospace">
              {verifyingExpiry ? "confirming…" : formatMMSS(secondsLeft)}
            </Text>
          </Group>
        )}
        <Card withBorder radius="md" p="md">
          <OrderCostBreakdown order={order} />
        </Card>
        <PaymentElement options={paymentElementOptions} />
        {errorMessage && (
          <Alert color="red" icon={<IconAlertCircle size={18} />}>
            {errorMessage}
          </Alert>
        )}
        <Button type="submit" loading={submitting} disabled={!stripe || !elements || verifyingExpiry} size="md" fullWidth>
          Pay {formatMoney(order.total_amount, order.currency)}
        </Button>
        <Text size="xs" c="dimmed" ta="center">
          Order {order.short_id}
        </Text>
      </Stack>
    </form>
  );
}
