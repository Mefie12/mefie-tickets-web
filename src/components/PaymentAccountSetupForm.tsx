"use client";

import { useState } from "react";
import { Alert, Button, Checkbox, Stack, Text, Title } from "@mantine/core";
import { useMutation, useQuery } from "@tanstack/react-query";
import { ApiError } from "@/lib/authApi";
import {
  getSupportedCurrencies,
  provisionPaymentAccount,
  type PaymentAccount,
} from "@/lib/paymentAccountApi";
import { CountrySelector } from "@/components/CountrySelector";
import { CurrencySelector } from "@/components/CurrencySelector";
import { PaymentCurrencyExplainer } from "@/components/PaymentCurrencyExplainer";
import { COUNTRIES_BY_CODE } from "@/lib/countries";

/**
 * The legal-country + settlement-currency form that provisions an
 * organization's payment account (PaymentAccountService::provision()).
 * Shared by Settings > Payments (PaymentsAndPayouts, rendered when no
 * account exists yet or the last attempt was rejected) and the
 * onboarding wizard's "Add your financial details" step. Full KYC / bank
 * details are collected later via Stripe's embedded onboarding — this
 * form only pins the legal country and the single currency every event
 * the organization runs will sell tickets in (see
 * EventService::resolveCurrencyCode()).
 *
 * Renders form contents only (a Stack) — each call site supplies its own
 * Card/layout wrapper.
 */
export function PaymentAccountSetupForm({
  defaultLegalCountry,
  onProvisioned,
  rejectionReason,
  hideHeading = false,
}: {
  /** Platform-configured convenience pre-fill (config('organizations.default_legal_country')) — never a claim about provider support. */
  defaultLegalCountry: string | null;
  onProvisioned: (account: PaymentAccount) => void;
  rejectionReason?: string;
  hideHeading?: boolean;
}) {
  const [country, setCountry] = useState(defaultLegalCountry ?? "");
  const [currency, setCurrency] = useState(() =>
    defaultLegalCountry ? COUNTRIES_BY_CODE.get(defaultLegalCountry)?.defaultCurrency ?? "" : "",
  );
  const [countryConfirmed, setCountryConfirmed] = useState(false);

  const setup = useMutation({
    mutationFn: () => provisionPaymentAccount(country.trim().toUpperCase(), currency.trim().toUpperCase()),
    onSuccess: ({ payment_account }) => onProvisioned(payment_account),
  });

  // Filters the currency picker to combinations the backend will
  // actually accept (config/payment_provider_currency_matrix.php) —
  // catches an unsupported pairing before submitting, not just after.
  const supportedCurrencies = useQuery({
    queryKey: ["supported-currencies", country],
    queryFn: () => getSupportedCurrencies(country),
    enabled: country.length === 2,
  });

  return (
    <Stack>
      {!hideHeading && <Title order={2}>Payments &amp; Payouts</Title>}
      <Text c="dimmed">
        Add your legal payment country and settlement currency to start selling tickets right away — you can
        complete full verification later, once you have real sales to withdraw. This is separate from your public
        organization address, but it does determine the currency every event you create sells tickets in.{" "}
        <PaymentCurrencyExplainer />
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
        description={
          <>
            Every event your organization creates sells tickets in this currency — it can&apos;t be mixed across
            events. <PaymentCurrencyExplainer />
          </>
        }
        required
        value={currency}
        onChange={(value) => setCurrency(value ?? "")}
        allowedCodes={supportedCurrencies.data}
      />
      <Alert color="orange">
        Choose the country where the entity receiving ticket revenue is legally registered. This is a financial/KYC
        setting, not your public address, and changing it later requires payment-account replacement.
      </Alert>
      <Checkbox
        checked={countryConfirmed}
        onChange={(event) => setCountryConfirmed(event.currentTarget.checked)}
        label="I confirm this is the payment account's legal country."
      />
      {setup.error && (
        <Alert color="red">{setup.error instanceof ApiError ? setup.error.message : "Payment setup failed."}</Alert>
      )}
      <Button
        disabled={country.length !== 2 || currency.length !== 3 || !countryConfirmed}
        loading={setup.isPending}
        onClick={() => setup.mutate()}
        style={{ alignSelf: "flex-start" }}
      >
        Set up payments
      </Button>
    </Stack>
  );
}
