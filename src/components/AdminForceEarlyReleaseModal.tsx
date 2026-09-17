"use client";

import { useState } from "react";
import { Alert, Button, Group, Loader, Modal, Select, Stack, Text, Textarea } from "@mantine/core";
import { formatMinorAmount } from "@/lib/money";
import type { ReleasePreview } from "@/lib/platformOrganizationApi";

const REASON_CATEGORIES = [
  { value: "ORGANIZER_HARDSHIP", label: "Organizer hardship request" },
  { value: "SUPPORT_ESCALATION", label: "Support escalation" },
  { value: "EVENT_COMPLETE_EARLY_PAYOUT", label: "Event complete — early payout" },
  { value: "OTHER", label: "Other" },
];

/**
 * The "held funds early" override — deliberately a separate, more
 * heavily-flagged component from the plain "release eligible funds"
 * confirm, not a checkbox in the same dialog: this bypasses the normal
 * hold period, and the backend requires a reason category plus a real
 * explanation (10-char minimum) rather than the bare 3-char rule the
 * shared AdminReasonModal enforces elsewhere.
 */
export function AdminForceEarlyReleaseModal({
  opened,
  onClose,
  preview,
  previewLoading,
  loading,
  onConfirm,
}: {
  opened: boolean;
  onClose: () => void;
  preview: ReleasePreview | null;
  previewLoading: boolean;
  loading: boolean;
  onConfirm: (data: { reasonCategory: string; reason: string }) => void;
}) {
  const [reasonCategory, setReasonCategory] = useState<string | null>(null);
  const [reason, setReason] = useState("");

  function handleClose() {
    setReasonCategory(null);
    setReason("");
    onClose();
  }

  const canSubmit = !!reasonCategory && reason.trim().length >= 10;
  const blocked = preview && preview.outcome !== "PREVIEW_OK";

  return (
    <Modal opened={opened} onClose={handleClose} title="Release held funds early" centered size="lg" closeOnClickOutside={!loading}>
      {previewLoading ? (
        <Group justify="center" py="xl">
          <Loader size="sm" />
        </Group>
      ) : blocked ? (
        <Stack>
          <Alert color="red">{blockedPreviewCopy(preview!.outcome, preview!.account?.account_status)}</Alert>
          <Group justify="flex-end">
            <Button onClick={handleClose}>Close</Button>
          </Group>
        </Stack>
      ) : (
        <Stack>
          <Alert color="red" title="This overrides the normal hold period">
            This releases funds still inside their settlement hold, not just what&apos;s already eligible. It requires a
            documented justification, is audited as a distinct event from a routine release, and may increase refund/dispute
            exposure — a later refund does not automatically reverse a transfer already sent to the organizer.
          </Alert>
          {preview?.account && (
            <Text size="sm" c="dimmed">
              Target account: {preview.account.provider} · {preview.account.environment} (routing {preview.account.routing_status})
            </Text>
          )}
          {preview?.balances && preview.balances.length > 0 && (
            <Stack gap={4}>
              <Text size="sm" fw={600}>Amount this will release (eligible + held, per currency):</Text>
              {preview.balances.map((b) => (
                <Text key={b.currency} size="sm">{formatMinorAmount(b.amount_minor, b.currency)}</Text>
              ))}
            </Stack>
          )}
          <Select
            label="Reason category"
            placeholder="Select a reason"
            data={REASON_CATEGORIES}
            value={reasonCategory}
            onChange={setReasonCategory}
            required
          />
          <Textarea
            label="Explanation"
            placeholder="What's the justification for releasing this early? This is recorded in the audit log."
            minRows={3}
            autosize
            value={reason}
            onChange={(event) => setReason(event.currentTarget.value)}
            required
          />
          <Group justify="flex-end">
            <Button variant="subtle" onClick={handleClose} disabled={loading}>
              Cancel
            </Button>
            <Button
              color="red"
              loading={loading}
              disabled={!canSubmit}
              onClick={() => onConfirm({ reasonCategory: reasonCategory!, reason: reason.trim() })}
            >
              Release held funds early
            </Button>
          </Group>
        </Stack>
      )}
    </Modal>
  );
}

/**
 * accountStatus disambiguates ACCOUNT_NOT_READY: DISCONNECTED is an
 * admin-side recovery (payouts.reconnect_account — no UI for it yet on
 * this tab), everything else (ONBOARDING, ACTION_REQUIRED, RESTRICTED,
 * PROVISIONING_REVIEW_REQUIRED) is outstanding Stripe requirements only
 * the organizer can complete. Worded so it never tells the admin to go
 * do something they have no way to do from this screen.
 */
export function blockedPreviewCopy(outcome: string, accountStatus?: string): string {
  switch (outcome) {
    case "PAYOUT_RESTRICTED":
      return "This organization's payouts are restricted — clear the restriction before releasing.";
    case "ACCOUNT_NOT_CONNECTED":
      return "There is no connected payment account for this environment.";
    case "ACCOUNT_NOT_READY":
      return accountStatus === "DISCONNECTED"
        ? "The account holding this money has lost its connection to the payment provider and needs to be reconnected before releasing — that's an admin-side recovery, not something the organizer can fix."
        : "The account holding this money hasn't finished setup with the payment provider yet — releasing isn't possible until the organizer completes their outstanding requirements.";
    case "MULTIPLE_ACCOUNTS_ELIGIBLE":
      return "More than one payment account has releasable funds for this organization — this needs manual review before releasing, since this action can only target one account at a time.";
    case "NO_ELIGIBLE_FUNDS":
      return "Nothing is currently eligible to release.";
    default:
      return "This action isn't available right now.";
  }
}
