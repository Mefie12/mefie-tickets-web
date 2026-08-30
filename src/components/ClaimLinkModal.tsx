"use client";

import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Alert, Button, Checkbox, Code, Divider, Group, Modal, Stack, Text, TextInput } from "@mantine/core";
import { notifications } from "@mantine/notifications";
import {
  createClaimLink,
  revokeClaimLink,
  rotateClaimLink,
  type ClaimLinkDetail,
  type EntitlementRow,
} from "@/lib/portalApi";
import { resolveApiErrorMessage } from "@/lib/apiErrorMessages";
import { CopyLinkButton } from "@/components/CopyLinkButton";
import { ticketLabel } from "@/lib/portalStatus";

/**
 * Create / rotate / revoke the guest claim link for one buyer-held
 * entitlement (docs/17 §10). The shareable URL is shown once, right
 * after create or rotate — it is never re-displayable (same discipline
 * as the order locator).
 */
export function ClaimLinkModal({
  entitlement,
  opened,
  onClose,
  onDone,
}: {
  entitlement: EntitlementRow | null;
  opened: boolean;
  onClose: () => void;
  onDone: () => void;
}) {
  const [hideName, setHideName] = useState(false);
  const [expiresAt, setExpiresAt] = useState("");
  const [lockEmail, setLockEmail] = useState("");
  const [freshUrl, setFreshUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const hasLink = entitlement?.claim_link != null;
  const linkId = entitlement?.claim_link?.id ?? null;

  function reset() {
    setHideName(false);
    setExpiresAt("");
    setLockEmail("");
    setFreshUrl(null);
    setError(null);
  }

  const onResult = (link: ClaimLinkDetail, verb: string) => {
    setFreshUrl(link.url);
    notifications.show({ color: "teal", message: `Invite link ${verb}.` });
    onDone();
  };

  const create = useMutation({
    mutationFn: () =>
      createClaimLink(entitlement!.public_id, {
        hide_inviter_name: hideName,
        expires_at: expiresAt ? new Date(`${expiresAt}T23:59:59`).toISOString() : null,
        delivery_lock_email: lockEmail.trim() || null,
      }),
    onSuccess: (d) => onResult(d.link, "created"),
    onError: (e) => setError(resolveApiErrorMessage(e)),
  });

  const rotate = useMutation({
    mutationFn: () => rotateClaimLink(linkId!),
    onSuccess: (d) => onResult(d.link, "rotated — the old link no longer works"),
    onError: (e) => setError(resolveApiErrorMessage(e)),
  });

  const revoke = useMutation({
    mutationFn: () => revokeClaimLink(linkId!),
    onSuccess: () => {
      notifications.show({ color: "gray", message: "Invite link revoked." });
      reset();
      onDone();
      onClose();
    },
    onError: (e) => setError(resolveApiErrorMessage(e)),
  });

  const busy = create.isPending || rotate.isPending || revoke.isPending;

  return (
    <Modal
      opened={opened}
      onClose={() => {
        if (busy) return;
        reset();
        onClose();
      }}
      title="Share this ticket by link"
      centered
    >
      <Stack gap="md">
        {entitlement && (
          <Text size="sm" c="dimmed">
            {ticketLabel(entitlement.ticket)} #{entitlement.sequence_number}
          </Text>
        )}

        {error && (
          <Alert color="red" variant="light" withCloseButton onClose={() => setError(null)}>
            {error}
          </Alert>
        )}

        {freshUrl && (
          <Alert color="teal" variant="light" title="Copy this link now">
            <Stack gap="xs">
              <Code block style={{ wordBreak: "break-all" }}>
                {freshUrl}
              </Code>
              <Group>
                <CopyLinkButton value={freshUrl} />
              </Group>
              <Text size="xs" c="dimmed">
                For privacy we won&apos;t show this link again. Rotate it here if you lose it.
              </Text>
            </Stack>
          </Alert>
        )}

        {!freshUrl && !hasLink && (
          <>
            <Checkbox
              label="Hide my name from the recipient"
              checked={hideName}
              onChange={(e) => setHideName(e.currentTarget.checked)}
            />
            <TextInput
              type="date"
              label="Expires (optional)"
              value={expiresAt}
              onChange={(e) => setExpiresAt(e.currentTarget.value)}
            />
            <TextInput
              type="email"
              label="Lock ticket delivery to this email (optional)"
              description="The recipient can't change where the ticket is sent"
              value={lockEmail}
              onChange={(e) => setLockEmail(e.currentTarget.value)}
            />
            <Button onClick={() => create.mutate()} loading={create.isPending}>
              Create invite link
            </Button>
          </>
        )}

        {!freshUrl && hasLink && (
          <>
            <Text size="sm">
              An invite link is active
              {entitlement?.claim_link?.delivery_locked ? " with delivery locked" : ""}
              {entitlement?.claim_link?.expires_at
                ? `, expiring ${new Date(entitlement.claim_link.expires_at).toLocaleDateString()}`
                : ""}
              .
            </Text>
            <Divider />
            <Group grow>
              <Button variant="light" onClick={() => rotate.mutate()} loading={rotate.isPending}>
                Rotate link
              </Button>
              <Button variant="light" color="red" onClick={() => revoke.mutate()} loading={revoke.isPending}>
                Revoke
              </Button>
            </Group>
          </>
        )}
      </Stack>
    </Modal>
  );
}
