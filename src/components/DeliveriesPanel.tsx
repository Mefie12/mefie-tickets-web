"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Alert, Badge, Button, Card, Group, Loader, Modal, Stack, Text, TextInput, Title } from "@mantine/core";
import { notifications } from "@mantine/notifications";
import { correctAndResendDelivery, getOrderDeliveries, type DeliveryRow } from "@/lib/portalApi";
import { resolveApiErrorMessage } from "@/lib/apiErrorMessages";

const GROUP_META: Record<DeliveryRow["status_group"], { label: string; color: string }> = {
  ok: { label: "Delivered", color: "teal" },
  in_progress: { label: "Sending", color: "blue" },
  pending: { label: "Queued", color: "gray" },
  failed: { label: "Failed", color: "red" },
};

/**
 * Delivery-failure surface for one order (docs/17 §12): latest delivery
 * per issued credential + correct-and-resend for the failed ones. The
 * credential / QR never changes — only the address.
 */
export function DeliveriesPanel({ orderShortId }: { orderShortId: string }) {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ["portal-deliveries", orderShortId],
    queryFn: () => getOrderDeliveries(orderShortId),
  });

  const [fixing, setFixing] = useState<DeliveryRow | null>(null);

  if (isLoading) return <Loader size="sm" />;
  if (!data || data.deliveries.length === 0) return null;

  return (
    <Stack gap="sm">
      <Title order={2} fz={18}>
        Ticket delivery
      </Title>

      {data.has_failures && (
        <Alert color="red" variant="light">
          A ticket couldn&apos;t be delivered. Fix the address below — the ticket and QR code stay the same.
        </Alert>
      )}

      {data.deliveries.map((row) => {
        const meta = GROUP_META[row.status_group];
        return (
          <Card key={`${row.credential_short_id}-${row.delivery?.id ?? "none"}`} withBorder radius="lg" p="sm">
            <Group justify="space-between" wrap="nowrap" align="flex-start">
              <Stack gap={2} style={{ minWidth: 0 }}>
                <Text size="sm" fw={600} truncate>
                  {row.attendee ? `${row.attendee.first_name} ${row.attendee.last_name}` : `Ticket #${row.sequence_number ?? ""}`}
                </Text>
                {row.delivery && (
                  <Text size="xs" c="dimmed">
                    To {row.delivery.recipient_masked}
                  </Text>
                )}
                {row.status_group === "failed" && row.delivery?.failure_message && (
                  <Text size="xs" c="red">
                    {row.delivery.failure_message}
                  </Text>
                )}
              </Stack>
              <Stack gap="xs" align="flex-end" style={{ flexShrink: 0 }}>
                <Badge color={meta.color} variant="light">
                  {meta.label}
                </Badge>
                {row.correctable && row.status_group === "failed" && (
                  <Button size="xs" variant="light" onClick={() => setFixing(row)}>
                    Fix &amp; resend
                  </Button>
                )}
              </Stack>
            </Group>
          </Card>
        );
      })}

      <CorrectDeliveryModal
        row={fixing}
        opened={fixing !== null}
        onClose={() => setFixing(null)}
        onDone={() => {
          setFixing(null);
          qc.invalidateQueries({ queryKey: ["portal-deliveries", orderShortId] });
          qc.invalidateQueries({ queryKey: ["portal-order", orderShortId] });
        }}
      />
    </Stack>
  );
}

function CorrectDeliveryModal({
  row,
  opened,
  onClose,
  onDone,
}: {
  row: DeliveryRow | null;
  opened: boolean;
  onClose: () => void;
  onDone: () => void;
}) {
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);

  const submit = useMutation({
    mutationFn: () => {
      if (!/^\S+@\S+\.\S+$/.test(email.trim())) return Promise.reject(new Error("Enter a valid email address."));
      return correctAndResendDelivery(row!.delivery!.id, { recipient_email: email.trim() });
    },
    onSuccess: () => {
      notifications.show({ color: "teal", message: "Ticket re-sent to the new address." });
      setEmail("");
      onDone();
    },
    onError: (e) => setError(resolveApiErrorMessage(e)),
  });

  return (
    <Modal
      opened={opened}
      onClose={() => {
        if (submit.isPending) return;
        setEmail("");
        setError(null);
        onClose();
      }}
      title="Fix the delivery address"
      centered
    >
      <Stack gap="md">
        {error && (
          <Alert color="red" variant="light" withCloseButton onClose={() => setError(null)}>
            {error}
          </Alert>
        )}
        <Text size="sm" c="dimmed">
          We&apos;ll resend the same ticket to this address. The QR code and ticket reference don&apos;t change.
        </Text>
        <TextInput
          type="email"
          label="New email"
          value={email}
          onChange={(e) => setEmail(e.currentTarget.value)}
          required
        />
        <Button onClick={() => submit.mutate()} loading={submit.isPending}>
          Resend ticket
        </Button>
      </Stack>
    </Modal>
  );
}
