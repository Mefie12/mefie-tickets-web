"use client";

import { useRef, useState } from "react";
import { Alert, Button, Group, List, Loader, Modal, Stack, Text, Textarea } from "@mantine/core";
import { notifications } from "@mantine/notifications";
import { useMutation, useQuery } from "@tanstack/react-query";
import { ApiError } from "@/lib/authApi";
import {
  getAdminPaymentAccountReplacementPreview,
  getAdminSupportedCurrencies,
  replaceOrganizationPaymentAccount,
  type AdminReplacePaymentAccountResult,
} from "@/lib/platformOrganizationApi";
import { CountrySelector } from "@/components/CountrySelector";
import { CurrencySelector } from "@/components/CurrencySelector";
import { COUNTRIES_BY_CODE } from "@/lib/countries";

/**
 * Admin-console equivalent of ChangePaymentAccountModal (organizer
 * side) — usable regardless of self-service eligibility, since this is
 * exactly the path for an organization whose current account already
 * has financial history. Same underlying rule either way: only events
 * with zero financial history ever migrate — see
 * PaymentAccountLifecycleService::eventIsFinanciallyLocked() on the
 * backend. Requires a reason (recorded in the audit log) and a live
 * step-up ("recent auth") session — see redirectOnAdminAuthError.
 */
export function AdminReplacePaymentAccountModal({
  opened,
  onClose,
  organizationId,
  onReplaced,
  onError,
}: {
  opened: boolean;
  onClose: () => void;
  organizationId: string;
  onReplaced: (result: AdminReplacePaymentAccountResult) => void;
  /** Checked first so a lapsed step-up ("recent auth") session redirects to re-verify instead of showing a raw error — see redirectOnAdminAuthError. Return true if handled. */
  onError?: (error: Error) => boolean;
}) {
  const preview = useQuery({
    queryKey: ["admin-payment-account-replacement-preview", organizationId],
    queryFn: () => getAdminPaymentAccountReplacementPreview(organizationId),
    enabled: opened,
  });

  const [country, setCountry] = useState("");
  const [currency, setCurrency] = useState("");
  const [reason, setReason] = useState("");
  const [redirecting, setRedirecting] = useState(false);
  // One id per attempt, not per click — see ChangePaymentAccountModal
  // for why a retry must reuse this instead of minting a second real
  // Stripe account.
  const idempotencyKeyRef = useRef<string>(crypto.randomUUID());

  const supportedCurrencies = useQuery({
    queryKey: ["admin-supported-currencies", country],
    queryFn: () => getAdminSupportedCurrencies(country),
    enabled: country.length === 2,
  });

  const replace = useMutation({
    mutationFn: () =>
      replaceOrganizationPaymentAccount(
        organizationId,
        country.trim().toUpperCase(),
        currency.trim().toUpperCase(),
        idempotencyKeyRef.current,
        reason.trim(),
      ),
    onSuccess: (result) => {
      onReplaced(result);
      handleClose();
      notifications.show({
        color: "teal",
        title: "Payment account replaced",
        message:
          result.drafted_event_ids.length > 0
            ? `${result.migrated_event_ids.length} event${result.migrated_event_ids.length === 1 ? "" : "s"} moved to the new setup — ${result.drafted_event_ids.length} of those are now Draft.`
            : `${result.migrated_event_ids.length} event${result.migrated_event_ids.length === 1 ? "" : "s"} moved to the new setup.`,
      });
    },
    onError: (error) => {
      setRedirecting(onError?.(error) ?? false);
    },
  });

  function handleClose() {
    setCountry("");
    setCurrency("");
    setReason("");
    setRedirecting(false);
    idempotencyKeyRef.current = crypto.randomUUID();
    replace.reset();
    onClose();
  }

  const mutableCount = preview.data?.mutable_event_ids.length ?? 0;
  const lockedCount = preview.data?.locked_event_ids.length ?? 0;
  const draftCount = preview.data?.live_event_ids_to_draft.length ?? 0;
  const canSubmit = country.length === 2 && currency.length === 3 && reason.trim().length >= 3;

  return (
    <Modal opened={opened} onClose={handleClose} title="Replace payment account" size="lg" closeOnClickOutside={!replace.isPending}>
      {preview.isLoading ? (
        <Group justify="center" py="xl">
          <Loader size="sm" />
        </Group>
      ) : preview.isError || !preview.data ? (
        <Alert color="red" title="Couldn't check eligibility">
          Something went wrong loading this. Please close this and try again.
        </Alert>
      ) : (
        <Stack>
          {!preview.data.can_self_service && (
            <Alert color="orange" title="Self-service is closed for this organization">
              Their current account already has real sales on it — this is exactly the case this admin path exists
              for. Anything already sold stays on its original account and currency regardless.
            </Alert>
          )}

          <Text size="sm" c="dimmed">
            This creates a new payment account for this organization&apos;s future events. Their existing account
            isn&apos;t deleted.
          </Text>
          <List size="sm" spacing={4}>
            <List.Item>Events that already have sales keep their current currency and payment account.</List.Item>
            <List.Item>
              Events with no sales yet {mutableCount > 0 ? `(${mutableCount})` : ""} will move to the new setup.
              {draftCount > 0 ? ` ${draftCount} of those are currently live and will be set to Draft` : ""} so the
              organizer can review ticket prices before publishing again — prices carry over as the same number, not
              converted.
            </List.Item>
            {lockedCount > 0 && (
              <List.Item>
                {lockedCount} event{lockedCount === 1 ? "" : "s"} with sales stay untouched.
              </List.Item>
            )}
            <List.Item>The new account will need its own payout verification before it can withdraw.</List.Item>
          </List>

          <CountrySelector
            label="New legal entity country"
            required
            value={country}
            onChange={(value) => {
              setCountry(value ?? "");
              const suggested = value ? COUNTRIES_BY_CODE.get(value)?.defaultCurrency : undefined;
              if (suggested) setCurrency(suggested);
            }}
          />
          <CurrencySelector
            label="New settlement currency"
            required
            value={currency}
            onChange={(value) => setCurrency(value ?? "")}
            allowedCodes={supportedCurrencies.data?.currencies}
          />
          <Textarea
            label="Reason"
            placeholder="Why is this happening? This is recorded in the audit log."
            required
            minRows={2}
            autosize
            value={reason}
            onChange={(event) => setReason(event.currentTarget.value)}
          />

          {replace.error && !redirecting && (
            <Alert color="red">{replace.error instanceof ApiError ? replace.error.message : "Could not replace the payment account."}</Alert>
          )}

          <Group justify="flex-end">
            <Button variant="default" onClick={handleClose} disabled={replace.isPending}>
              Cancel
            </Button>
            <Button color="red" disabled={!canSubmit} loading={replace.isPending} onClick={() => replace.mutate()}>
              Replace payment account
            </Button>
          </Group>
        </Stack>
      )}
    </Modal>
  );
}
