"use client";

import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Alert, Button, Checkbox, Group, Modal, ScrollArea, Stack, Table, Text } from "@mantine/core";
import { notifications } from "@mantine/notifications";
import { batchClaimLinks, type EntitlementRow } from "@/lib/portalApi";
import { resolveApiErrorMessage } from "@/lib/apiErrorMessages";
import { CopyLinkButton } from "@/components/CopyLinkButton";
import { ticketLabel } from "@/lib/portalStatus";

type CreatedRow = { label: string; url: string };

/**
 * Generate guest claim links for a multi-selection of buyer-held
 * entitlements in one go, then export them as CSV (docs/17 §10 batch).
 */
export function BatchClaimLinksModal({
  entitlements,
  opened,
  onClose,
  onDone,
}: {
  entitlements: EntitlementRow[];
  opened: boolean;
  onClose: () => void;
  onDone: () => void;
}) {
  const [hideName, setHideName] = useState(false);
  const [created, setCreated] = useState<CreatedRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const run = useMutation({
    mutationFn: () =>
      batchClaimLinks({
        entitlement_public_ids: entitlements.map((e) => e.public_id),
        hide_inviter_name: hideName,
      }),
    onSuccess: (data) => {
      const byId = new Map(entitlements.map((e) => [e.public_id, e]));
      const rows: CreatedRow[] = [];
      let skipped = 0;
      for (const r of data.results) {
        if (r.status === "created") {
          const e = byId.get(r.entitlement_public_id);
          rows.push({
            label: e ? `${ticketLabel(e.ticket)} #${e.sequence_number}` : r.entitlement_public_id,
            url: r.link.url,
          });
        } else {
          skipped += 1;
        }
      }
      setCreated(rows);
      notifications.show({
        color: skipped === 0 ? "teal" : "yellow",
        message: skipped === 0 ? `${rows.length} links created.` : `${rows.length} created, ${skipped} skipped.`,
      });
      onDone();
    },
    onError: (e) => setError(resolveApiErrorMessage(e)),
  });

  function downloadCsv() {
    if (!created) return;
    const csv = ["Ticket,Invite link", ...created.map((r) => `"${r.label.replace(/"/g, '""')}","${r.url}"`)].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "invite-links.csv";
    a.click();
    URL.revokeObjectURL(a.href);
  }

  function close() {
    if (run.isPending) return;
    setCreated(null);
    setError(null);
    setHideName(false);
    onClose();
  }

  return (
    <Modal opened={opened} onClose={close} title={`Invite links for ${entitlements.length} tickets`} centered size="lg">
      <Stack gap="md">
        {error && (
          <Alert color="red" variant="light" withCloseButton onClose={() => setError(null)}>
            {error}
          </Alert>
        )}

        {!created && (
          <>
            <Checkbox
              label="Hide my name from recipients"
              checked={hideName}
              onChange={(e) => setHideName(e.currentTarget.checked)}
            />
            <Button onClick={() => run.mutate()} loading={run.isPending}>
              Generate {entitlements.length} links
            </Button>
          </>
        )}

        {created && (
          <>
            <Group justify="space-between">
              <Text size="sm" fw={500}>
                {created.length} links ready
              </Text>
              <Button size="xs" variant="light" onClick={downloadCsv} disabled={created.length === 0}>
                Download CSV
              </Button>
            </Group>
            <ScrollArea.Autosize mah={320}>
              <Table>
                <Table.Tbody>
                  {created.map((r) => (
                    <Table.Tr key={r.url}>
                      <Table.Td>
                        <Text size="sm">{r.label}</Text>
                      </Table.Td>
                      <Table.Td style={{ textAlign: "right" }}>
                        <CopyLinkButton value={r.url} />
                      </Table.Td>
                    </Table.Tr>
                  ))}
                </Table.Tbody>
              </Table>
            </ScrollArea.Autosize>
            <Text size="xs" c="dimmed">
              These links aren&apos;t shown again — copy or download them now.
            </Text>
            <Button variant="subtle" onClick={close}>
              Done
            </Button>
          </>
        )}
      </Stack>
    </Modal>
  );
}
