"use client";

import { useRef, useState } from "react";
import { Alert, Anchor, Button, Checkbox, Group, List, Loader, Modal, Stack, Text } from "@mantine/core";
import { notifications } from "@mantine/notifications";
import { useMutation, useQuery } from "@tanstack/react-query";
import { ApiError } from "@/lib/authApi";
import {
  getPaymentAccountReplacementPreview,
  getSupportedCurrencies,
  replacePaymentAccount,
  type PaymentAccount,
} from "@/lib/paymentAccountApi";
import { CountrySelector } from "@/components/CountrySelector";
import { CurrencySelector } from "@/components/CurrencySelector";
import { COUNTRIES_BY_CODE } from "@/lib/countries";

/**
 * "Change payment country & currency" — not an edit of the existing
 * account (Stripe doesn't support changing a connected account's
 * country), but the self-service half of a payment-account replacement:
 * a brand-new account for future events, while anything that's already
 * transacted keeps its original account and currency forever. See
 * ReplacePaymentAccountAction and PaymentAccountLifecycleService::
 * eventIsFinanciallyLocked() on the backend for the actual rule.
 *
 * Only reachable while the current account has zero financial
 * history — the preview fetched on open tells the truth about that
 * regardless of anything cached client-side, and the backend re-checks
 * it again on submit either way.
 */
export function ChangePaymentAccountModal({
  opened,
  onClose,
  onReplaced,
}: {
  opened: boolean;
  onClose: () => void;
  onReplaced: (account: PaymentAccount) => void;
}) {
  const preview = useQuery({
    queryKey: ["payment-account-replacement-preview"],
    queryFn: getPaymentAccountReplacementPreview,
    enabled: opened,
  });

  const [country, setCountry] = useState("");
  const [currency, setCurrency] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  // One id per attempt, not per click — a retry of the same attempt
  // (double-click, a dropped response) must reuse it so the backend
  // resumes rather than provisions a second real Stripe account. Reset
  // only when the modal is closed and reopened, i.e. a genuinely new attempt.
  const idempotencyKeyRef = useRef<string>(crypto.randomUUID());

  const supportedCurrencies = useQuery({
    queryKey: ["supported-currencies", country],
    queryFn: () => getSupportedCurrencies(country),
    enabled: country.length === 2,
  });

  const replace = useMutation({
    mutationFn: () => replacePaymentAccount(country.trim().toUpperCase(), currency.trim().toUpperCase(), idempotencyKeyRef.current),
    onSuccess: ({ payment_account, migrated_event_ids, drafted_event_ids }) => {
      onReplaced(payment_account);
      handleClose();
      notifications.show({
        color: "teal",
        title: "Payment account changed",
        message:
          drafted_event_ids.length > 0
            ? `${migrated_event_ids.length} event${migrated_event_ids.length === 1 ? "" : "s"} moved to the new setup — ${drafted_event_ids.length} of those are now Draft. Review prices before republishing.`
            : `${migrated_event_ids.length} event${migrated_event_ids.length === 1 ? "" : "s"} moved to the new setup.`,
      });
    },
  });

  function handleClose() {
    setCountry("");
    setCurrency("");
    setConfirmed(false);
    idempotencyKeyRef.current = crypto.randomUUID();
    replace.reset();
    onClose();
  }

  const mutableCount = preview.data?.mutable_event_ids.length ?? 0;
  const lockedCount = preview.data?.locked_event_ids.length ?? 0;
  const draftCount = preview.data?.live_event_ids_to_draft.length ?? 0;

  return (
    <Modal opened={opened} onClose={handleClose} title="Change payment country & currency" size="lg" closeOnClickOutside={!replace.isPending}>
      {preview.isLoading ? (
        <Group justify="center" py="xl">
          <Loader size="sm" />
        </Group>
      ) : preview.isError || !preview.data ? (
        // Never fall through to the self-service form on a failed/unknown
        // preview — the backend re-checks eligibility on submit regardless,
        // but showing the form here would look like a granted answer.
        <Alert color="red" title="Couldn't check eligibility">
          Something went wrong loading this. Please close this and try again.
        </Alert>
      ) : !preview.data.can_self_service ? (
        <Stack>
          <Alert color="orange" title="This needs our help">
            Your current payment account already has real sales on it, so this change can no longer be made
            automatically. Contact support and we&apos;ll set up the new account for you — anything that&apos;s
            already sold stays exactly as it is, on its original account and currency.
          </Alert>
          <Text size="sm" c="dimmed">
            Reach us at{" "}
            <Anchor href="mailto:support@mefietickets.com">support@mefietickets.com</Anchor>.
          </Text>
        </Stack>
      ) : (
        <Stack>
          <Text size="sm" c="dimmed">
            This creates a new payment account for future events. Your existing payment account isn&apos;t deleted.
          </Text>
          <List size="sm" spacing={4}>
            <List.Item>Events that already have sales keep their current currency and payment account.</List.Item>
            <List.Item>
              Events with no sales yet {mutableCount > 0 ? `(${mutableCount})` : ""} will move to the new setup.
              {draftCount > 0 ? ` ${draftCount} of those are currently live and will be set to Draft` : ""} so you
              can review ticket prices before publishing again — prices carry over as the same number, not converted.
            </List.Item>
            {lockedCount > 0 && <List.Item>{lockedCount} event{lockedCount === 1 ? "" : "s"} with sales stay untouched.</List.Item>}
            <List.Item>You&apos;ll need to complete payment verification for the new account before you can withdraw from it.</List.Item>
          </List>

          <CountrySelector
            label="New legal entity country"
            required
            value={country}
            onChange={(value) => {
              setCountry(value ?? "");
              setConfirmed(false);
              const suggested = value ? COUNTRIES_BY_CODE.get(value)?.defaultCurrency : undefined;
              if (suggested) setCurrency(suggested);
            }}
          />
          <CurrencySelector
            label="New settlement currency"
            required
            value={currency}
            onChange={(value) => setCurrency(value ?? "")}
            allowedCodes={supportedCurrencies.data}
          />

          <Checkbox
            checked={confirmed}
            onChange={(event) => setConfirmed(event.currentTarget.checked)}
            label="I understand this creates a new payment account, and events with sales won't be affected."
          />

          {replace.error && (
            <Alert color="red">{replace.error instanceof ApiError ? replace.error.message : "Could not change the payment account."}</Alert>
          )}

          <Group justify="flex-end">
            <Button variant="default" onClick={handleClose} disabled={replace.isPending}>
              Cancel
            </Button>
            <Button
              disabled={country.length !== 2 || currency.length !== 3 || !confirmed}
              loading={replace.isPending}
              onClick={() => replace.mutate()}
            >
              Change payment account
            </Button>
          </Group>
        </Stack>
      )}
    </Modal>
  );
}
