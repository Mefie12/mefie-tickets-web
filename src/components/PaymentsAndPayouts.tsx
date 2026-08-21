"use client";

import { useMemo, useState } from "react";
import { Alert, Badge, Button, Card, Checkbox, Group, Stack, Text, Title } from "@mantine/core";
import { useMutation } from "@tanstack/react-query";
import { loadConnectAndInitialize } from "@stripe/connect-js";
import { ConnectAccountManagement, ConnectAccountOnboarding, ConnectComponentsProvider } from "@stripe/react-connect-js";
import { ApiError } from "@/lib/authApi";
import { createPaymentManagementSession, provisionPaymentAccount, type PaymentAccount, type PendingEarnings } from "@/lib/paymentAccountApi";
import { CountrySelector } from "@/components/CountrySelector";
import { CurrencySelector } from "@/components/CurrencySelector";
import { COUNTRIES_BY_CODE } from "@/lib/countries";
import { PendingEarningsCard } from "@/components/PendingEarningsCard";
import { formatMinorAmount } from "@/lib/money";

const publishableKey = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY;

export function PaymentsAndPayouts({
  initialAccount,
  initialEarnings,
  defaultLegalCountry,
}: {
  initialAccount: PaymentAccount | null;
  initialEarnings: PendingEarnings | null;
  /** Platform-configured convenience pre-fill (config('organizations.default_legal_country')) — never a claim about provider support. */
  defaultLegalCountry: string | null;
}) {
  const [account, setAccount] = useState(initialAccount);
  const [country, setCountry] = useState(defaultLegalCountry ?? "");
  const [currency, setCurrency] = useState(() => (defaultLegalCountry ? COUNTRIES_BY_CODE.get(defaultLegalCountry)?.defaultCurrency ?? "" : ""));
  const [countryConfirmed, setCountryConfirmed] = useState(false);
  const setup = useMutation({
    mutationFn: () => provisionPaymentAccount(country.trim().toUpperCase(), currency.trim().toUpperCase()),
    onSuccess: ({ payment_account }) => setAccount(payment_account),
  });
  const disconnected = account?.account_status === "DISCONNECTED";
  // A HISTORICAL account is a permanently-rejected setup attempt (see
  // PaymentAccountService::provision()'s InvalidRequestException catch)
  // — it must never be mistaken for a real, live account, or the
  // organizer can never see the setup form again after one rejection.
  const rejected = account?.routing_status === "HISTORICAL";
  const connectInstance = useMemo(() => {
    if (!account || account.provider !== "STRIPE" || !publishableKey || disconnected || rejected) return null;
    return loadConnectAndInitialize({ publishableKey, fetchClientSecret: createPaymentManagementSession });
  }, [account, disconnected, rejected]);

  if (!account || rejected) {
    const rejectionReason = rejected ? account?.provider_metadata?.rejection_reason : undefined;

    return (
      <Card withBorder radius="lg" p="xl" maw={720}>
        <Stack>
          <Title order={2}>Payments &amp; Payouts</Title>
          <Text c="dimmed">
            Add your legal payment country and settlement currency to start selling tickets right away — you can
            complete full verification later, once you have real sales to withdraw. This is separate from your public
            organization address, and separate from what currency any individual event sells tickets in.
          </Text>
          {rejectionReason && (
            <Alert color="red" title="Your last setup attempt was rejected">
              {rejectionReason} Try a different country or settlement currency below.
            </Alert>
          )}
          <CountrySelector
            label="Legal entity country"
            required
            value={country}
            onChange={(value) => {
              setCountry(value ?? "");
              setCountryConfirmed(false);
              const suggested = value ? COUNTRIES_BY_CODE.get(value)?.defaultCurrency : undefined;
              if (suggested) setCurrency(suggested);
            }}
          />
          <CurrencySelector
            label="Settlement currency"
            description="The currency your payouts settle in — auto-filled from your country, but you can change it. Your events can still sell tickets in any currency; sales in other currencies are automatically converted at payout time."
            required
            value={currency}
            onChange={(value) => setCurrency(value ?? "")}
          />
          <Alert color="orange">Choose the country where the entity receiving ticket revenue is legally registered. This is a financial/KYC setting, not your public address, and changing it later requires payment-account replacement.</Alert>
          <Checkbox checked={countryConfirmed} onChange={(event) => setCountryConfirmed(event.currentTarget.checked)} label="I confirm this is the payment account's legal country." />
          {setup.error && <Alert color="red">{setup.error instanceof ApiError ? setup.error.message : "Payment setup failed."}</Alert>}
          <Button disabled={country.length !== 2 || currency.length !== 3 || !countryConfirmed} loading={setup.isPending} onClick={() => setup.mutate()} style={{ alignSelf: "flex-start" }}>Set up payments</Button>
        </Stack>
      </Card>
    );
  }

  const readyToWithdraw = !!initialEarnings && initialEarnings.release_eligible_minor > 0 && account.account_status !== "ACTIVE";

  return (
    <Stack maw={900}>
      <Card withBorder radius="lg" p="xl">
        <Stack>
          <Group justify="space-between"><Title order={2}>Payments &amp; Payouts</Title><Badge>{account.provider}</Badge></Group>
          <Group><Status label="Payouts" enabled={account.transfers_enabled} /><Badge color={account.account_status === "ACTIVE" ? "teal" : "orange"}>{account.account_status.replaceAll("_", " ")}</Badge></Group>
          <Text size="sm" c="dimmed">Legal country: {account.legal_country} · Environment: {account.environment} · Routing: {account.routing_status.replaceAll("_", " ")}</Text>
          <Text size="xs" c="dimmed">
            You can sell tickets as soon as this account is set up — verification below is only required to withdraw
            your earnings to your bank.
          </Text>
          {account.requirements_status !== "CLEAR" && <Alert color="orange">Your payment provider requires additional information. Complete the secure form below.</Alert>}
        </Stack>
      </Card>

      {readyToWithdraw && initialEarnings && (
        <Alert color="brand" title="You have money ready to withdraw">
          {formatMinorAmount(initialEarnings.release_eligible_minor, initialEarnings.currency ?? account.default_currency)} is ready to
          withdraw — complete verification below to receive it.
        </Alert>
      )}

      {initialEarnings && <PendingEarningsCard earnings={initialEarnings} currency={initialEarnings.currency ?? account.default_currency} />}

      {disconnected && (
        <Alert color="red" title="Payment account disconnected">
          Your payment account connection is no longer valid and needs to be reconnected by our team before payouts
          can continue. Contact support to resolve this — your ticket sales are not affected.
        </Alert>
      )}

      {!disconnected && !publishableKey && <Alert color="red">Stripe publishable key is not configured.</Alert>}
      {!disconnected && connectInstance && (
        <ConnectComponentsProvider connectInstance={connectInstance}>
          {account.account_status === "ONBOARDING" || account.onboarding_status !== "SUBMITTED" ? (
            <ConnectAccountOnboarding onExit={() => window.location.reload()} />
          ) : (
            <ConnectAccountManagement />
          )}
        </ConnectComponentsProvider>
      )}
    </Stack>
  );
}

function Status({ label, enabled }: { label: string; enabled: boolean }) {
  return <Badge color={enabled ? "teal" : "gray"}>{label}: {enabled ? "Enabled" : "Not enabled"}</Badge>;
}
