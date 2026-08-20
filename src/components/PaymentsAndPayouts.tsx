"use client";

import { useMemo, useState } from "react";
import { Alert, Badge, Button, Card, Checkbox, Group, Stack, Text, Title } from "@mantine/core";
import { useMutation } from "@tanstack/react-query";
import { loadConnectAndInitialize } from "@stripe/connect-js";
import { ConnectAccountManagement, ConnectAccountOnboarding, ConnectComponentsProvider } from "@stripe/react-connect-js";
import { ApiError } from "@/lib/authApi";
import { createPaymentManagementSession, provisionPaymentAccount, type PaymentAccount, type PendingEarnings } from "@/lib/paymentAccountApi";
import { CountrySelector } from "@/components/CountrySelector";
import { PendingEarningsCard } from "@/components/PendingEarningsCard";
import { formatMinorAmount } from "@/lib/money";

const publishableKey = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY;

export function PaymentsAndPayouts({
  initialAccount,
  initialEarnings,
}: {
  initialAccount: PaymentAccount | null;
  initialEarnings: PendingEarnings | null;
}) {
  const [account, setAccount] = useState(initialAccount);
  const [country, setCountry] = useState("");
  const [countryConfirmed, setCountryConfirmed] = useState(false);
  const setup = useMutation({
    mutationFn: () => provisionPaymentAccount(country.trim().toUpperCase()),
    onSuccess: ({ payment_account }) => setAccount(payment_account),
  });
  const disconnected = account?.account_status === "DISCONNECTED";
  const connectInstance = useMemo(() => {
    if (!account || account.provider !== "STRIPE" || !publishableKey || disconnected) return null;
    return loadConnectAndInitialize({ publishableKey, fetchClientSecret: createPaymentManagementSession });
  }, [account, disconnected]);

  if (!account) {
    return (
      <Card withBorder radius="lg" p="xl" maw={720}>
        <Stack>
          <Title order={2}>Payments &amp; Payouts</Title>
          <Text c="dimmed">
            Add your legal payment country to start selling tickets right away — you can complete full verification
            later, once you have real sales to withdraw. Your legal payment country is separate from your public
            organization address.
          </Text>
          <CountrySelector label="Legal entity country" required value={country} onChange={(value) => { setCountry(value ?? ""); setCountryConfirmed(false); }} />
          <Alert color="orange">Choose the country where the entity receiving ticket revenue is legally registered. This is a financial/KYC setting, not your public address, and changing it later requires payment-account replacement.</Alert>
          <Checkbox checked={countryConfirmed} onChange={(event) => setCountryConfirmed(event.currentTarget.checked)} label="I confirm this is the payment account's legal country." />
          {setup.error && <Alert color="red">{setup.error instanceof ApiError ? setup.error.message : "Payment setup failed."}</Alert>}
          <Button disabled={country.length !== 2 || !countryConfirmed} loading={setup.isPending} onClick={() => setup.mutate()} style={{ alignSelf: "flex-start" }}>Set up payments</Button>
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
