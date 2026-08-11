"use client";

import { useState } from "react";
import { Button, Group, Modal, Stack, Text, Textarea } from "@mantine/core";

/**
 * Shared confirm-with-reason dialog for every reason-required Platform
 * Admin mutation (organization suspend/restore/payout-restriction, user
 * suspend/restore — see AdminActionReasonData on the backend, which
 * enforces the same minimum length these props advertise).
 */
export function AdminReasonModal({
  opened,
  onClose,
  title,
  description,
  confirmLabel,
  confirmColor = "red",
  loading,
  onConfirm,
}: {
  opened: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  confirmLabel: string;
  confirmColor?: string;
  loading: boolean;
  onConfirm: (reason: string) => void;
}) {
  const [reason, setReason] = useState("");

  return (
    <Modal
      opened={opened}
      onClose={() => {
        setReason("");
        onClose();
      }}
      title={title}
      centered
    >
      <Stack>
        {description && (
          <Text size="sm" c="dimmed">
            {description}
          </Text>
        )}
        <Textarea
          label="Reason"
          placeholder="Why is this happening? This is recorded in the audit log."
          minRows={2}
          autosize
          value={reason}
          onChange={(event) => setReason(event.currentTarget.value)}
        />
        <Group justify="flex-end">
          <Button variant="subtle" onClick={onClose}>
            Cancel
          </Button>
          <Button
            color={confirmColor}
            loading={loading}
            disabled={reason.trim().length < 3}
            onClick={() => onConfirm(reason.trim())}
          >
            {confirmLabel}
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}
