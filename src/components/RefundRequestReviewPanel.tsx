"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Alert, Badge, Button, Card, Group, Loader, Stack, Text, Textarea, Title } from "@mantine/core";
import { notifications } from "@mantine/notifications";
import { ApiError } from "@/lib/authApi";
import { resolveApiErrorMessage } from "@/lib/apiErrorMessages";

type OrgRefundRequest = {
  id: number;
  status: "PENDING" | "APPROVED" | "DENIED" | "WITHDRAWN";
  reason: string | null;
  decision_note: string | null;
  decided_by: string | null;
  requested_at: string | null;
  decided_at: string | null;
};

const STATUS_META: Record<OrgRefundRequest["status"], { color: string; label: string }> = {
  PENDING: { color: "yellow", label: "Awaiting review" },
  APPROVED: { color: "teal", label: "Approved" },
  DENIED: { color: "gray", label: "Denied" },
  WITHDRAWN: { color: "gray", label: "Withdrawn" },
};

async function req<T>(path: string, options?: { method: "POST"; body: unknown }): Promise<T> {
  const res = await fetch(path, {
    method: options?.method ?? "GET",
    headers: { "Content-Type": "application/json" },
    body: options?.body !== undefined ? JSON.stringify(options.body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(data?.message ?? "Something went wrong.", res.status, data?.errors, data?.code);
  return data as T;
}

/**
 * Organizer review of a buyer's refund request (docs/17 §2.3, WP17).
 * Approve runs the existing whole-order refund; deny records a note.
 */
export function RefundRequestReviewPanel({ eventId, orderId }: { eventId: number | string; orderId: string }) {
  const qc = useQueryClient();
  const base = `/api/events/${eventId}/orders/${encodeURIComponent(orderId)}/refund-requests`;

  const { data, isLoading } = useQuery({
    queryKey: ["org-refund-requests", eventId, orderId],
    queryFn: () => req<{ refund_requests: OrgRefundRequest[] }>(base),
  });

  const [note, setNote] = useState("");

  const decide = useMutation({
    mutationFn: ({ id, decision }: { id: number; decision: "APPROVE" | "DENY" }) =>
      req<{ refund_request: OrgRefundRequest; refund_error: string | null }>(`${base}/${id}/decision`, {
        method: "POST",
        body: { decision, note: note.trim() || undefined },
      }),
    onSuccess: (r) => {
      notifications.show({
        color: r.refund_error ? "orange" : "teal",
        message: r.refund_error
          ? `Marked approved, but the refund needs manual follow-up: ${r.refund_error}`
          : r.refund_request.status === "APPROVED"
            ? "Approved and refunded."
            : "Request denied.",
      });
      setNote("");
      qc.invalidateQueries({ queryKey: ["org-refund-requests", eventId, orderId] });
    },
    onError: (e) => notifications.show({ color: "red", message: resolveApiErrorMessage(e) }),
  });

  if (isLoading) return <Loader size="sm" />;
  const requests = data?.refund_requests ?? [];
  if (requests.length === 0) return null;

  const pending = requests.find((r) => r.status === "PENDING");

  return (
    <Stack gap="sm">
      <Title order={3} fz={18}>
        Refund requests
      </Title>

      {requests.map((r) => {
        const meta = STATUS_META[r.status];
        return (
          <Card key={r.id} withBorder radius="lg" p="md">
            <Group justify="space-between" align="flex-start">
              <Stack gap={2} style={{ minWidth: 0 }}>
                <Badge color={meta.color} variant="light">
                  {meta.label}
                </Badge>
                {r.reason && (
                  <Text size="sm" mt={4}>
                    “{r.reason}”
                  </Text>
                )}
                <Text size="xs" c="dimmed">
                  {r.requested_at ? `Requested ${new Date(r.requested_at).toLocaleString()}` : ""}
                  {r.decided_by ? ` · decided by ${r.decided_by}` : ""}
                </Text>
                {r.decision_note && (
                  <Text size="xs" c="dimmed">
                    Note: {r.decision_note}
                  </Text>
                )}
              </Stack>
            </Group>

            {r.status === "PENDING" && pending?.id === r.id && (
              <Stack gap="xs" mt="md">
                <Alert color="yellow" variant="light">
                  Approving runs a full refund for this order immediately.
                </Alert>
                <Textarea
                  label="Note (optional)"
                  autosize
                  minRows={2}
                  value={note}
                  onChange={(e) => setNote(e.currentTarget.value)}
                />
                <Group>
                  <Button
                    color="teal"
                    onClick={() => decide.mutate({ id: r.id, decision: "APPROVE" })}
                    loading={decide.isPending}
                  >
                    Approve &amp; refund
                  </Button>
                  <Button
                    variant="light"
                    color="gray"
                    onClick={() => decide.mutate({ id: r.id, decision: "DENY" })}
                    loading={decide.isPending}
                  >
                    Deny
                  </Button>
                </Group>
              </Stack>
            )}
          </Card>
        );
      })}
    </Stack>
  );
}
