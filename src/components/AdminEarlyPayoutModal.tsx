"use client";

import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Alert, Button, Group, Loader, Modal, Select, Stack, Text, Textarea, TextInput } from "@mantine/core";
import { formatBasisPointsAsPercent, formatMinorAmount } from "@/lib/money";
import { advanceOutcomeCopy, majorStringToMinor, minorToMajorString, percentOfMax, type AdvanceSummary } from "@/lib/earlyPayout";
import { getAdvancePreview, releaseAdvance, type AdvancePreview, type AdvanceResult } from "@/lib/platformOrganizationApi";

const REASON_CATEGORIES = [
  { value: "ORGANIZER_REQUEST", label: "Organizer request" },
  { value: "EVENT_FUNDING", label: "Event funding (deposits, vendors)" },
  { value: "SUPPORT_ESCALATION", label: "Support escalation" },
  { value: "OTHER", label: "Other" },
];

/**
 * Partial payout ("early payout") before settlement. Two steps, mirroring
 * the preview → confirm flow the release uses: the admin enters an amount
 * (or taps a percentage of the maximum), reviews exactly what the server
 * validated, then confirms with a reason. The maximum shown is the
 * server's — the reserve floor is never computed here.
 */
export function AdminEarlyPayoutModal({
  organizationId,
  eventTitle,
  summary,
  opened,
  onClose,
  onDone,
  onError,
}: {
  organizationId: string;
  eventTitle: string;
  summary: AdvanceSummary;
  opened: boolean;
  onClose: () => void;
  onDone: (result: AdvanceResult) => void;
  onError: (error: Error) => void;
}) {
  const [amount, setAmount] = useState("");
  const [reasonCategory, setReasonCategory] = useState<string | null>(null);
  const [reason, setReason] = useState("");
  const [preview, setPreview] = useState<AdvancePreview | null>(null);

  const max = summary.max_advance_minor;
  const amountMinor = majorStringToMinor(amount);
  const amountError = amount.trim() !== "" && amountMinor === null ? "Enter a valid amount, e.g. 80.00" : amountMinor !== null && amountMinor > max ? "More than the maximum available" : null;

  function reset() {
    setAmount("");
    setReasonCategory(null);
    setReason("");
    setPreview(null);
  }
  function close() {
    reset();
    onClose();
  }

  const review = useMutation({
    mutationFn: () => getAdvancePreview(organizationId, summary.event_id, amountMinor!),
    onSuccess: setPreview,
    onError,
  });
  const confirm = useMutation({
    mutationFn: () => releaseAdvance(organizationId, preview!.preview_token!, reasonCategory!, reason.trim()),
    onSuccess: (result) => {
      reset();
      onDone(result);
    },
    onError,
  });

  const canReview = amountMinor !== null && amountMinor > 0 && amountMinor <= max && !review.isPending;
  const canConfirm = preview?.outcome === "PREVIEW_OK" && !!reasonCategory && reason.trim().length >= 10 && !confirm.isPending;

  return (
    <Modal opened={opened} onClose={close} title={`Early payout — ${eventTitle}`} centered size="lg" closeOnClickOutside={!confirm.isPending}>
      <Stack>
        <Group grow align="flex-start">
          <Figure label="Earned (still held)" value={formatMinorAmount(summary.base_minor, summary.currency)} />
          <Figure label={`Reserve kept (${formatBasisPointsAsPercent(summary.reserve_bp)})`} value={formatMinorAmount(summary.floor_minor, summary.currency)} />
          <Figure label="Already paid early" value={formatMinorAmount(summary.outstanding_minor, summary.currency)} />
          <Figure label="Available now" value={formatMinorAmount(max, summary.currency)} strong />
        </Group>

        {!preview ? (
          <>
            <TextInput
              label={`Amount (${summary.currency})`}
              placeholder="0.00"
              value={amount}
              onChange={(event) => setAmount(event.currentTarget.value)}
              error={amountError}
              inputMode="decimal"
              data-autofocus
            />
            <Group gap="xs">
              {[25, 50, 75].map((percent) => (
                <Button key={percent} size="compact-xs" variant="light" onClick={() => setAmount(minorToMajorString(percentOfMax(max, percent)))}>
                  {percent}%
                </Button>
              ))}
              <Button size="compact-xs" variant="light" onClick={() => setAmount(minorToMajorString(max))}>
                Max
              </Button>
            </Group>
            <Text size="xs" c="dimmed">
              The reserve stays with the platform to cover refunds and chargebacks until the event&apos;s normal release date. Anything paid now is
              deducted from the final release.
            </Text>
            <Group justify="flex-end">
              <Button variant="subtle" onClick={close}>
                Cancel
              </Button>
              <Button loading={review.isPending} disabled={!canReview} onClick={() => review.mutate()}>
                Review
              </Button>
            </Group>
          </>
        ) : preview.outcome !== "PREVIEW_OK" ? (
          <>
            <Alert color="red">{advanceOutcomeCopy(preview.outcome, preview.account?.account_status)}</Alert>
            <Group justify="flex-end">
              <Button variant="subtle" onClick={close}>
                Close
              </Button>
              <Button onClick={() => setPreview(null)}>Change amount</Button>
            </Group>
          </>
        ) : (
          <>
            <Stack gap={4}>
              <Text size="sm" c="dimmed">
                Target account: {preview.account?.provider} · {preview.account?.environment}
              </Text>
              <Text fw={700} size="lg">
                Send {formatMinorAmount(preview.amount_minor!, summary.currency)} now
              </Text>
              <Text size="sm" c="dimmed">
                Reserve still held after this: {formatMinorAmount(summary.floor_minor, summary.currency)}. This cannot be undone.
              </Text>
            </Stack>
            <Select label="Reason category" placeholder="Select a reason" data={REASON_CATEGORIES} value={reasonCategory} onChange={setReasonCategory} required />
            <Textarea
              label="Explanation"
              placeholder="Why is this being paid early? Recorded in the audit log, not shown to the organizer."
              minRows={3}
              autosize
              value={reason}
              onChange={(event) => setReason(event.currentTarget.value)}
              required
            />
            <Group justify="flex-end">
              <Button variant="subtle" onClick={() => setPreview(null)} disabled={confirm.isPending}>
                Back
              </Button>
              <Button color="teal" loading={confirm.isPending} disabled={!canConfirm} onClick={() => confirm.mutate()}>
                Send early payout
              </Button>
            </Group>
          </>
        )}
        {review.isPending && !preview && <Group justify="center"><Loader size="xs" /></Group>}
      </Stack>
    </Modal>
  );
}

function Figure({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <Stack gap={0}>
      <Text size="xs" c="dimmed">
        {label}
      </Text>
      <Text fw={strong ? 700 : 600} c={strong ? "teal" : undefined}>
        {value}
      </Text>
    </Stack>
  );
}
