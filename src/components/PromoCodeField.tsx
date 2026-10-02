"use client";

import { useEffect, useRef, useState } from "react";
import { Alert, Badge, Button, CloseButton, Group, Loader, Stack, Text, TextInput, UnstyledButton } from "@mantine/core";
import { notifications } from "@mantine/notifications";
import { IconAlertCircle, IconTicket } from "@tabler/icons-react";
import { createRejectionNotifier, normalizePromoCode, promoCodeFormatError } from "@/lib/offerCodeFormat";
import { offerErrorMessage } from "@/lib/offerErrors";
import { formatMinorAmount } from "@/lib/money";
import type { Quote } from "@/lib/offersApi";

const SAVINGS = "light-dark(#18794e, #5fd39a)";

/**
 * "Have a promo code?" — collapsed by default, expands to one field.
 * Rendered for every event that sells at least one paid ticket (even with no
 * code offers) so its presence doesn't reveal which events have codes; the
 * panel omits it for all-free events, where there is no price to discount. Every state is announced via
 * aria-live; messages come from lib/offerErrors.ts. The state shown is
 * derived from the server quote, never decided client-side.
 */
export function PromoCodeField({ appliedCode, usingShareLink, quote, loading, settled, onApply, onRemove, onVerify }: {
  /** The typed code currently sent with the quote (not the share token). */
  appliedCode: string | null;
  usingShareLink: boolean;
  quote?: Quote;
  loading: boolean;
  /** True once the quote on screen is the answer to the current input (not a placeholder from a previous one). */
  settled: boolean;
  onApply: (code: string) => void;
  onRemove: () => void;
  onVerify: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  // Counts typed Apply attempts so a rejection is announced once per attempt.
  const [attempt, setAttempt] = useState(0);
  const notifier = useRef(createRejectionNotifier());

  const hasInput = appliedCode !== null || usingShareLink;
  const appliedByInput = quote?.status === "APPLIED" && quote.offer && quote.offer.source !== "automatic";
  const beatenByAutomatic = hasInput && quote?.status === "APPLIED" && quote.offer?.source === "automatic";
  const rejected = hasInput && settled && quote?.status === "REJECTED" ? quote : null;

  useEffect(() => {
    if (notifier.current(attempt, rejected !== null, settled)) {
      notifications.show({ color: "red", title: "Code not applied", message: offerErrorMessage(rejected?.code, rejected?.message ?? undefined) });
    }
  }, [attempt, rejected, settled]);
  const needsVerification = hasInput && (quote?.status === "VERIFICATION_REQUIRED" || quote?.needs_verification === true);

  function submit() {
    // Normalize once; validate and send that same value.
    const code = normalizePromoCode(draft);
    if (code === "") {
      // Clearing the field and applying means "remove my code", not an error.
      setFormError(null);
      setDraft("");
      onRemove();
      return;
    }
    const error = promoCodeFormatError(code);
    if (error) {
      setFormError(error);
      return;
    }
    setFormError(null);
    setDraft(code);
    setAttempt((n) => n + 1);
    onApply(code);
  }

  if (appliedByInput && quote) {
    return (
      <Stack gap={4} aria-live="polite">
        <Group justify="space-between" wrap="nowrap" gap="xs">
          <Badge variant="light" size="lg" radius="md" leftSection={<IconTicket size={14} />}
            rightSection={<CloseButton size="xs" aria-label="Remove promo code" onClick={() => { setDraft(""); setOpen(false); onRemove(); }} />}
            styles={{ root: { textTransform: "none", paddingRight: 4 } }}>
            {appliedCode ? appliedCode.trim().toUpperCase() : quote.offer?.name}
          </Badge>
          <Text size="sm" fw={600} c={SAVINGS}>You save {formatMinorAmount(quote.discount_total_minor, quote.currency)}</Text>
        </Group>
        {quote.offer?.partially_applied && (
          <Text size="xs" c="dimmed">Applied to {quote.offer.discounted_units} of your tickets (offer limit reached).</Text>
        )}
      </Stack>
    );
  }

  if (!open && appliedCode === null && !rejected && !needsVerification) {
    return (
      <UnstyledButton onClick={() => setOpen(true)} style={{ alignSelf: "flex-start" }}>
        <Text size="sm" fw={500} c="var(--mantine-primary-color-filled)" td="underline">Have a promo code?</Text>
      </UnstyledButton>
    );
  }

  return (
    <Stack gap={6}>
      <form onSubmit={(e) => { e.preventDefault(); submit(); }}>
        <Group gap="xs" align="flex-end" wrap="nowrap">
          <TextInput
            aria-label="Promo code" placeholder="Promo code" value={draft} autoCapitalize="characters" autoComplete="off" spellCheck={false}
            onChange={(e) => { setDraft(e.currentTarget.value); if (formError) setFormError(null); }}
            // Validate when they leave the field, not while they're still typing.
            onBlur={() => { const code = normalizePromoCode(draft); setDraft(code); setFormError(promoCodeFormatError(code)); }}
            style={{ flex: 1 }} maxLength={64} autoFocus={open}
            error={formError ?? (rejected ? true : undefined)}
          />
          <Button type="submit" variant="default" loading={loading && hasInput}>Apply</Button>
        </Group>
      </form>

      <div aria-live="polite" role="status">
        {loading && hasInput && <Group gap={6}><Loader size={12} /><Text size="xs" c="dimmed">Checking…</Text></Group>}
        {rejected && (
          <Alert color="red" radius="md" icon={<IconAlertCircle size={18} />} title="Code not applied" role="alert" mt={4}>
            <Group justify="space-between" wrap="nowrap" gap="xs" align="flex-start">
              <Text size="sm">{offerErrorMessage(rejected.code, rejected.message ?? undefined)}</Text>
              <Button variant="subtle" color="red" size="compact-xs" onClick={() => { setDraft(""); setFormError(null); onRemove(); }}>Clear</Button>
            </Group>
          </Alert>
        )}
        {needsVerification && !rejected && (
          <Group gap="xs" wrap="nowrap" justify="space-between">
            <Text size="xs" c="dimmed">Verify your email to use this offer.</Text>
            <Button size="compact-xs" variant="light" onClick={onVerify}>Verify email</Button>
          </Group>
        )}
        {beatenByAutomatic && (
          <Text size="xs" c="dimmed">{quote?.offer?.name} already gives you a bigger saving, so your code wasn’t needed.</Text>
        )}
      </div>
    </Stack>
  );
}
