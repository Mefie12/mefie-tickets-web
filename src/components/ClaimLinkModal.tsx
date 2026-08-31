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
 * as the order locator). When the delivery is locked to an email, the
 * link is also emailed to that address (opt-out on create; always on
 * rotate — "Resend invite").
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
  const [sendToLocked, setSendToLocked] = useState(true);
  const [result, setResult] = useState<ClaimLinkDetail | null>(null);
  const [error, setError] = useState<string | null>(null);

  const hasLink = entitlement?.claim_link != null;
  const linkId = entitlement?.claim_link?.id ?? null;
  const linkLocked = entitlement?.claim_link?.delivery_locked ?? false;

  function reset() {
    setHideName(false);
    setExpiresAt("");
    setLockEmail("");
    setSendToLocked(true);
    setResult(null);
    setError(null);
  }

  const onResult = (link: ClaimLinkDetail, verb: string) => {
    setResult(link);
    notifications.show({ color: "teal", message: `Invite link ${verb}.` });
    onDone();
  };

  const create = useMutation({
    mutationFn: () =>
      createClaimLink(entitlement!.public_id, {
        hide_inviter_name: hideName,
        expires_at: expiresAt ? new Date(`${expiresAt}T23:59:59`).toISOString() : null,
        delivery_lock_email: lockEmail.trim() || null,
        send_to_locked_email: lockEmail.trim() ? sendToLocked : undefined,
      }),
    onSuccess: (d) => onResult(d.link, "created"),
    onError: (e) => setError(resolveApiErrorMessage(e)),
  });

  const rotate = useMutation({
    mutationFn: () => rotateClaimLink(linkId!),
    onSuccess: (d) =>
      onResult(d.link, linkLocked ? "resent — a fresh link is on its way" : "rotated — the old link no longer works"),
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
  const freshUrl = result?.url ?? null;

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
          <Alert color="teal" variant="light" title={result?.invite_email_sent ? "Link emailed" : "Copy this link now"}>
            <Stack gap="xs">
              {result?.invite_email_sent && (
                <Text size="sm">We&apos;ve emailed this link to the recipient. You can also share it another way:</Text>
              )}
              <Code block style={{ wordBreak: "break-all" }}>
                {freshUrl}
              </Code>
              <Group>
                <CopyLinkButton value={freshUrl} />
              </Group>
              <Text size="xs" c="dimmed">
                {result?.invite_email_sent
                  ? "For privacy we won't show it again — it's already on its way to their inbox."
                  : "For privacy we won't show this link again. Rotate it here if you lose it."}
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
            {lockEmail.trim() && (
              <Checkbox
                label={`Email this link to ${lockEmail.trim()}`}
                checked={sendToLocked}
                onChange={(e) => setSendToLocked(e.currentTarget.checked)}
              />
            )}
            <Button onClick={() => create.mutate()} loading={create.isPending}>
              Create invite link
            </Button>
          </>
        )}

        {!freshUrl && hasLink && (
          <>
            <Text size="sm">
              An invite link is active
              {linkLocked ? " with delivery locked" : ""}
              {entitlement?.claim_link?.expires_at
                ? `, expiring ${new Date(entitlement.claim_link.expires_at).toLocaleDateString()}`
                : ""}
              .
            </Text>
            {linkLocked && (
              <Text size="xs" c="dimmed">
                Resending mints a new link and emails it to the locked address; the old link stops working.
              </Text>
            )}
            <Divider />
            <Group grow>
              <Button variant="light" onClick={() => rotate.mutate()} loading={rotate.isPending}>
                {linkLocked ? "Resend invite" : "Rotate link"}
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
